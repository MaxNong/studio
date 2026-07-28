export type ProviderId = 'local-codex' | 'company-api';

export interface ProviderHealth {
  id: ProviderId;
  status: 'connected' | 'not_configured' | 'unavailable';
  label: string;
  detail?: string;
}

export interface AppHealth {
  appVersion: string;
  platform: NodeJS.Platform;
  providers: Record<ProviderId, ProviderHealth>;
}

export interface SettingsSnapshot {
  companyApi: {
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
  };
}

export interface CompanyApiSettingsInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface SerializedError {
  code: 'VALIDATION_FAILED' | 'NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE' | 'RUN_ACTIVE' | 'UNKNOWN';
  message: string;
}

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: SerializedError };

export interface AgentRunRequest {
  taskId: string;
  prompt: string;
  providerId: ProviderId;
}

export interface AgentRunAccepted {
  runId: string;
}

interface AgentEventBase {
  taskId: string;
  runId: string;
  providerId: ProviderId;
}

export type AgentEvent =
  | (AgentEventBase & { type: 'run.started' })
  | (AgentEventBase & { type: 'status'; text: string })
  | (AgentEventBase & { type: 'message.delta'; text: string })
  | (AgentEventBase & { type: 'activity'; title: string; detail?: string })
  | (AgentEventBase & {
    type: 'approval.required';
    approvalId: string;
    kind: 'command' | 'file-change';
    title: string;
    detail?: string;
  })
  | (AgentEventBase & { type: 'approval.resolved'; approvalId: string; decision: 'accept' | 'decline' })
  | (AgentEventBase & { type: 'run.completed'; outcome: 'completed' | 'interrupted' })
  | (AgentEventBase & { type: 'run.failed'; error: SerializedError });

export interface WorkStudioApi {
  getHealth(): Promise<AppHealth>;
  getSettings(): Promise<SettingsSnapshot>;
  saveCompanyApiSettings(input: CompanyApiSettingsInput): Promise<SettingsSnapshot>;
  agent: {
    run(input: AgentRunRequest): Promise<IpcResult<AgentRunAccepted>>;
    cancel(taskId: string): Promise<IpcResult<{ cancelled: boolean }>>;
    resolveApproval(
      taskId: string,
      approvalId: string,
      decision: 'accept' | 'decline',
    ): Promise<IpcResult<{ resolved: boolean }>>;
    onEvent(listener: (event: AgentEvent) => void): () => void;
  };
  windowControls: {
    minimize(): void;
    toggleFullScreen(): void;
    close(): void;
  };
}
