import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';
import type { AgentEvent, AgentRunAccepted, AgentRunRequest } from '../../src/shared/contracts';
import { AgentRuntimeError, serializeAgentError } from './errors';

type JsonRecord = Record<string, unknown>;
type EmitAgentEvent = (event: AgentEvent) => void;

interface PendingRequest {
  resolve(value: JsonRecord): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ActiveTurn {
  taskId: string;
  runId: string;
  threadId: string;
  turnId: string;
  providerId: 'local-codex';
  emit: EmitAgentEvent;
  receivedDelta: boolean;
}

interface PendingApproval {
  taskId: string;
  serverRequestId: string | number;
  approvalId: string;
  active: ActiveTurn;
}

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export class CodexAppServer {
  private process: ChildProcessWithoutNullStreams | null = null;
  private executable = 'codex';
  private startPromise: Promise<void> | null = null;
  private requestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly threadByTask = new Map<string, string>();
  private readonly activeByTask = new Map<string, ActiveTurn>();
  private readonly activeByThread = new Map<string, ActiveTurn>();
  private readonly pendingApprovals = new Map<string, PendingApproval>();

  async run(input: AgentRunRequest, emit: EmitAgentEvent): Promise<AgentRunAccepted> {
    if (this.activeByTask.has(input.taskId)) {
      throw new AgentRuntimeError('RUN_ACTIVE', '当前任务已有一轮 Codex 对话正在执行');
    }
    await this.ensureStarted();

    const runId = randomUUID();
    emit({ type: 'run.started', taskId: input.taskId, runId, providerId: 'local-codex' });
    emit({
      type: 'status',
      taskId: input.taskId,
      runId,
      providerId: 'local-codex',
      text: '正在连接本地 Codex app-server',
    });

    let threadId = this.threadByTask.get(input.taskId);
    if (!threadId) {
      const response = await this.request('thread/start', {
        cwd: process.cwd(),
        approvalPolicy: 'on-request',
        sandbox: 'read-only',
        serviceName: 'xt_work_studio',
      });
      const thread = isRecord(response.thread) ? response.thread : null;
      threadId = readString(thread?.id);
      if (!threadId) throw new AgentRuntimeError('PROVIDER_UNAVAILABLE', 'Codex 未返回有效线程');
      this.threadByTask.set(input.taskId, threadId);
    }

    const turnResponse = await this.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: input.prompt }],
    });
    const turn = isRecord(turnResponse.turn) ? turnResponse.turn : null;
    const turnId = readString(turn?.id);
    if (!turnId) throw new AgentRuntimeError('PROVIDER_UNAVAILABLE', 'Codex 未返回有效执行轮次');

    const active: ActiveTurn = {
      taskId: input.taskId,
      runId,
      threadId,
      turnId,
      providerId: 'local-codex',
      emit,
      receivedDelta: false,
    };
    this.activeByTask.set(input.taskId, active);
    this.activeByThread.set(threadId, active);
    return { runId };
  }

  async cancel(taskId: string): Promise<boolean> {
    const active = this.activeByTask.get(taskId);
    if (!active) return false;
    await this.request('turn/interrupt', {
      threadId: active.threadId,
      turnId: active.turnId,
    });
    return true;
  }

  resolveApproval(taskId: string, approvalId: string, decision: 'accept' | 'decline'): boolean {
    const key = `${taskId}:${approvalId}`;
    const approval = this.pendingApprovals.get(key);
    if (!approval) return false;
    this.pendingApprovals.delete(key);
    this.send({
      id: approval.serverRequestId,
      result: { decision },
    });
    approval.active.emit({
      ...this.eventBase(approval.active),
      type: 'approval.resolved',
      approvalId,
      decision,
    });
    return true;
  }

  async probe(): Promise<{ available: boolean; detail?: string }> {
    try {
      await this.ensureStarted();
      return { available: true, detail: this.executable };
    } catch (error) {
      return {
        available: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  dispose(): void {
    this.process?.kill();
    this.process = null;
    this.startPromise = null;
  }

  private ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start();
    return this.startPromise;
  }

  private async start(): Promise<void> {
    this.executable = await this.resolveExecutable();
    const child = spawn(this.executable, ['app-server', '--stdio'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.process = child;

    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => this.receiveLine(line));
    child.stderr.on('data', data => {
      const detail = String(data).trim();
      if (detail) console.warn('[codex app-server]', detail);
    });
    child.once('error', error => this.handleExit(error));
    child.once('exit', code => this.handleExit(new Error(`Codex app-server 已退出（${code ?? 'unknown'}）`)));

    await this.request('initialize', {
      clientInfo: {
        name: 'xt_work_studio',
        title: 'XT Work Studio',
        version: '0.1.0',
      },
    });
    this.send({ method: 'initialized', params: {} });
  }

  private request(method: string, params: JsonRecord): Promise<JsonRecord> {
    if (!this.process?.stdin.writable) {
      return Promise.reject(new AgentRuntimeError('PROVIDER_UNAVAILABLE', 'Codex app-server 未运行'));
    }
    const id = ++this.requestId;
    const promise = new Promise<JsonRecord>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new AgentRuntimeError('PROVIDER_UNAVAILABLE', `Codex 请求超时：${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
    });
    this.send({ method, id, params });
    return promise;
  }

  private send(message: JsonRecord): void {
    this.process?.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private receiveLine(line: string): void {
    let message: JsonRecord;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!isRecord(parsed)) return;
      message = parsed;
    } catch {
      return;
    }

    const id = typeof message.id === 'number' ? message.id : null;
    if (id !== null && ('result' in message || 'error' in message) && !message.method) {
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timeout);
      if (isRecord(message.error)) {
        pending.reject(new AgentRuntimeError(
          'PROVIDER_UNAVAILABLE',
          readString(message.error.message) ?? 'Codex 请求失败',
        ));
      } else {
        pending.resolve(isRecord(message.result) ? message.result : {});
      }
      return;
    }

    const serverRequestId = typeof message.id === 'number' || typeof message.id === 'string'
      ? message.id
      : null;
    if (serverRequestId !== null && typeof message.method === 'string') {
      if (this.receiveServerRequest(serverRequestId, message.method, isRecord(message.params) ? message.params : {})) {
        return;
      }
      this.send({
        id: serverRequestId,
        error: {
          code: -32601,
          message: 'XT Work Studio 暂不支持此交互请求',
        },
      });
      return;
    }

    if (typeof message.method === 'string') {
      this.receiveNotification(message.method, isRecord(message.params) ? message.params : {});
    }
  }

  private receiveServerRequest(
    serverRequestId: string | number,
    method: string,
    params: JsonRecord,
  ): boolean {
    if (
      method !== 'item/commandExecution/requestApproval'
      && method !== 'item/fileChange/requestApproval'
    ) return false;

    const threadId = readString(params.threadId);
    const active = threadId ? this.activeByThread.get(threadId) : undefined;
    if (!active) return false;
    const approvalId = String(serverRequestId);
    const command = readString(params.command);
    const reason = readString(params.reason);
    const kind = method.includes('commandExecution') ? 'command' : 'file-change';
    this.pendingApprovals.set(`${active.taskId}:${approvalId}`, {
      taskId: active.taskId,
      serverRequestId,
      approvalId,
      active,
    });
    active.emit({
      ...this.eventBase(active),
      type: 'approval.required',
      approvalId,
      kind,
      title: kind === 'command' ? '请求执行命令' : '请求修改文件',
      detail: command ?? reason,
    });
    return true;
  }

  private receiveNotification(method: string, params: JsonRecord): void {
    const threadId = readString(params.threadId)
      ?? (isRecord(params.turn) ? readString(params.turn.threadId) : undefined);
    const active = threadId ? this.activeByThread.get(threadId) : undefined;
    if (!active) return;

    if (method === 'item/agentMessage/delta') {
      const delta = readString(params.delta);
      if (!delta) return;
      active.receivedDelta = true;
      active.emit({ ...this.eventBase(active), type: 'message.delta', text: delta });
      return;
    }

    if (method === 'turn/plan/updated' && Array.isArray(params.plan)) {
      const detail = params.plan
        .map(entry => isRecord(entry) ? readString(entry.step) : undefined)
        .filter((step): step is string => Boolean(step))
        .join(' · ');
      active.emit({ ...this.eventBase(active), type: 'activity', title: '更新执行计划', detail });
      return;
    }

    if (method === 'item/started' && isRecord(params.item)) {
      const itemType = readString(params.item.type);
      if (itemType === 'commandExecution') {
        active.emit({
          ...this.eventBase(active),
          type: 'activity',
          title: '执行命令',
          detail: readString(params.item.command),
        });
      } else if (itemType === 'fileChange') {
        active.emit({ ...this.eventBase(active), type: 'activity', title: '应用代码变更' });
      } else if (itemType === 'mcpToolCall') {
        active.emit({
          ...this.eventBase(active),
          type: 'activity',
          title: `调用工具 ${readString(params.item.tool) ?? ''}`.trim(),
        });
      }
      return;
    }

    if (method === 'item/completed' && isRecord(params.item)) {
      if (params.item.type === 'agentMessage' && !active.receivedDelta) {
        const text = readString(params.item.text);
        if (text) active.emit({ ...this.eventBase(active), type: 'message.delta', text });
      }
      return;
    }

    if (method === 'error') {
      const error = isRecord(params.error) ? params.error : params;
      active.emit({
        ...this.eventBase(active),
        type: 'run.failed',
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: readString(error.message) ?? 'Codex 执行失败',
        },
      });
      this.finish(active);
      return;
    }

    if (method === 'turn/completed' && isRecord(params.turn)) {
      const status = readString(params.turn.status);
      if (status === 'failed') {
        const error = isRecord(params.turn.error) ? params.turn.error : {};
        active.emit({
          ...this.eventBase(active),
          type: 'run.failed',
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: readString(error.message) ?? 'Codex 执行失败',
          },
        });
      } else {
        active.emit({
          ...this.eventBase(active),
          type: 'run.completed',
          outcome: status === 'interrupted' ? 'interrupted' : 'completed',
        });
      }
      this.finish(active);
    }
  }

  private eventBase(active: ActiveTurn) {
    return {
      taskId: active.taskId,
      runId: active.runId,
      providerId: active.providerId,
    } as const;
  }

  private finish(active: ActiveTurn): void {
    this.activeByTask.delete(active.taskId);
    this.activeByThread.delete(active.threadId);
    for (const [key, approval] of this.pendingApprovals) {
      if (approval.taskId === active.taskId) this.pendingApprovals.delete(key);
    }
  }

  private handleExit(error: Error): void {
    this.process = null;
    this.startPromise = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    this.pending.clear();
    for (const active of this.activeByTask.values()) {
      active.emit({
        ...this.eventBase(active),
        type: 'run.failed',
        error: serializeAgentError(error),
      });
    }
    this.activeByTask.clear();
    this.activeByThread.clear();
    this.pendingApprovals.clear();
  }

  private async resolveExecutable(): Promise<string> {
    const candidates = [
      process.env.CODEX_PATH,
      '/opt/homebrew/bin/codex',
      '/usr/local/bin/codex',
      join(homedir(), '.local/bin/codex'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Continue through common installation locations before using PATH lookup.
      }
    }
    return 'codex';
  }
}
