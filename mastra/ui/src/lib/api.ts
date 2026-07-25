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
  onFinish: (fullText: string, reasoning?: string, threadId?: string) => void;
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

  // 4. Stream / connection corruption — undici's "TypeError: unusable" lands
  //    here. This is a client-side stream-body failure (body consumed twice,
  //    aborted, reset), NOT an upstream outage, so it gets its own message
  //    rather than leaking the raw TypeError or being mislabeled as 5xx.
  if (
    lower.includes('unusable') ||
    lower.includes('body has already been used') ||
    lower.includes('body is locked') ||
    lower.includes('readablestream') ||
    lower.includes('aborted') ||
    lower.includes('connection reset') ||
    lower.includes('socket hang up') ||
    lower.includes('stream error')
  ) {
    return `🔌 Stream Interrupted: The response stream broke mid-flight (usually a transient network blip or a token-refresh race). Please retry, or switch model.`;
  }

  // 5. Provider outage / server error (500 / 502 / 503 / 504 / network)
  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('internal server error') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout') ||
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
  if (text) callbacks?.onFinish(text, undefined, resolvedTid);
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
    let seq = 0;
    const t0 = performance.now();
    const log = (msg: string, ...args: any[]) => console.log(`[SSE:${threadId.slice(-8)}]`, msg, ...args);

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks?.onFinish('', undefined, threadId);
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
          seq++;
          if (data === '[DONE]') {
            log('[#%d] [DONE] (t=%dms)', seq, (performance.now() - t0).toFixed(0));
            if (!resolved) {
              resolved = true;
              callbacks?.onFinish(accumulated, accumulatedReasoning, threadId);
              resolve({ threadId });
            }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const type = parsed.type || '';
            const t = performance.now() - t0;
            if (type === 'text-delta' || type === 'text') {
              const delta = parsed.payload?.text || parsed.text || parsed.content || '';
              if (delta) {
                accumulated += delta;
                if (accumulated.length < 200 || !accumulated.includes('...')) {
                  log('[#%d] text-delta (+%d chars, total=%d, t=%dms)', seq, delta.length, accumulated.length, t.toFixed(0));
                }
                callbacks?.onText(accumulated);
              }
            } else if (type === 'reasoning-delta' || type === 'reasoning') {
              const reasoningDelta = parsed.payload?.text || parsed.payload?.reasoning || parsed.text || parsed.reasoning || '';
              if (reasoningDelta) {
                accumulatedReasoning += reasoningDelta;
                log('[#%d] reasoning-delta (+%d chars, total=%d, t=%dms)', seq, reasoningDelta.length, accumulatedReasoning.length, t.toFixed(0));
                callbacks?.onReasoning?.(accumulatedReasoning);
              }
            } else if (type === 'step-finish' || type === 'tool-call' || type === 'tool_call' || type === 'tool-result' || type === 'tool_result') {
              const rawToolCalls =
                parsed.payload?.stepResult?.output?.toolCalls ||
                parsed.payload?.stepResult?.toolCalls ||
                parsed.payload?.toolCalls ||
                parsed.stepResult?.output?.toolCalls ||
                parsed.stepResult?.toolCalls ||
                parsed.toolCalls ||
                (parsed.payload?.toolName || parsed.toolName || parsed.payload?.tool || parsed.tool ? [parsed.payload || parsed] : null);

              if (rawToolCalls && Array.isArray(rawToolCalls)) {
                const names = rawToolCalls.map((tc: any) => tc.toolName || tc.tool || tc.name || '?').join(', ');
                log('[#%d] step/tool event (tools: [%s], t=%dms)', seq, names, t.toFixed(0));
                for (const tc of rawToolCalls) {
                  const toolName = tc.toolName || tc.tool || tc.name || 'unknown';
                  const rawInput = tc.arguments || tc.args || tc.input || tc.parameters || {};
                  const inputStr = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);
                  const rawOutput = tc.result || tc.output;
                  const outputStr = rawOutput !== undefined ? (typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput)).slice(0, 2000) : undefined;

                  callbacks?.onToolCall?.({
                    tool: toolName,
                    input: inputStr,
                    output: outputStr,
                  });
                }
              } else {
                log('[#%d] step-finish (no tools, t=%dms)', seq, t.toFixed(0));
              }
            } else if (type === 'finish' || type === 'complete' || type === 'done' || type === 'text-end') {
              log('[#%d] %s (accumulated=%d chars, reasoning=%d chars, resolved=%s, t=%dms)', seq, type, accumulated.length, accumulatedReasoning.length, resolved, t.toFixed(0));
              if (!resolved) {
                resolved = true;
                callbacks?.onFinish(accumulated, accumulatedReasoning, threadId);
                resolve({ threadId });
              } else {
                log('[#%d] ⚠️ duplicate finish ignored (already resolved)', seq);
              }
              return;
            } else if (type === 'error') {
              const rawErr = parsed.error || parsed.message || parsed.payload || 'Stream error';
              log('[#%d] ❌ error event: %s (t=%dms)', seq, rawErr, t.toFixed(0));
              callbacks?.onError(formatLLMError(rawErr));
            } else {
              log('[#%d] other event type=%s (t=%dms)', seq, type, t.toFixed(0));
            }
          } catch (e) {
            log('[#%d] non-JSON (skipped): %s', seq, data);
          }
        }
      }
    }

    function pump(): Promise<void> {
      return reader!.read().then(({ done, value }) => {
        if (done) {
          const t = performance.now() - t0;
          if (buffer.trim()) {
            log('stream done, processing remaining buffer (t=%dms)', t);
            processLines();
          }
          if (!resolved) {
            log('⚠️ stream ended without finish event (accumulated=%d chars, t=%dms)', accumulated.length, t.toFixed(0));
            resolved = true;
            callbacks?.onFinish(accumulated, accumulatedReasoning, threadId);
            resolve({ threadId });
          } else {
            log('stream done (clean, t=%dms)', t);
          }
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        processLines();
        return pump();
      }).catch((err) => {
        const t = performance.now() - t0;
        log('❌ pump error (t=%dms): %s', t.toFixed(0), err);
        if (!resolved) {
          resolved = true;
          callbacks?.onError(formatLLMError(err));
          resolve({ threadId });
        }
      });
    }

    log('stream start');
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

