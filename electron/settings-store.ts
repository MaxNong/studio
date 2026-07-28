import { app, safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { CompanyApiSettingsInput, SettingsSnapshot } from '../src/shared/contracts';

const inputSchema = z.object({
  baseUrl: z.string().trim().url().or(z.literal('')),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(1).max(4096).optional(),
});

interface StoredSettings {
  companyApi: {
    baseUrl: string;
    model: string;
    encryptedApiKey?: string;
  };
}

export interface CompanyApiCredentials {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const defaults: StoredSettings = {
  companyApi: {
    baseUrl: '',
    model: 'company-reasoning',
  },
};

const settingsPath = () => join(app.getPath('userData'), 'settings.json');

const readStoredSettings = async (): Promise<StoredSettings> => {
  try {
    return JSON.parse(await readFile(settingsPath(), 'utf8')) as StoredSettings;
  } catch {
    return defaults;
  }
};

const toSnapshot = (settings: StoredSettings): SettingsSnapshot => ({
  companyApi: {
    baseUrl: settings.companyApi.baseUrl,
    model: settings.companyApi.model,
    hasApiKey: Boolean(settings.companyApi.encryptedApiKey),
  },
});

export const getSettings = async (): Promise<SettingsSnapshot> => toSnapshot(await readStoredSettings());

export const getCompanyApiCredentials = async (): Promise<CompanyApiCredentials | null> => {
  const settings = await readStoredSettings();
  const encryptedApiKey = settings.companyApi.encryptedApiKey;
  if (!settings.companyApi.baseUrl || !encryptedApiKey || !safeStorage.isEncryptionAvailable()) {
    return null;
  }

  return {
    baseUrl: settings.companyApi.baseUrl,
    model: settings.companyApi.model,
    apiKey: safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64')),
  };
};

export const saveCompanyApiSettings = async (
  rawInput: CompanyApiSettingsInput,
): Promise<SettingsSnapshot> => {
  const input = inputSchema.parse(rawInput);
  const current = await readStoredSettings();
  let encryptedApiKey = current.companyApi.encryptedApiKey;

  if (input.apiKey) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('当前系统安全存储不可用，无法保存公司 API Key');
    }
    encryptedApiKey = safeStorage.encryptString(input.apiKey).toString('base64');
  }

  const next: StoredSettings = {
    companyApi: {
      baseUrl: input.baseUrl,
      model: input.model,
      encryptedApiKey,
    },
  };

  await mkdir(dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return toSnapshot(next);
};
