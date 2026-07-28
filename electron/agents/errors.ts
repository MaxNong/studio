import type { IpcResult, SerializedError } from '../../src/shared/contracts';

export class AgentRuntimeError extends Error {
  constructor(
    public readonly code: SerializedError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'AgentRuntimeError';
  }
}

export const serializeAgentError = (error: unknown): SerializedError => {
  if (error instanceof AgentRuntimeError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN', message: error.message };
  }
  return { code: 'UNKNOWN', message: String(error) };
};

export const ok = <T>(data: T): IpcResult<T> => ({ success: true, data });

export const fail = <T = never>(error: unknown): IpcResult<T> => ({
  success: false,
  error: serializeAgentError(error),
});
