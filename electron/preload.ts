import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentEvent,
  AgentRunRequest,
  CompanyApiSettingsInput,
  WorkStudioApi,
} from '../src/shared/contracts';

const api: WorkStudioApi = {
  getHealth: () => ipcRenderer.invoke('app:get-health'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveCompanyApiSettings: (input: CompanyApiSettingsInput) =>
    ipcRenderer.invoke('settings:save-company-api', input),
  agent: {
    run: (input: AgentRunRequest) => ipcRenderer.invoke('agent:run', input),
    cancel: (taskId: string) => ipcRenderer.invoke('agent:cancel', taskId),
    resolveApproval: (taskId, approvalId, decision) =>
      ipcRenderer.invoke('agent:resolve-approval', taskId, approvalId, decision),
    onEvent: (listener: (event: AgentEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: AgentEvent) => listener(value);
      ipcRenderer.on('agent:event', handler);
      return () => ipcRenderer.removeListener('agent:event', handler);
    },
  },
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleFullScreen: () => ipcRenderer.send('window:toggle-full-screen'),
    close: () => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('workStudio', api);
