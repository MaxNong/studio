import { z } from 'zod';
import type {
  AgentEvent,
  AgentRunAccepted,
  AgentRunRequest,
  IpcResult,
} from '../src/shared/contracts';
import { CodexAppServer } from './agents/codex-app-server';
import { CompanyApiAgent } from './agents/company-api-agent';
import { AgentRuntimeError, fail, ok } from './agents/errors';

const runSchema = z.object({
  taskId: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(100_000),
  providerId: z.enum(['local-codex', 'company-api']),
});

type EmitAgentEvent = (event: AgentEvent) => void;

export class AgentRuntime {
  readonly codex = new CodexAppServer();
  private readonly company = new CompanyApiAgent();

  async run(rawInput: AgentRunRequest, emit: EmitAgentEvent): Promise<IpcResult<AgentRunAccepted>> {
    try {
      const input = runSchema.parse(rawInput);
      const accepted = input.providerId === 'local-codex'
        ? await this.codex.run(input, emit)
        : await this.company.run(input, emit);
      return ok(accepted);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail(new AgentRuntimeError('VALIDATION_FAILED', error.issues[0]?.message ?? '任务参数无效'));
      }
      return fail(error);
    }
  }

  async cancel(taskId: string): Promise<IpcResult<{ cancelled: boolean }>> {
    try {
      const normalizedTaskId = z.string().trim().min(1).max(160).parse(taskId);
      const companyCancelled = this.company.cancel(normalizedTaskId);
      const codexCancelled = await this.codex.cancel(normalizedTaskId);
      return ok({ cancelled: companyCancelled || codexCancelled });
    } catch (error) {
      return fail(error);
    }
  }

  resolveApproval(
    taskId: string,
    approvalId: string,
    decision: 'accept' | 'decline',
  ): IpcResult<{ resolved: boolean }> {
    try {
      const normalizedTaskId = z.string().trim().min(1).max(160).parse(taskId);
      const normalizedApprovalId = z.string().trim().min(1).max(160).parse(approvalId);
      const normalizedDecision = z.enum(['accept', 'decline']).parse(decision);
      return ok({
        resolved: this.codex.resolveApproval(
          normalizedTaskId,
          normalizedApprovalId,
          normalizedDecision,
        ),
      });
    } catch (error) {
      return fail(error);
    }
  }

  dispose(): void {
    this.codex.dispose();
  }
}
