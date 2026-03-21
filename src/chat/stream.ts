import { streamText, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import Replicate from 'replicate';
import type { CoachTutorConfigOk, CodeGenConfigOk } from '../config';
import type { WhiskersMode } from '../modes';
import { systemPromptForMode } from './prompts';

function coreMessagesToReplicatePrompt(messages: CoreMessage[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    const text =
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    if (m.role === 'user') {
      parts.push(`User:\n${text}`);
    } else if (m.role === 'assistant') {
      parts.push(`Assistant:\n${text}`);
    }
  }
  return parts.join('\n\n');
}

export type StreamHandlers = {
  onDelta: (delta: string) => void;
};

/**
 * Coach / challenge / quiz → OpenAI-compatible (LM Studio).
 */
export async function streamCoachTutor(params: {
  mode: WhiskersMode;
  lm: CoachTutorConfigOk['lmStudio'];
  messages: CoreMessage[];
  handlers: StreamHandlers;
}): Promise<string> {
  const { mode, lm, messages, handlers } = params;
  const openai = createOpenAI({
    baseURL: lm.baseUrl.replace(/\/$/, ''),
    apiKey: lm.apiKey.length > 0 ? lm.apiKey : 'lm-studio',
  });
  const system = systemPromptForMode(mode);
  const result = streamText({
    model: openai(lm.model),
    system,
    messages,
  });
  let full = '';
  for await (const part of result.textStream) {
    full += part;
    handlers.onDelta(part);
  }
  return full;
}

/**
 * Generation / debugging → Replicate (Anthropic Claude on Replicate, e.g. Opus 4.6).
 */
export async function streamReplicate(params: {
  mode: WhiskersMode;
  replicate: CodeGenConfigOk['replicate'];
  messages: CoreMessage[];
  handlers: StreamHandlers;
}): Promise<string> {
  const { mode, replicate, messages, handlers } = params;
  const system = systemPromptForMode(mode);
  const prompt = coreMessagesToReplicatePrompt(messages);
  const replicateClient = new Replicate({
    auth: replicate.apiToken,
    userAgent: 'whiskers-haskell-tutor/0.1.0',
  });
  const input: Record<string, string | number> = {
    prompt,
    system_prompt: system,
    max_tokens: 16384,
  };
  let full = '';
  for await (const event of replicateClient.stream(
    replicate.model as `${string}/${string}`,
    { input }
  )) {
    if (event.event === 'error') {
      throw new Error(event.data);
    }
    if (event.event === 'output' && typeof event.data === 'string') {
      full += event.data;
      handlers.onDelta(event.data);
    }
  }
  return full;
}
