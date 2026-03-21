import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { type Database as SqlDatabase } from 'sql.js';
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

function persist(): void {
  if (!db || !dbFilePath) {
    return;
  }
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

export async function openHistoryDb(whiskersDir: string): Promise<SqlDatabase> {
  ensureDir(whiskersDir);
  const filePath = path.join(whiskersDir, 'history.sqlite');
  if (db && dbFilePath === filePath) {
    return db;
  }
  if (db) {
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
  let database: SqlDatabase;
  if (fs.existsSync(filePath)) {
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
  return database;
}

export function closeHistoryDb(): void {
  if (db) {
    try {
      persist();
      db.close();
    } catch {
      /* ignore */
    }
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
