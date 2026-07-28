import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import type { AgentRunRequest, AppHealth, CompanyApiSettingsInput } from '../src/shared/contracts';
import { AgentRuntime } from './agent-runtime';
import { getSettings, saveCompanyApiSettings } from './settings-store';

app.name = 'XT Work Studio';
const agentRuntime = new AgentRuntime();

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1510,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    title: 'XT Work Studio',
    backgroundColor: '#0b0c0e',
    frame: false,
    roundedCorners: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

const registerIpc = () => {
  ipcMain.handle('app:get-health', async (): Promise<AppHealth> => {
    const [codex, settings] = await Promise.all([agentRuntime.codex.probe(), getSettings()]);
    return {
      appVersion: app.getVersion(),
      platform: process.platform,
      providers: {
        'local-codex': {
          id: 'local-codex',
          status: codex.available ? 'connected' : 'unavailable',
          label: '本地 Codex',
          detail: codex.detail,
        },
        'company-api': {
          id: 'company-api',
          status: settings.companyApi.hasApiKey && settings.companyApi.baseUrl
            ? 'connected'
            : 'not_configured',
          label: '公司 API',
        },
      },
    };
  });
  ipcMain.handle('settings:get', getSettings);
  ipcMain.handle(
    'settings:save-company-api',
    (_event, input: CompanyApiSettingsInput) => saveCompanyApiSettings(input),
  );
  ipcMain.handle('agent:run', (event, input: AgentRunRequest) => {
    const target = BrowserWindow.fromWebContents(event.sender);
    return agentRuntime.run(input, agentEvent => {
      if (target && !target.isDestroyed()) target.webContents.send('agent:event', agentEvent);
    });
  });
  ipcMain.handle('agent:cancel', (_event, taskId: string) => agentRuntime.cancel(taskId));
  ipcMain.handle(
    'agent:resolve-approval',
    (_event, taskId: string, approvalId: string, decision: 'accept' | 'decline') =>
      agentRuntime.resolveApproval(taskId, approvalId, decision),
  );
  ipcMain.on('window:minimize', event => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('window:toggle-full-screen', event => {
    const target = BrowserWindow.fromWebContents(event.sender);
    if (!target) return;
    if (process.platform === 'darwin') {
      target.setFullScreen(!target.isFullScreen());
      return;
    }
    if (target.isMaximized()) target.unmaximize();
    else target.maximize();
  });
  ipcMain.on('window:close', event => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
};

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  agentRuntime.dispose();
});
