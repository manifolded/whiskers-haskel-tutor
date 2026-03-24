import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { type Database as SqlDatabase } from 'sql.js';
import {
  getHistoryDebugConfig,
  historyTrace,
  historyTracePersistIssue,
  historyTraceVerifyMismatch,
} from '../debug/historyTrace';
import type { WhiskersMode } from '../modes';

export type StoredMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: WhiskersMode | null;
  created_at: number;
  metadata_json: string | null;
};

let db: SqlDatabase | undefined;
let dbFilePath: string | undefined;
let sqlModule: Awaited<ReturnType<typeof initSqlJs>> | undefined;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function countMessages(database: SqlDatabase): number {
  const stmt = database.prepare('SELECT COUNT(*) AS c FROM messages');
  stmt.step();
  const row = stmt.getAsObject() as { c: number | bigint };
  stmt.free();
  return Number(row.c);
}

export function listLastMessageMeta(
  database: SqlDatabase,
  limit: number
): { id: string; created_at: number }[] {
  const stmt = database.prepare(
    'SELECT id, created_at FROM messages ORDER BY created_at DESC LIMIT ?'
  );
  stmt.bind([limit]);
  const rows: { id: string; created_at: number }[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject() as { id: string; created_at: number };
    rows.push({ id: r.id, created_at: Number(r.created_at) });
  }
  stmt.free();
  return rows;
}

function persist(): void {
  if (!db || !dbFilePath) {
    return;
  }
  const cfg = getHistoryDebugConfig();
  const tracing = cfg.chatHistory;
  const verify = cfg.chatHistoryVerify;
  const rowCount = countMessages(db);
  try {
    const data = db.export();
    const exportBytes = data.byteLength;
    fs.writeFileSync(dbFilePath, Buffer.from(data));
    const st = fs.statSync(dbFilePath);
    if (tracing) {
      historyTrace({
        kind: 'persist',
        dbFilePath,
        exportBytes,
        fileSize: st.size,
        mtimeMs: st.mtimeMs,
        rowCount,
      });
    }
    if (verify && sqlModule) {
      const buf = fs.readFileSync(dbFilePath);
      const verifyDb = new sqlModule.Database(buf);
      const diskCount = countMessages(verifyDb);
      verifyDb.close();
      if (diskCount !== rowCount) {
        historyTraceVerifyMismatch({
          kind: 'persistVerifyMismatch',
          dbFilePath,
          inMemoryRowCount: rowCount,
          diskRowCount: diskCount,
        });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    historyTracePersistIssue({ kind: 'persistError', dbFilePath, error: msg, rowCount });
  }
}

export async function openHistoryDb(whiskersDir: string): Promise<SqlDatabase> {
  ensureDir(whiskersDir);
  const filePath = path.join(whiskersDir, 'history.sqlite');
  if (db && dbFilePath === filePath) {
    return db;
  }
  if (db) {
    const prevPath = dbFilePath;
    if (getHistoryDebugConfig().chatHistory) {
      historyTrace({
        kind: 'historyDbPathSwitch',
        warning:
          'Closing in-memory singleton for previous path without persist() on this branch; unflushed changes for that path may be lost',
        previousPath: prevPath,
        newPath: filePath,
        rowCountBeforeClose: countMessages(db),
      });
    }
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = undefined;
    dbFilePath = undefined;
  }
  if (!sqlModule) {
    sqlModule = await initSqlJs();
  }
  const fileExisted = fs.existsSync(filePath);
  const preReadSize = fileExisted ? fs.statSync(filePath).size : 0;
  let database: SqlDatabase;
  if (fileExisted) {
    const buf = fs.readFileSync(filePath);
    database = new sqlModule.Database(buf);
  } else {
    database = new sqlModule.Database();
  }
  database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      mode TEXT,
      created_at INTEGER NOT NULL,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  `);
  db = database;
  dbFilePath = filePath;
  persist();
  if (getHistoryDebugConfig().chatHistory) {
    historyTrace({
      kind: 'historyDbOpen',
      filePath,
      fileExisted,
      preReadSize,
      rowCountAfterInit: countMessages(database),
    });
  }
  return database;
}

export function closeHistoryDb(): void {
  const tracing = getHistoryDebugConfig().chatHistory;
  const closedPath = dbFilePath;
  if (db) {
    try {
      persist();
      db.close();
      if (tracing) {
        historyTrace({ kind: 'historyDbClose', dbFilePath: closedPath, note: 'persisted then closed' });
      }
    } catch (e) {
      if (tracing) {
        historyTrace({
          kind: 'historyDbCloseError',
          dbFilePath: closedPath,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } else if (tracing) {
    historyTrace({ kind: 'historyDbClose', note: 'no active singleton' });
  }
  db = undefined;
  dbFilePath = undefined;
}

export function appendMessage(
  database: SqlDatabase,
  row: Omit<StoredMessageRow, 'metadata_json'> & { metadata_json?: string | null }
): void {
  database.run(
    `INSERT INTO messages (id, role, content, mode, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.role,
      row.content,
      row.mode,
      row.created_at,
      row.metadata_json ?? null,
    ]
  );
  persist();
  if (getHistoryDebugConfig().chatHistory) {
    historyTrace({
      kind: 'appendMessage',
      id: row.id,
      role: row.role,
      created_at: row.created_at,
      rowCountAfter: countMessages(database),
    });
  }
}

export function listMessages(database: SqlDatabase, limit = 500): StoredMessageRow[] {
  const stmt = database.prepare(
    `SELECT id, role, content, mode, created_at, metadata_json FROM messages ORDER BY created_at ASC LIMIT ?`
  );
  stmt.bind([limit]);
  const rows: StoredMessageRow[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject() as unknown as StoredMessageRow;
    rows.push(r);
  }
  stmt.free();
  return rows;
}