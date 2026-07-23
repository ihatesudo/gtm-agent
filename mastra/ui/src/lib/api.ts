import type { Agent, Message } from '../types';

const API = '/api';

export async function fetchAgents(): Promise<Agent[]> {
  const data = await fetch(`${API}/agents`).then(r => r.json());
  return Object.entries(data).map(([id, info]: [string, any]) => ({
    id,
    name: info.name || id,
    description: info.description || '',
  }));
}

interface StreamCallbacks {
  onText: (delta: string) => void;
  onFinish: (fullText: string) => void;
  onError: (err: string) => void;
  onReasoning?: () => void;
}

function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

export async function sendMessageStream(
  agentId: string,
  content: string,
  threadId?: string,
  callbacks?: StreamCallbacks,
): Promise<{ threadId: string }> {
  const tid = threadId || genId();
  const body: Record<string, unknown> = {
    messages: [{ role: 'user', content }],
    memory: { thread: tid, resource: 'default-user' },
  };

  const res = await fetch(`${API}/agents/${agentId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    callbacks?.onError(`HTTP ${res.status}: ${text}`);
    return { threadId: tid };
  }

  const ct = res.headers.get('content-type') || '';
  const threadIdHeader = res.headers.get('x-mastra-thread-id') || tid;

  if (ct.includes('text/event-stream')) {
    return parseSSE(res, threadIdHeader, callbacks);
  }

  const data = await res.json();
  const resolvedTid = data.threadId || threadIdHeader;
  const text = extractText(data);
  if (text) callbacks?.onFinish(text);
  return { threadId: resolvedTid };
}

function parseSSE(
  res: Response,
  threadId: string,
  callbacks?: StreamCallbacks,
): Promise<{ threadId: string }> {
  return new Promise((resolve) => {
    let accumulated = '';
    let currentText = '';
    let resolved = false;

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks?.onFinish('');
      resolve({ threadId });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    function processLines() {
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            if (!resolved) {
              resolved = true;
              callbacks?.onFinish(accumulated);
              resolve({ threadId });
            }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const type = parsed.type || '';
            if (type === 'text-delta' || type === 'text') {
              const delta = parsed.payload?.text || parsed.text || parsed.payload?.delta || '';
              if (delta) {
                currentText += delta;
                accumulated += delta;
                callbacks?.onText(accumulated);
              }
            } else if (type === 'reasoning-delta') {
              callbacks?.onReasoning?.();
            } else if (type === 'finish' || type === 'complete' || type === 'done' || type === 'text-end') {
              if (!resolved) {
                resolved = true;
                callbacks?.onFinish(accumulated);
                resolve({ threadId });
              }
              return;
            } else if (type === 'error') {
              const errMsg = parsed.payload?.error?.message || parsed.payload?.error || parsed.error || parsed.message || 'Stream error';
              callbacks?.onError(errMsg);
            }
          } catch {
            // Skip non-JSON data events
          }
        }
      }
    }

    function pump(): Promise<void> {
      return reader!.read().then(({ done, value }) => {
        if (done) {
          processLines();
          if (!resolved) {
            resolved = true;
            callbacks?.onFinish(accumulated);
            resolve({ threadId });
          }
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        processLines();
        return pump();
      }).catch((err) => {
        if (!resolved) {
          resolved = true;
          callbacks?.onError(String(err));
          resolve({ threadId });
        }
      });
    }

    pump();
  });
}

export async function sendMessage(
  agentId: string,
  content: string,
  threadId?: string,
): Promise<{ messages: Message[]; threadId: string }> {
  const tid = threadId || genId();
  const body: Record<string, unknown> = {
    messages: [{ role: 'user', content }],
    memory: { thread: tid, resource: 'default-user' },
  };

  const res = await fetch(`${API}/agents/${agentId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const threadIdResult = data.threadId || tid;

  const msgs: Message[] = [{
    id: Math.random().toString(36).slice(2),
    role: 'assistant',
    content: extractText(data),
    createdAt: new Date().toISOString(),
  }];

  return { messages: msgs, threadId: threadIdResult };
}

function extractText(data: any): string {
  if (typeof data === 'string') return data;
  if (data.text) return data.text;
  if (data.content) return typeof data.content === 'string' ? data.content : '';
  const msgs = data.messages || data.results || [];
  for (const m of msgs) {
    if (m.role === 'assistant') {
      const c = m.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        const text = c.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
        if (text) return text;
      }
    }
  }
  return '';
}
