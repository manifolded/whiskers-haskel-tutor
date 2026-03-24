import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

function ensureOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Whiskers History Debug');
  }
  return outputChannel;
}

export type HistoryDebugConfig = {
  chatHistory: boolean;
  logToWorkspace: boolean;
  chatHistoryVerify: boolean;
};

export function getHistoryDebugConfig(): HistoryDebugConfig {
  const c = vscode.workspace.getConfiguration('whiskers.debug');
  return {
    chatHistory: c.get<boolean>('chatHistory') === true,
    logToWorkspace: c.get<boolean>('logToWorkspace') === true,
    chatHistoryVerify: c.get<boolean>('chatHistoryVerify') === true,
  };
}

function workspaceRootPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function appendNdjsonLine(line: string): void {
  const root = workspaceRootPath();
  if (!root) {
    return;
  }
  const dir = path.join(root, '.whiskers', 'debug');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'history-trace.ndjson'), line + '\n', 'utf8');
  } catch {
    /* avoid breaking extension on trace I/O failure */
  }
}

/**
 * Structured debug log when whiskers.debug.chatHistory is enabled.
 */
export function historyTrace(event: Record<string, unknown>): void {
  const cfg = getHistoryDebugConfig();
  if (!cfg.chatHistory) {
    return;
  }
  const line = JSON.stringify({ t: new Date().toISOString(), ...event });
  ensureOutputChannel().appendLine(line);
  if (cfg.logToWorkspace) {
    appendNdjsonLine(line);
  }
}

/**
 * Persist verify mismatch: visible when chatHistoryVerify is on (even if chatHistory is off).
 */
export function historyTraceVerifyMismatch(event: Record<string, unknown>): void {
  const cfg = getHistoryDebugConfig();
  if (!cfg.chatHistoryVerify) {
    return;
  }
  const line = JSON.stringify({ t: new Date().toISOString(), ...event });
  ensureOutputChannel().appendLine(line);
  if (cfg.chatHistory && cfg.logToWorkspace) {
    appendNdjsonLine(line);
  }
}

/** Persist failures: shown when chatHistory or chatHistoryVerify is enabled. */
export function historyTracePersistIssue(event: Record<string, unknown>): void {
  const cfg = getHistoryDebugConfig();
  if (!cfg.chatHistory && !cfg.chatHistoryVerify) {
    return;
  }
  const line = JSON.stringify({ t: new Date().toISOString(), ...event });
  ensureOutputChannel().appendLine(line);
  if (cfg.chatHistory && cfg.logToWorkspace) {
    appendNdjsonLine(line);
  }
}
