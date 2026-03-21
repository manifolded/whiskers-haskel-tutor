# Helping the code-generation model target notebook cells

Models often struggle to insert or edit code in the right place in a Jupyter notebook because a **`.ipynb` is not a flat buffer of lines** — it is **JSON with many cells**. Naive edits break structure or land in the wrong cell. Address this by **changing what the model sees** (and, in a later phase, **how edits are applied**), not only by prompting harder.

## 1. Give the model a cell map, not a raw file dump

A **cell map** is our intermediate representation of a notebook for the model: an ordered **list of cells** with stable addressing — **not** the raw `.ipynb` JSON on disk. Build the cell map from the VS Code notebook / Jupyter model and serialize it for the prompt (plain text, JSON, or both).

Each cell in the map includes:

- **Cell ID** — In nbformat ≥4.5, cells can have an `id`. Use it when present; generate and persist one if missing.
- **Index** — 0-based position in the notebook.
- **Type** — `code` vs `markdown`.
- **Source** — A **single string** per cell (with explicit newlines), with **line numbers always scoped to that cell only** (never notebook-global line numbers).

Conceptual example for the prompt:

```text
[Cell 2 | id: c7f3a1 | code | exec: 3]
   1| module Main where
   2| main = putStrLn "hi"
```

That makes instructions like “put the new helper **above** `main`” unambiguous.

## 2. Always include focus and selection from the editor

From the VS Code **Notebook API** (and/or the Jupyter extension), pass:

- **Active cell** — index and id.
- **Current selection** within that cell — start/end offset or line:column within **cell source**.
- **Notebook URI** — Always pass it so the target notebook is unambiguous when multiple `.ipynb` files are open.

The model’s job becomes “edit **this** cell’s text here,” not “guess which JSON blob.”

## 3. Whole notebook for the initial release

For now, pass the **entire notebook** as a **cell map** (§1) — not a neighbor window or truncated view — together with **focus and selection** from §2 (active cell, selection within the cell, notebook URI). Context-window optimization (sending only nearby cells) is **future work**; see below.

## 4. Haskell / IHaskell: respect cell boundaries

IHaskell cells are separate compilable chunks. **Top-level placement** matters (e.g. where `import` is valid). Labeling cells in the prompt (“definitions”, “scratch”, “experiments”) reduces misplaced inserts.

## 5. Why models fail here

Common causes:

- **Flattened or truncated** views where editor line numbers do not match any single cell.
- **Full-notebook JSON** edits — easy to corrupt, hard to target.
- **No active cell** in context — the model picks a plausible but wrong cell.

## Summary

Help the code-generation model by:

1. Addressing **cells by id/index** with **per-cell** line labels.
2. Sending **active selection** and **notebook URI**.
3. Including the **full notebook** (cell map) plus that focus/selection — not partial windows for now.
4. Calling out **IHaskell cell boundaries** when placement matters.

**Neighbor-only context** and automatic **insertion** / **structured apply** payloads are deferred — see **Future work** below.

## Future work

The initial release uses the **whole notebook** plus **focus/selection**. The items below are **out of scope** until we implement them.

### Retrieve neighbors, not always the whole notebook

Send:

- The active cell plus **±1 or ±2** adjacent cells for context.
- Plus **imports / first code cell** when the edit might need language pragmas or imports.

Load more cells only when the user asks for a refactor across the notebook.

### Apply edits per cell, not as free-form `.ipynb` text

**High-friction pattern:** The model returns a full `.ipynb` or a large JSON patch.

**Low-friction pattern:** The model returns **structured operations** on **one cell’s `source`**:

- `replace_cell_source(cellId | index, newSource)`
- `insert_cell_after(index, kind, source)`
- `delete_cell(index)` — use sparingly; consider requiring confirmation.

The extension applies these via **`WorkspaceEdit`** / notebook APIs so the file stays valid JSON.

### Prefer structured output (tools / JSON schema)

Ask for machine-readable output, for example:

```json
{
  "target": { "cellId": "c7f3a1" },
  "action": "replace_whole_cell",
  "source": "..."
}
```

For partial edits, use a **unified diff** or **line-range replace** scoped to **that cell’s source string** only — not to the whole notebook file.

When this ships, the extension should own **mapping structured actions → Notebook API edits**; the model only decides *what* to change in *which* cell.
