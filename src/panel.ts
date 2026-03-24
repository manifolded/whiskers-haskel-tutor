import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { historyTrace, getHistoryDebugConfig } from './debug/historyTrace';
import type { CoreMessage } from 'ai';
import type { Database as SqlDatabase } from 'sql.js';
import { loadConfigForMode } from './config';
import type { CoachTutorConfigOk, CodeGenConfigOk } from './config';
import type { WhiskersMode } from './modes';
import { isWhiskersMode } from './modes';
import { getHistoryDbPath, getProjectRootPath, getWhiskersDir } from './projectRoot';
import {
  openHistoryDb,
  appendMessage,
  listMessages,
  closeHistoryDb,
  countMessages,
} from './storage/sqlite';
import { buildNotebookContextPayload, formatNotebookContextForPrompt } from './notebook/context';
import { streamCoachTutor, streamReplicate } from './chat/stream';
import { takePendingAttachment } from './attachment';

export class ChatPanel {
  public static current: ChatPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly ctx: vscode.ExtensionContext;
  private db: SqlDatabase | undefined;
  private dbInit: Promise<SqlDatabase> | undefined;
  /** Webview has sent `ready`; prior to that, postMessage can be dropped by VS Code. */
  private webviewReady = false;
  private pendingToasts: { message: string; variant: 'info' | 'warning' }[] = [];
  private readonly traceSessionId = randomUUID();
  private dbTraceLogged = false;

  private constructor(panel: vscode.WebviewPanel, ctx: vscode.ExtensionContext) {
    this.panel = panel;
    this.ctx = ctx;
    if (getHistoryDebugConfig().chatHistory) {
      historyTrace({ kind: 'panelCreate', sessionId: this.traceSessionId });
    }
    this.panel.onDidDispose(() => {
      if (getHistoryDebugConfig().chatHistory) {
        historyTrace({ kind: 'panelDispose', sessionId: this.traceSessionId });
      }
      this.webviewReady = false;
      this.pendingToasts = [];
      if (ChatPanel.current === this) {
        ChatPanel.current = undefined;
      }
    });
    this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
  }

  static async createOrShow(ctx: vscode.ExtensionContext): Promise<ChatPanel> {
    if (ChatPanel.current) {
      ChatPanel.current.panel.reveal(vscode.ViewColumn.One);
      return ChatPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      'whiskersChat',
      'Whiskers Tutor',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'dist', 'webview')],
      }
    );
    const c = new ChatPanel(panel, ctx);
    ChatPanel.current = c;
    await c.setWebviewHtml();
    return c;
  }

  private async setWebviewHtml(): Promise<void> {
    const js = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview', 'assets', 'index.js')
    );
    const css = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview', 'assets', 'index.css')
    );
    const csp = [
      `default-src 'none';`,
      `style-src ${this.panel.webview.cspSource} 'unsafe-inline';`,
      `script-src ${this.panel.webview.cspSource};`,
      `img-src https: http: data: blob: ${this.panel.webview.cspSource};`,
      `font-src https: data: ${this.panel.webview.cspSource};`,
    ].join(' ');
    this.panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${css}" rel="stylesheet" />
  <title>Whiskers Tutor</title>
</head>
<body>
  <div id="root"></div>
  <script src="${js}"></script>
