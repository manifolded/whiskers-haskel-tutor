import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Single-folder workspace: first workspace folder is the Whiskers project root.
 */
export function getProjectRootUri(): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri;
}

export function getProjectRootPath(): string | undefined {
  const u = getProjectRootUri();
  return u?.fsPath;
}

export function getWhiskersDir(): string | undefined {
  const root = getProjectRootPath();
  if (!root) {
    return undefined;
  }
  return path.join(root, '.whiskers');
}

export function getHistoryDbPath(): string | undefined {
  const d = getWhiskersDir();
  if (!d) {
    return undefined;
  }
  return path.join(d, 'history.sqlite');
}
