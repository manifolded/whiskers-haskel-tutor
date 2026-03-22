import './styles.css';
import { renderMarkdownToSafeHtml } from './renderMarkdown';

declare function acquireVsCodeApi(): {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (s: unknown) => void;
};

const vscode = acquireVsCodeApi();

type ChatMode = 'coach' | 'challenge' | 'quiz' | 'generation' | 'debugging';

type ExtMsg =
  | { type: 'history'; messages: StoredMessage[] }
  | { type: 'streamStart'; assistantId: string }
  | { type: 'streamChunk'; assistantId: string; delta: string }
  | { type: 'streamEnd'; assistantId: string }
  | { type: 'error'; message: string }
  | { type: 'attachedOutput'; text: string };

type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  createdAt: number;
};

const root = document.getElementById('root')!;

const modeSelect = document.createElement('select');
modeSelect.id = 'mode';
(
  [
    ['coach', 'Coach'],
    ['challenge', 'Challenge'],
    ['quiz', 'Quiz'],
    ['generation', 'Generation'],
    ['debugging', 'Debugging'],
  ] as [ChatMode, string][]
).forEach(([v, label]) => {
  const o = document.createElement('option');
  o.value = v;
  o.textContent = label;
  modeSelect.appendChild(o);
});

const messagesEl = document.createElement('div');
messagesEl.className = 'messages';

const input = document.createElement('textarea');
input.rows = 3;
input.placeholder = 'Message…';

const sendBtn = document.createElement('button');
sendBtn.textContent = 'Send';
sendBtn.type = 'button';

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';
toolbar.appendChild(modeSelect);
toolbar.appendChild(sendBtn);

root.appendChild(toolbar);
root.appendChild(messagesEl);
root.appendChild(input);

const streamingContent = new Map<string, string>();

function renderMessages(history: StoredMessage[]) {
  messagesEl.innerHTML = '';
  for (const m of history) {
    const div = document.createElement('div');
    div.className = `msg msg-${m.role}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${m.role}${m.mode ? ` · ${m.mode}` : ''}`;
    const body = document.createElement('div');
    body.className = m.role === 'assistant' ? 'body markdown-body' : 'body';
    if (m.role === 'assistant') {
      body.innerHTML = renderMarkdownToSafeHtml(m.content);
    } else {
      body.textContent = m.content;
    }
    div.appendChild(meta);
    div.appendChild(body);
    messagesEl.appendChild(div);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendStreamingDelta(id: string, delta: string) {
  const prev = streamingContent.get(id) ?? '';
  const next = prev + delta;
  streamingContent.set(id, next);
  let el = document.getElementById(`stream-${id}`);
  if (!el) {
    el = document.createElement('div');
    el.id = `stream-${id}`;
    el.className = 'msg msg-assistant streaming';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = 'assistant · streaming';
    const body = document.createElement('div');
    body.className = 'body markdown-body';
    el.appendChild(meta);
    el.appendChild(body);
    messagesEl.appendChild(el);
  }
  const body = el.querySelector('.body') as HTMLDivElement;
  body.innerHTML = renderMarkdownToSafeHtml(next);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function finalizeStream(id: string) {
  streamingContent.delete(id);
  const el = document.getElementById(`stream-${id}`);
  if (el) {
    el.remove();
  }
}

function send() {
  const text = input.value.trim();
  if (!text) {
    return;
  }
  input.value = '';
  vscode.postMessage({
    type: 'send',
    text,
    mode: modeSelect.value as ChatMode,
  });
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

window.addEventListener('message', (event) => {
  const data = event.data as ExtMsg;
  if (data.type === 'history') {
    renderMessages(data.messages);
  } else if (data.type === 'streamStart') {
    streamingContent.set(data.assistantId, '');
  } else if (data.type === 'streamChunk') {
    appendStreamingDelta(data.assistantId, data.delta);
  } else if (data.type === 'streamEnd') {
    finalizeStream(data.assistantId);
  } else if (data.type === 'error') {
    const div = document.createElement('div');
    div.className = 'msg msg-error';
    div.textContent = `Error: ${data.message}`;
    messagesEl.appendChild(div);
  } else if (data.type === 'attachedOutput') {
    input.value = (input.value ? input.value + '\n\n' : '') + data.text;
  }
});

vscode.postMessage({ type: 'ready' });
