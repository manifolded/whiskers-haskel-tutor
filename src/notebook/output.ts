import * as vscode from 'vscode';

function decodeItemData(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(data);
  } catch {
    return '';
  }
}

/** VS Code + Jupyter stream / error MIME types (IHaskell uses Jupyter stderr for GHC messages). */
const CAPTURE_MIMES = new Set([
  'text/plain',
  'text/html',
  'application/vnd.code.notebook.stdout',
  'application/vnd.code.notebook.stderr',
  'application/vnd.jupyter.stdout',
  'application/vnd.jupyter.stderr',
]);

function decodeNotebookError(data: Uint8Array): string {
  const raw = decodeItemData(data);
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o && typeof o === 'object') {
      const name = typeof o.name === 'string' ? o.name : '';
      const message = typeof o.message === 'string' ? o.message : '';
      const stack = typeof o.stack === 'string' ? o.stack : '';
      const line = [name, message].filter(Boolean).join(': ');
      const body = [line, stack].filter(Boolean).join('\n');
      if (body.length > 0) {
        return body;
      }
    }
  } catch {
    /* use raw */
  }
  return raw;
}

function appendOutputItem(item: vscode.NotebookCellOutputItem, parts: string[]): void {
  const mime = item.mime;
  const data = item.data as Uint8Array;
  if (mime === 'application/vnd.code.notebook.error') {
    parts.push(decodeNotebookError(data));
    return;
  }
  if (CAPTURE_MIMES.has(mime) || mime.startsWith('text/')) {
    parts.push(decodeItemData(data));
  }
}

/**
 * Serialize notebook cell outputs to plain text for debugging prompts.
 */
export function serializeCellOutputs(cell: vscode.NotebookCell): string {
  const parts: string[] = [];
  for (const output of cell.outputs) {
    for (const item of output.items) {
      appendOutputItem(item, parts);
    }
  }
  return parts.join('\n').trim();
}
