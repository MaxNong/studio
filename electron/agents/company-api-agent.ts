import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { randomUUID } from 'node:crypto';
import type { AgentEvent, AgentRunAccepted, AgentRunRequest } from '../../src/shared/contracts';
import { getCompanyApiCredentials } from '../settings-store';
import { AgentRuntimeError, serializeAgentError } from './errors';

type EmitAgentEvent = (event: AgentEvent) => void;

const checkpointer = new MemorySaver();

const readTokenText = (token: unknown): string => {
  if (!token || typeof token !== 'object') return '';
  const message = token as {
    content?: unknown;
    contentBlocks?: Array<{ type?: string; text?: string }>;
  };
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          return typeof block.text === 'string' ? block.text : '';
        }
        return '';
      })
      .join('');
  }
  return message.contentBlocks
    ?.filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('') ?? '';
};

export class CompanyApiAgent {
  private readonly activeRuns = new Map<string, AbortController>();

  async run(input: AgentRunRequest, emit: EmitAgentEvent): Promise<AgentRunAccepted> {
    if (this.activeRuns.has(input.taskId)) {
      throw new AgentRuntimeError('RUN_ACTIVE', '当前任务已有一轮对话正在执行');
    }

    const credentials = await getCompanyApiCredentials();
    if (!credentials) {
      throw new AgentRuntimeError('NOT_CONFIGURED', '请先在设置中配置公司 API 网关和 API Key');
    }

    const runId = randomUUID();
    const controller = new AbortController();
    this.activeRuns.set(input.taskId, controller);
    emit({ type: 'run.started', taskId: input.taskId, runId, providerId: input.providerId });

    const model = new ChatOpenAI({
      apiKey: credentials.apiKey,
      model: credentials.model,
      streaming: true,
      streamUsage: false,
      maxRetries: 2,
      timeout: 120_000,
      configuration: {
        baseURL: credentials.baseUrl,
      },
    });
    const agent = createAgent({
      model,
      tools: [],
      checkpointer,
      systemPrompt: '你是 XT Work Studio 的企业助手。使用中文给出准确、可执行的回答；缺少必要资料时明确说明，不要虚构内部信息。',
    });

    void (async () => {
      try {
        emit({
          type: 'status',
          taskId: input.taskId,
          runId,
          providerId: input.providerId,
          text: `正在调用 ${credentials.model}`,
        });
        const stream = await agent.stream(
          { messages: [{ role: 'user', content: input.prompt }] },
          {
            configurable: { thread_id: input.taskId },
            streamMode: 'messages',
            signal: controller.signal,
            recursionLimit: 24,
          },
        );
        for await (const chunk of stream) {
          const pair = chunk as [unknown, { langgraph_node?: string }];
          const text = readTokenText(pair[0]);
          if (text) {
            emit({
              type: 'message.delta',
              taskId: input.taskId,
              runId,
              providerId: input.providerId,
              text,
            });
          }
        }
        emit({
          type: 'run.completed',
          taskId: input.taskId,
          runId,
          providerId: input.providerId,
          outcome: controller.signal.aborted ? 'interrupted' : 'completed',
        });
      } catch (error) {
        if (controller.signal.aborted) {
          emit({
            type: 'run.completed',
            taskId: input.taskId,
            runId,
            providerId: input.providerId,
            outcome: 'interrupted',
          });
        } else {
          emit({
            type: 'run.failed',
            taskId: input.taskId,
            runId,
            providerId: input.providerId,
            error: serializeAgentError(error),
          });
        }
      } finally {
        this.activeRuns.delete(input.taskId);
      }
    })();

    return { runId };
  }

  cancel(taskId: string): boolean {
    const controller = this.activeRuns.get(taskId);
    if (!controller) return false;
    controller.abort();
    return true;
  }
}
