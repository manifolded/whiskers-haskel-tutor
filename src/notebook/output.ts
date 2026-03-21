import * as vscode from 'vscode';

function decodeItemData(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(data);
  } catch {
    return '';
  }
}

/**
 * Serialize notebook cell outputs to plain text for debugging prompts.
 */
export function serializeCellOutputs(cell: vscode.NotebookCell): string {
  const parts: string[] = [];
  for (const output of cell.outputs) {
    for (const item of output.items) {
      if (item.mime === 'text/plain' || item.mime === 'text/html' || item.mime === 'application/vnd.code.notebook.stderr') {
        parts.push(decodeItemData(item.data as Uint8Array));
      } else if (item.mime.startsWith('text/')) {
        parts.push(decodeItemData(item.data as Uint8Array));
      }
    }
  }
  return parts.join('\n').trim();
}
