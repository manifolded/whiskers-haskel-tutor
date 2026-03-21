import * as vscode from 'vscode';
import { notebookToCellMap } from './cellMap';

export type NotebookContextPayload = {
  notebookUri: string;
  cellMapText: string;
  activeCellIndex: number | null;
  activeCellId: string | null;
  selectionInActiveCell: { start: number; end: number } | null;
};

/**
 * When the chat webview has focus, `activeNotebookEditor` is often undefined even though a
 * notebook is still visible. If exactly one notebook editor is visible, use it for context.
 */
export function notebookEditorForContext(): vscode.NotebookEditor | undefined {
  const active = vscode.window.activeNotebookEditor;
  if (active) {
    return active;
  }
  const visible = vscode.window.visibleNotebookEditors;
  if (visible.length === 1) {
    return visible[0];
  }
  return undefined;
}

/**
 * Full notebook cell map + focus/selection (docs/notebook-code-targeting.md §2–3).
 */
export function buildNotebookContextPayload(): NotebookContextPayload {
  const ed = notebookEditorForContext();
  if (!ed) {
    return {
      notebookUri: '',
      cellMapText: '(no active notebook)',
      activeCellIndex: null,
      activeCellId: null,
      selectionInActiveCell: null,
    };
  }
  const doc = ed.notebook;
  const { serialized } = notebookToCellMap(doc);
  const uri = doc.uri.toString();
  const idx = ed.selection.start;
  const cell = doc.cellAt(idx);
  const meta = cell.metadata as { id?: string } | undefined;
  const id = meta?.id && typeof meta.id === 'string' ? meta.id : `cell-${idx}`;
  const te = vscode.window.activeTextEditor;
  let selectionInActiveCell: { start: number; end: number } | null = null;
  if (te && te.document.uri.toString() === cell.document.uri.toString()) {
    const s = te.selection;
    const start = cell.document.offsetAt(s.start);
    const end = cell.document.offsetAt(s.end);
    selectionInActiveCell = { start, end };
  }
  return {
    notebookUri: uri,
    cellMapText: serialized,
    activeCellIndex: idx,
    activeCellId: id,
    selectionInActiveCell,
  };
}

export function formatNotebookContextForPrompt(ctx: NotebookContextPayload): string {
  const sel =
    ctx.selectionInActiveCell !== null
      ? `start=${ctx.selectionInActiveCell.start} end=${ctx.selectionInActiveCell.end}`
      : 'none';
  return [
    `Notebook URI: ${ctx.notebookUri || '(none)'}`,
    `Active cell index: ${ctx.activeCellIndex ?? 'none'}`,
    `Active cell id: ${ctx.activeCellId ?? 'none'}`,
    `Selection offsets in active cell: ${sel}`,
    '',
    '--- Cell map ---',
    ctx.cellMapText,
  ].join('\n');
}