</body>
</html>`;
  }

  private async getDb(): Promise<SqlDatabase> {
    if (this.db) {
      return this.db;
    }
    const dir = getWhiskersDir();
    if (!dir) {
      throw new Error('Open a workspace folder to use Whiskers.');
    }
    if (!this.dbInit) {
      this.dbInit = openHistoryDb(dir);
    }
    this.db = await this.dbInit;
    if (!this.dbTraceLogged && getHistoryDebugConfig().chatHistory) {
      this.dbTraceLogged = true;
      historyTrace({
        kind: 'panelGetDb',
        sessionId: this.traceSessionId,
        dbPath: getHistoryDbPath(),
        workspaceRoot: getProjectRootPath(),
        rowCount: countMessages(this.db),
      });
    }
    return this.db;
  }

  private async postHistory() {
    const db = await this.getDb();
    const rows = listMessages(db);
    const messages = rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      mode: r.mode ?? undefined,
      createdAt: r.created_at,
    }));
    this.panel.webview.postMessage({ type: 'history', messages });
  }

  private async onMessage(msg: { type: string; text?: string; mode?: string }) {
    if (msg.type === 'ready') {
      this.webviewReady = true;
      for (const t of this.pendingToasts) {
        this.panel.webview.postMessage({ type: 'toast', message: t.message, variant: t.variant });
      }
      this.pendingToasts = [];
      await this.postHistory();
      return;
    }
    if (msg.type !== 'send' || typeof msg.text !== 'string') {
      return;
    }
    const modeStr = msg.mode ?? 'coach';
    if (!isWhiskersMode(modeStr)) {
      this.panel.webview.postMessage({ type: 'error', message: `Invalid mode: ${modeStr}` });
      return;
    }
    const mode = modeStr as WhiskersMode;
    await this.handleSend(mode, msg.text);
  }

  private async handleSend(mode: WhiskersMode, userText: string) {
    const cfg = await loadConfigForMode(mode, this.ctx.secrets);
    if (!cfg.ok) {
      vscode.window.showErrorMessage(cfg.message);
      this.panel.webview.postMessage({ type: 'error', message: cfg.message });
      return;
    }

    const nb = buildNotebookContextPayload();
    const nbBlock = formatNotebookContextForPrompt(nb);
    const pending = takePendingAttachment();
    let fullUser = userText;
    if (pending) {
      fullUser = `${userText}\n\n--- Attached cell output ---\n${pending}`;
    }
    const userContent = `${fullUser}\n\n--- Notebook context ---\n${nbBlock}`;

    const db = await this.getDb();
    const userId = randomUUID();
    const assistantId = randomUUID();
    const now = Date.now();
    appendMessage(db, {
      id: userId,
      role: 'user',
      content: userText,
      mode,
      created_at: now,
      metadata_json: pending ? JSON.stringify({ attachedOutput: true }) : null,
    });
    if (getHistoryDebugConfig().chatHistory) {
      historyTrace({
        kind: 'handleSend',
        phase: 'userAppended',
        sessionId: this.traceSessionId,
        userId,
        rowCount: countMessages(db),
      });
    }

    const rows = listMessages(db);
    const core: CoreMessage[] = [];
    for (const r of rows) {
      if (r.role !== 'user' && r.role !== 'assistant') {
        continue;
      }
      if (r.id === userId) {
        core.push({ role: 'user', content: userContent });
      } else {
        core.push({ role: r.role, content: r.content });
      }
    }

    this.panel.webview.postMessage({ type: 'streamStart', assistantId, mode });

    try {
      let assistantText = '';
      const handlers = {
        onDelta: (d: string) => {
          assistantText += d;
          this.panel.webview.postMessage({ type: 'streamChunk', assistantId, delta: d });
        },
      };

      if (mode === 'coach' || mode === 'challenge' || mode === 'quiz') {
        const c = cfg as CoachTutorConfigOk;
        assistantText = await streamCoachTutor({ mode, lm: c.lmStudio, messages: core, handlers });
      } else {
        const a = cfg as CodeGenConfigOk;
        assistantText = await streamReplicate({ mode, replicate: a.replicate, messages: core, handlers });
      }

      this.panel.webview.postMessage({ type: 'streamEnd', assistantId });
      if (getHistoryDebugConfig().chatHistory) {
        historyTrace({
          kind: 'handleSend',
          phase: 'streamFinishedOk',
          sessionId: this.traceSessionId,
          assistantId,
          rowCountBeforeAssistantAppend: countMessages(db),
        });
      }
      appendMessage(db, {
        id: assistantId,
        role: 'assistant',
        content: assistantText,
        mode,
        created_at: Date.now(),
      });
      if (getHistoryDebugConfig().chatHistory) {
        historyTrace({
          kind: 'handleSend',
          phase: 'assistantAppended',
          sessionId: this.traceSessionId,
          assistantId,
          rowCount: countMessages(db),
        });
      }
      await this.postHistory();
      if (getHistoryDebugConfig().chatHistory) {
        historyTrace({
          kind: 'handleSend',
          phase: 'postHistoryAfterSend',
          sessionId: this.traceSessionId,
          rowCount: countMessages(db),
        });
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.panel.webview.postMessage({ type: 'streamEnd', assistantId });
      if (getHistoryDebugConfig().chatHistory) {
        historyTrace({
          kind: 'handleSend',
          phase: 'streamError',
          sessionId: this.traceSessionId,
          assistantId,
          error: err,
          rowCount: countMessages(db),
        });
      }
      vscode.window.showErrorMessage(err);
      this.panel.webview.postMessage({ type: 'error', message: err });
    }
  }

  reveal(): void {
    this.panel.reveal();
  }

  postAttachedOutput(text: string): void {
    this.panel.webview.postMessage({ type: 'attachedOutput', text });
  }

  /** In-webview banner at top of chat (avoids covering the message input). */
  postToast(message: string, variant: 'info' | 'warning' = 'info'): void {
    if (this.webviewReady) {
      this.panel.webview.postMessage({ type: 'toast', message, variant });
    } else {
      this.pendingToasts.push({ message, variant });
    }
  }

  static onDeactivate(): void {
    closeHistoryDb();
  }
}
