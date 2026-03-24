import * as fs from 'fs';
import initSqlJs, { type Database as SqlDatabase } from 'sql.js';
import type { StoredMessageRow } from '../storage/sqlite';

let sqlModule: Awaited<ReturnType<typeof initSqlJs>> | undefined;

/**
 * Open an existing history.sqlite file read-only (no writes, no extension singleton).
 */
export async function openHistoryReadOnly(dbPath: string): Promise<SqlDatabase> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`History database not found: ${dbPath}`);
  }
  if (!sqlModule) {
    sqlModule = await initSqlJs();
  }
  const buf = fs.readFileSync(dbPath);
  return new sqlModule.Database(buf);
}

export function closeReadOnlyDb(database: SqlDatabase): void {
  try {
    database.close();
  } catch {
    /* ignore */
  }
}

export type ListMessagesOptions = {
  limit: number;
  userOnly?: boolean;
};

export function listMessagesReadOnly(database: SqlDatabase, options: ListMessagesOptions): StoredMessageRow[] {
  const { limit, userOnly } = options;
  let sql = `SELECT id, role, content, mode, created_at, metadata_json FROM messages`;
  if (userOnly) {
    sql += ` WHERE role = 'user'`;
  }
  sql += ` ORDER BY created_at ASC LIMIT ?`;
  const stmt = database.prepare(sql);
  stmt.bind([limit]);
  const rows: StoredMessageRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as StoredMessageRow);
  }
  stmt.free();
  return rows;
}
