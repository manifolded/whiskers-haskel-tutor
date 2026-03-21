import * as vscode from 'vscode';
import type { WhiskersMode } from './modes';

export type LmStudioConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ReplicateConfig = {
  model: string;
  apiToken: string;
};

export type ConfigError = { ok: false; message: string };

export type CoachTutorConfigOk = { ok: true; lmStudio: LmStudioConfig };

export type CodeGenConfigOk = { ok: true; replicate: ReplicateConfig };

function nonEmpty(s: string | undefined): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function readLmFromSettings(): CoachTutorConfigOk | ConfigError {
  const ws = vscode.workspace.getConfiguration('whiskers');
  const baseUrl = ws.get<string>('lmStudio.baseUrl');
  const apiKey = ws.get<string>('lmStudio.apiKey') ?? '';
  const lmModel = ws.get<string>('lmStudio.model');

  if (!nonEmpty(baseUrl)) {
    return { ok: false, message: 'Setting whiskers.lmStudio.baseUrl is required (OpenAI-compatible coach/tutor URL).' };
  }
  if (!nonEmpty(lmModel)) {
    return { ok: false, message: 'Setting whiskers.lmStudio.model is required.' };
  }

  return {
    ok: true,
    lmStudio: {
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: lmModel.trim(),
    },
  };
}

/**
 * Coach, challenge, quiz — LM Studio / OpenAI-compatible only.
 */
export function loadCoachTutorConfig(): ConfigError | CoachTutorConfigOk {
  const r = readLmFromSettings();
  if (!r.ok) {
    return r;
  }
  return r;
}

/**
 * Generation + debugging — Replicate model id + API token (SecretStorage).
 */
export async function loadCodeGenConfig(
  secrets: vscode.SecretStorage
): Promise<ConfigError | CodeGenConfigOk> {
  const ws = vscode.workspace.getConfiguration('whiskers');
  const replicateModel = ws.get<string>('replicate.model');
  if (!nonEmpty(replicateModel)) {
    return { ok: false, message: 'Setting whiskers.replicate.model is required.' };
  }
  const apiToken = await secrets.get('whiskers.replicate.apiToken');
  if (!nonEmpty(apiToken)) {
    return {
      ok: false,
      message:
        'Replicate API token is not set. Run command "Whiskers: Set Replicate API Token".',
    };
  }
  return {
    ok: true,
    replicate: { model: replicateModel.trim(), apiToken: apiToken.trim() },
  };
}

/**
 * Load everything needed for `mode` (**fails closed** with a clear message).
 */
export async function loadConfigForMode(
  mode: WhiskersMode,
  secrets: vscode.SecretStorage
): Promise<ConfigError | CoachTutorConfigOk | CodeGenConfigOk> {
  if (mode === 'coach' || mode === 'challenge' || mode === 'quiz') {
    return loadCoachTutorConfig();
  }
  if (mode === 'generation' || mode === 'debugging') {
    return loadCodeGenConfig(secrets);
  }
  return { ok: false, message: `Unknown mode: ${mode}` };
}
