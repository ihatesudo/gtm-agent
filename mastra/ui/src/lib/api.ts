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

export async function sendMessage(
  agentId: string,
  content: string,
  threadId?: string,
): Promise<{ messages: Message[]; threadId: string }> {
  const res = await fetch(`${API}/agents/${agentId}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content }],
      threadId: threadId || undefined,
    }),
  });

  const data = await res.json();

  const msgs: Message[] = (data.messages || data.results || []).map((m: any) => ({
    id: m.id || Math.random().toString(36).slice(2),
    role: m.role === 'user' ? 'user' : 'assistant',
    content: typeof m.content === 'string' ? m.content : m.content?.[0]?.text || m.text || '',
    createdAt: m.createdAt || new Date().toISOString(),
  }));

  const tid = data.threadId || threadId || '';

  return { messages: msgs, threadId: tid };
}
