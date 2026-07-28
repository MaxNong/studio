import { create } from 'zustand';
import type { AgentEvent, ProviderId, SerializedError } from './shared/contracts';

export interface TaskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerId?: ProviderId;
}

export interface TaskActivity {
  id: string;
  title: string;
  detail?: string;
}

export interface TaskApproval {
  id: string;
  kind: 'command' | 'file-change';
  title: string;
  detail?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  objective: string;
  detail: string;
  time: string;
  status: 'running' | 'waiting' | 'completed';
  runStatus: 'starting' | 'running' | 'completed' | 'failed' | 'interrupted';
  providerId: ProviderId;
  activeRunId?: string;
  messages: TaskMessage[];
  activities: TaskActivity[];
  approvals: TaskApproval[];
  error?: SerializedError;
}

interface WorkspaceState {
  tasks: TaskRecord[];
  activeTaskId: string | null;
  inspectorCollapsed: boolean;
  providerId: ProviderId;
  setActiveTask(id: string): void;
  createTask(objective: string, providerId: ProviderId): string;
  appendUserMessage(taskId: string, content: string, providerId: ProviderId): void;
  applyAgentEvent(event: AgentEvent): void;
  markRunFailed(taskId: string, error: SerializedError): void;
  completeTask(taskId: string): void;
  reopenTask(taskId: string): void;
  toggleInspector(): void;
  setProvider(providerId: ProviderId): void;
}

export const useWorkspaceStore = create<WorkspaceState>(set => ({
  tasks: [],
  activeTaskId: null,
  inspectorCollapsed: false,
  providerId: 'local-codex',
  setActiveTask: activeTaskId => set({ activeTaskId }),
  createTask: (objective, providerId) => {
    const id = `task-${Date.now()}`;
    const normalized = objective.replace(/\s+/g, ' ').trim();
    const task: TaskRecord = {
      id,
      title: normalized.length > 20 ? `${normalized.slice(0, 20)}…` : normalized,
      objective: normalized,
      detail: '正在理解任务并制定计划',
      time: '刚刚',
      status: 'running',
      runStatus: 'starting',
      providerId,
      messages: [{
        id: `user-${Date.now()}`,
        role: 'user',
        content: objective.trim(),
      }],
      activities: [],
      approvals: [],
    };
    set(state => ({ tasks: [task, ...state.tasks], activeTaskId: id }));
    return id;
  },
  appendUserMessage: (taskId, content, providerId) => set(state => ({
    tasks: state.tasks.map(task => task.id === taskId ? {
      ...task,
      status: 'running',
      runStatus: 'starting',
      providerId,
      detail: '正在处理新的请求',
      error: undefined,
      messages: [...task.messages, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
      }],
    } : task),
  })),
  applyAgentEvent: event => set(state => ({
    tasks: state.tasks.map(task => {
      if (task.id !== event.taskId) return task;
      if (event.type === 'run.started') {
        return {
          ...task,
          activeRunId: event.runId,
          providerId: event.providerId,
          runStatus: 'running',
          status: 'running',
          detail: event.providerId === 'local-codex' ? '本地 Codex 正在执行' : '企业 API 正在生成回答',
          error: undefined,
          activities: [],
          approvals: [],
        };
      }
      if (task.activeRunId && task.activeRunId !== event.runId) return task;
      if (event.type === 'status') return { ...task, detail: event.text };
      if (event.type === 'activity') {
        return {
          ...task,
          detail: event.title,
          activities: [...task.activities, {
            id: `${event.runId}-${task.activities.length}`,
            title: event.title,
            detail: event.detail,
          }],
        };
      }
      if (event.type === 'approval.required') {
        return {
          ...task,
          detail: '等待你确认操作',
          approvals: [...task.approvals, {
            id: event.approvalId,
            kind: event.kind,
            title: event.title,
            detail: event.detail,
          }],
        };
      }
      if (event.type === 'approval.resolved') {
        return {
          ...task,
          detail: event.decision === 'accept' ? '已批准，继续执行' : '已拒绝，继续等待',
          approvals: task.approvals.filter(approval => approval.id !== event.approvalId),
        };
      }
      if (event.type === 'message.delta') {
        const messageId = `assistant-${event.runId}`;
        const existing = task.messages.find(message => message.id === messageId);
        return {
          ...task,
          detail: '正在生成回答',
          messages: existing
            ? task.messages.map(message => message.id === messageId
              ? { ...message, content: message.content + event.text }
              : message)
            : [...task.messages, {
              id: messageId,
              role: 'assistant',
              content: event.text,
              providerId: event.providerId,
            }],
        };
      }
      if (event.type === 'run.completed') {
        return {
          ...task,
          activeRunId: undefined,
          runStatus: event.outcome === 'interrupted' ? 'interrupted' : 'completed',
          status: event.outcome === 'interrupted' ? 'waiting' : 'running',
          detail: event.outcome === 'interrupted' ? '已停止，等待继续' : '本轮对话已结束，可继续追问',
          approvals: [],
        };
      }
      if (event.type === 'run.failed') {
        return {
          ...task,
          activeRunId: undefined,
          runStatus: 'failed',
          status: 'waiting',
          detail: event.error.message,
          error: event.error,
          approvals: [],
        };
      }
      return task;
    }),
  })),
  markRunFailed: (taskId, error) => set(state => ({
    tasks: state.tasks.map(task => task.id === taskId ? {
      ...task,
      activeRunId: undefined,
      runStatus: 'failed',
      status: 'waiting',
      detail: error.message,
      error,
    } : task),
  })),
  completeTask: taskId => set(state => ({
    tasks: state.tasks.map(task => {
      if (task.id !== taskId || task.activeRunId) return task;
      return {
        ...task,
        status: 'completed',
        detail: '任务已由你结束',
        time: '刚刚',
      };
    }),
  })),
  reopenTask: taskId => set(state => ({
    tasks: state.tasks.map(task => task.id === taskId ? {
      ...task,
      status: 'running',
      detail: '任务已重新打开，可继续追问',
      time: '刚刚',
    } : task),
  })),
  toggleInspector: () => set(state => ({ inspectorCollapsed: !state.inspectorCollapsed })),
  setProvider: providerId => set({ providerId }),
}));
