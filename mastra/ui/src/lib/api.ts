import type { Agent, Message } from '../types';

const API = '/api';

export type ProviderName = 'openrouter' | 'google' | 'vertex' | 'zhipu';

export interface ProviderState {
  configured: boolean;
  reachable: boolean;
  error?: string;
}

export interface ConnectivityStatus {
  active: ProviderName;
  providers: Record<ProviderName, ProviderState>;
  checkedAt: number;
}

export async function fetchConnectivityStatus(timeoutMs = 5000): Promise<ConnectivityStatus | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API}/providers/status`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) return (await res.json()) as ConnectivityStatus;
  } catch {
    // network/timeout — surface as "unknown" via null
  }
  return null;
}

export async function fetchAgents(retries = 6, delayMs = 800): Promise<Agent[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API}/agents`);
      if (res.ok) {
        const data = await res.json();
        return Object.entries(data).map(([id, info]: [string, any]) => ({
          id,
          name: info.name || id,
          description: info.description || '',
        }));
      }
    } catch {
      // Server still booting up, wait and retry
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return [];
}

interface StreamCallbacks {
  onText: (delta: string) => void;
  onFinish: (fullText: string, reasoning?: string) => void;
  onError: (err: string) => void;
  onReasoning?: (text: string) => void;
  onToolCall?: (call: { tool: string; input: string; output?: string }) => void;
  model?: string;
  thinkingMode?: string;
}

function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

export function formatLLMError(err: any): string {
  const rawMsg = typeof err === 'object' 
    ? (err?.message || err?.error?.message || err?.error || JSON.stringify(err)) 
    : String(err || '');
  const lower = (rawMsg + ' ' + JSON.stringify(err || {})).toLowerCase();

  // 1. Depleted credits / quota limit
  if (
    lower.includes('prepayment') ||
    lower.includes('depleted') ||
    lower.includes('billing') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('insufficient_funds') ||
    lower.includes('credit')
  ) {
    return `💳 Depleted Credits / Quota Error: Server or API key is out of credits or billing quota is depleted. Please check your provider billing (AI Studio / OpenRouter) or switch to another model.`;
  }

  // 2. Server heavy load / rate limited (429)
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too_many_requests') || lower.includes('rate_limit')) {
    return `⏳ Heavy Load / Rate Limited (429): Upstream LLM server is under heavy load or rate-limited. Please wait a few seconds before retrying or select another model.`;
  }

  // 3. Invalid or missing API key / Auth error (401 / 403)
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key') ||
    lower.includes('unauthorized') ||
    lower.includes('permission_denied')
  ) {
    return `🔑 Authentication Error (401/403): Invalid or missing API key. Please check your GOOGLE_API_KEY / OPENROUTER_API_KEY settings in .env.`;
  }

  // 4. Provider outage / server error (500 / 502 / 503 / 504 / network)
  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('internal server error') ||
    lower.includes('econnrefused') ||
    lower.includes('fetch failed')
  ) {
    return `🚨 Upstream Provider Outage (5xx): The LLM service is experiencing server errors or downtime. Please try again shortly.`;
  }

  if (rawMsg && rawMsg !== 'Stream error' && rawMsg !== '[object Object]') {
    return `⚠️ Upstream Error: ${rawMsg}`;
  }

  return '⚠️ Upstream LLM error. Please try again or switch model.';
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

  // Send as modelChoice (not model) so Mastra treats it as our own runtime
  // selector (read via requestContext) instead of a string modelConfig that
  // would fall through to the ModelRouter gateway.
  if (callbacks?.model) body.modelChoice = callbacks.model;
  if (callbacks?.thinkingMode) body.thinkingMode = callbacks.thinkingMode;

  const res = await fetch(`${API}/agents/${agentId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    callbacks?.onError(formatLLMError(text));
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
    let accumulatedReasoning = '';
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
        console.log('[SSE raw]', line);
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('[SSE] [DONE] received');
            if (!resolved) {
              resolved = true;
              callbacks?.onFinish(accumulated, accumulatedReasoning);
              resolve({ threadId });
            }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const type = parsed.type || '';
            if (type === 'text-delta' || type === 'text') {
              const delta = parsed.payload?.text || parsed.text || parsed.content || '';
              if (delta) {
                accumulated += delta;
                callbacks?.onText(accumulated);
              }
            } else if (type === 'reasoning-delta') {
              const reasoningDelta = parsed.payload?.text || '';
              if (reasoningDelta) {
                accumulatedReasoning += reasoningDelta;
                callbacks?.onReasoning?.(accumulatedReasoning);
              }
            } else if (type === 'step-finish') {
              const toolCalls = parsed.payload?.stepResult?.output?.toolCalls;
              if (toolCalls && Array.isArray(toolCalls)) {
                for (const tc of toolCalls) {
                  callbacks?.onToolCall?.({
                    tool: tc.toolName || tc.tool || 'unknown',
                    input: JSON.stringify(tc.arguments || tc.args || {}),
                    output: tc.result ? JSON.stringify(tc.result).slice(0, 2000) : undefined,
                  });
                }
              }
            } else if (type === 'finish' || type === 'complete' || type === 'done' || type === 'text-end') {
              console.log('[SSE] finish event, accumulated.length=%d', accumulated.length);
              if (!resolved) {
                resolved = true;
                callbacks?.onFinish(accumulated, accumulatedReasoning);
                resolve({ threadId });
              }
              return;
            } else if (type === 'error') {
              const rawErr = parsed.error || parsed.message || parsed.payload || 'Stream error';
              console.error('[SSE error]', rawErr);
              callbacks?.onError(formatLLMError(rawErr));
            }
          } catch (e) {
            console.warn('[SSE] non-JSON data (skipped):', data);
          }
        }
      }
    }

    function pump(): Promise<void> {
      return reader!.read().then(({ done, value }) => {
        if (done) {
          console.log('[SSE] stream done, buffer remaining:', JSON.stringify(buffer));
          processLines();
          if (!resolved) {
            console.warn('[SSE] stream ended without finish event, accumulated.length=%d', accumulated.length);
            resolved = true;
            callbacks?.onFinish(accumulated, accumulatedReasoning);
            resolve({ threadId });
          }
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        console.log('[SSE] chunk:', JSON.stringify(chunk));
        buffer += chunk;
        processLines();
        return pump();
      }).catch((err) => {
        console.error('[SSE] pump error:', err);
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

export interface TelemetryData {
  enabled: boolean;
  serviceName: string;
  tracesCount: number;
  logsCount: number;
  recentTraces: Array<{
    traceId?: string;
    spanId?: string;
    name?: string;
    spanType?: string;
    startedAt?: string;
    duration?: number;
  }>;
  recentLogs: Array<{
    timestamp?: string;
    level?: string;
    message?: string;
    source?: string;
  }>;
  error?: string;
}

export interface StoredAgentOverride {
  id: string;
  name?: string;
  instructions?: string;
  status?: 'draft' | 'published';
  updatedAt?: string;
}

export async function fetchTelemetryData(): Promise<TelemetryData | null> {
  try {
    const res = await fetch(`${API}/observability/telemetry`);
    if (res.ok) return await res.json();
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchAgentOverrides(): Promise<StoredAgentOverride[]> {
  try {
    const res = await fetch(`${API}/editor/agent-overrides`);
    if (res.ok) {
      const data = await res.json();
      return data.storedAgents || [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function saveAgentOverride(agentId: string, instructions: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/editor/agent-overrides/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

