import type { WorkStudioApi } from './shared/contracts';

declare global {
  interface Window {
    workStudio: WorkStudioApi;
  }
}

export {};
