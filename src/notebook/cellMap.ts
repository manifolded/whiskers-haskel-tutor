import * as vscode from 'vscode';

export type CellMapCell = {
  index: number;
  id: string;
  kind: 'code' | 'markdown';
  source: string;
};

export type CellMapResult = {
  cells: CellMapCell[];
  serialized: string;
};

function cellId(cell: vscode.NotebookCell, index: number): string {
  const meta = cell.metadata as { id?: string } | undefined;
  if (meta?.id && typeof meta.id === 'string') {
    return meta.id;
  }
  return `cell-${index}`;
}

function lineNumberBlock(source: string): string {
  const lines = source.split('\n');
  return lines.map((line, i) => `   ${i + 1}| ${line}`).join('\n');
}

/**
 * Build a **cell map** (see docs/notebook-code-targeting.md): ordered cells with per-cell line numbers.
 */
export function notebookToCellMap(doc: vscode.NotebookDocument): CellMapResult {
  const cells: CellMapCell[] = [];
  const parts: string[] = [];
  const rawCells = doc.getCells();
  for (let i = 0; i < rawCells.length; i++) {
    const c = rawCells[i];
    const id = cellId(c, i);
    const kind = c.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code';
    const source = c.document.getText();
    cells.push({ index: i, id, kind, source });
    const execOrder = c.executionSummary?.executionOrder;
    const exec =
      execOrder !== undefined && execOrder !== null ? `exec: ${execOrder}` : 'exec: —';
    const header = `[Cell ${i} | id: ${id} | ${kind} | ${exec}]`;
    parts.push(header);
    parts.push(lineNumberBlock(source));
    parts.push('');
  }
  return { cells, serialized: parts.join('\n').trimEnd() };
}
