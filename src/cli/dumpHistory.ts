import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'node:util';
import type { StoredMessageRow } from '../storage/sqlite';
import { closeReadOnlyDb, listMessagesReadOnly, openHistoryReadOnly } from './historyDb';

const DEFAULT_LIMIT = 100_000;

function usage(): string {
  return `Usage: whiskers-dump-history <workspace> [options]

Dump Whiskers chat history from <workspace>/.whiskers/history.sqlite into the current directory (or stdout with -r).

Options:
  -u, --user-only        Only messages with role user
  -t, --timestamps-only  Only timestamps (plain ISO lines, or Markdown list with -m)
  -m, --markdown         Markdown output (full transcript, or human-readable times with -t)
  -r, --read             Write to stdout instead of a file
      --limit <n>        Max rows (default ${DEFAULT_LIMIT})
  -h, --help             Show this help

Default output file (no -r): whiskers-history-dump.json, or .md with -m (full transcript), or
whiskers-history-timestamps.txt with -t only, or whiskers-history-timestamps.md with -t -m.
`;
}

function formatFullJson(rows: StoredMessageRow[]): string {
  return JSON.stringify(rows, null, 2) + '\n';
}

function formatFullMarkdown(rows: StoredMessageRow[]): string {
  const lines: string[] = ['# Whiskers chat history', ''];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const when = new Date(r.created_at).toISOString();
    lines.push(`## Message ${i + 1}`, '');
    lines.push(`- **When:** ${when}`);
    lines.push(`- **Role:** ${r.role}`);
    lines.push(`- **Mode:** ${r.mode ?? '(none)'}`);
    lines.push('');
    if (r.content.includes('\n')) {
      lines.push('```', r.content, '```', '');
    } else {
      lines.push(r.content, '');
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

function formatTimestampsPlain(rows: StoredMessageRow[]): string {
  return rows.map((r) => new Date(r.created_at).toISOString()).join('\n') + (rows.length ? '\n' : '');
}

function formatTimestampsMarkdown(rows: StoredMessageRow[]): string {
  const lines = rows.map((r) => `- ${new Date(r.created_at).toLocaleString()}`);
  return lines.length ? lines.join('\n') + '\n' : '';
}

function outputPath(cwd: string, markdown: boolean, timestampsOnly: boolean): string {
  if (timestampsOnly) {
    return path.join(cwd, markdown ? 'whiskers-history-timestamps.md' : 'whiskers-history-timestamps.txt');
  }
  return path.join(cwd, markdown ? 'whiskers-history-dump.md' : 'whiskers-history-dump.json');
}

function serialize(
  rows: StoredMessageRow[],
  markdown: boolean,
  timestampsOnly: boolean
): string {
  if (timestampsOnly) {
    return markdown ? formatTimestampsMarkdown(rows) : formatTimestampsPlain(rows);
  }
  return markdown ? formatFullMarkdown(rows) : formatFullJson(rows);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      'user-only': { type: 'boolean', short: 'u' },
      'timestamps-only': { type: 'boolean', short: 't' },
      markdown: { type: 'boolean', short: 'm' },
      read: { type: 'boolean', short: 'r' },
      limit: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    process.stdout.write(usage());
    process.exit(0);
  }

  const workspace = positionals[0];
  if (!workspace) {
    process.stderr.write(usage());
    process.stderr.write('\nError: missing <workspace> path.\n');
    process.exit(1);
  }

  const limitRaw = values.limit;
  const limit = limitRaw !== undefined ? parseInt(limitRaw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) {
    process.stderr.write('Error: --limit must be a positive integer.\n');
    process.exit(1);
  }

  const userOnly = values['user-only'] === true;
  const timestampsOnly = values['timestamps-only'] === true;
  const markdown = values.markdown === true;
  const readStdout = values.read === true;

  const dbPath = path.resolve(workspace, '.whiskers', 'history.sqlite');
  let db;
  try {
    db = await openHistoryReadOnly(dbPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }

  try {
    const rows = listMessagesReadOnly(db, { limit, userOnly });
    const body = serialize(rows, markdown, timestampsOnly);

    if (readStdout) {
      process.stdout.write(body);
    } else {
      const out = outputPath(process.cwd(), markdown, timestampsOnly);
      fs.writeFileSync(out, body, 'utf8');
      process.stderr.write(`Wrote ${out}\n`);
    }
  } finally {
    closeReadOnlyDb(db);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
