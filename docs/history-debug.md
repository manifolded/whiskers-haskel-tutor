# Chat history debug tools

Whiskers stores tutor chat in `<workspace>/.whiskers/history.sqlite`. If messages go missing from that file (not just from the UI), use the settings and command below to capture a timeline of opens, inserts, and disk writes.

## Settings

Open **Settings** and search for `whiskers debug`, or add to your `settings.json`:

| Setting | Purpose |
|--------|---------|
| `whiskers.debug.chatHistory` | When `true`, logs JSON lines to the **Whiskers History Debug** output channel. Optionally also writes NDJSON to the workspace (next row). |
| `whiskers.debug.logToWorkspace` | When `true` **and** `chatHistory` is `true`, appends each event as one line to `.whiskers/debug/history-trace.ndjson` under the **first** workspace folder. |
| `whiskers.debug.chatHistoryVerify` | After each `persist`, reloads `history.sqlite` from disk in a separate database and compares row counts to memory. Mismatches are written to **Whiskers History Debug** even if `chatHistory` is `false`. Persist errors are shown when either `chatHistory` or `chatHistoryVerify` is on. |

Defaults are `false` for all three. Turn tracing on **before** reproducing the issue, then leave it on until you have captured the session.

## Viewing logs

1. **Command Palette** → **Output: Focus on Output View**.
2. In the output dropdown, choose **Whiskers History Debug**.

Each line is a JSON object. Every event includes an ISO timestamp in `t`. Other fields depend on the event `kind` (see below).

## Workspace NDJSON file

With `chatHistory` and `logToWorkspace` enabled, events are appended to:

`<workspaceRoot>/.whiskers/debug/history-trace.ndjson`

Useful if you need a file to attach to an issue or to grep after a crash. Consider adding `.whiskers/debug/` to `.gitignore` in **your project** if you do not want traces committed.

## Command: copy snapshot to clipboard

**Command Palette** → **Whiskers: Copy Chat History Debug Info** (`whiskers.copyHistoryDebugInfo`).

This does **not** require debug settings. It copies a plain-text summary:

- Workspace root and absolute path to `history.sqlite`
- File size and modification time
- Total row count in `messages`
- Up to eight newest messages (id and `created_at` as ISO time), newest first

Use it right after you notice data loss to freeze what is on disk at that moment.

## Event kinds (reference)

When `whiskers.debug.chatHistory` is on, you may see these `kind` values:

| `kind` | Meaning |
|--------|---------|
| `panelCreate` / `panelDispose` | Chat panel opened or closed (`sessionId` correlates panel lifetime). |
| `panelGetDb` | First successful DB open for this panel (`dbPath`, `workspaceRoot`, `rowCount`). |
| `handleSend` | High-level send flow; check `phase`: `userAppended`, `streamFinishedOk`, `assistantAppended`, `postHistoryAfterSend`, `streamError`. Includes `rowCount` where relevant. |
| `historyDbOpen` | DB opened for a path (`filePath`, `fileExisted`, `preReadSize`, `rowCountAfterInit`). |
| `historyDbPathSwitch` | Singleton DB was switched to another file without `persist()` on the old path first (possible data loss if something was only in memory). |
| `historyDbClose` / `historyDbCloseError` | Extension deactivated or DB closed (`persist` runs before close on the normal path). |
| `appendMessage` | Row inserted (`id`, `role`, `created_at`, `rowCountAfter`). |
| `persist` | After `writeFileSync` (`dbFilePath`, `exportBytes`, `fileSize`, `mtimeMs`, `rowCount`). |

Verify / error events:

| `kind` | Meaning |
|--------|---------|
| `persistVerifyMismatch` | Read-back row count on disk ≠ in-memory count (`inMemoryRowCount`, `diskRowCount`). Requires `chatHistoryVerify`. |
| `persistError` | Exception during export or write. |

## Cross-check with the dump CLI

From the extension repo, you can dump the same SQLite file to JSON or Markdown (separate from VS Code):

```bash
npm run compile:ext
npm run dump-history -- /path/to/your/workspace
```

See `whiskers-dump-history --help` for `--limit`, `--user-only`, and output formats.

## Interpreting traces after data loss

- Find the **last** `appendMessage` or `persist` with a `rowCount` that still matches what you expect, then see whether a later `historyDbOpen` shows a **lower** `rowCountAfterInit` (suggests the file on disk was overwritten or truncated).
- A **`persistVerifyMismatch`** right after normal use points to a partial or inconsistent write.
- Multiple **`historyDbPathSwitch`** events without changing folders may indicate workspace root confusion (only the first workspace folder is used for `.whiskers`).
