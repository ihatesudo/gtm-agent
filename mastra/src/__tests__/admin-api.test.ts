/**
 * admin-api.test.ts — admin read-only API: conversation list + CSAT.
 *
 * The admin logic is a pure module that takes a Memory-shaped dependency, so
 * we test it with an in-memory fake (no real DB needed). CSAT rides on thread
 * `metadata` (zero schema change) per the Mastra threads contract.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  listConversations,
  setThreadCSAT,
  validateCSAT,
  type AdminMemory,
} from '../mastra/admin/conversations.js';

/** Minimal fake Memory matching the AdminMemory interface. */
function makeFakeMemory(threads: any[] = [], messages: any[] = []): AdminMemory & { _calls: any[] } {
  const calls: any[] = [];
  return {
    _calls: calls,
    listThreads: vi.fn(async () => ({ threads, total: threads.length, page: 0, perPage: 100, hasMore: false })),
    listMessagesByResourceId: vi.fn(async () => ({ messages, total: messages.length, page: 0, perPage: 100, hasMore: false })),
    getThreadById: vi.fn(async ({ threadId }) => threads.find((t) => t.id === threadId) ?? null),
    updateThread: vi.fn(async ({ id, metadata }) => {
      calls.push({ id, metadata });
      const t = threads.find((x) => x.id === id);
      if (t) t.metadata = { ...(t.metadata || {}), ...metadata };
      return { ...(t || { id, resourceId: 'default-user', title: id, createdAt: new Date(), updatedAt: new Date() }), metadata };
    }),
  };
}

const T = (id: string, metadata: any = {}) => ({
  id,
  title: `Thread ${id}`,
  resourceId: 'default-user',
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-02'),
  metadata,
});
const M = (threadId: string) => ({ threadId, role: 'user', createdAt: new Date() });

describe('validateCSAT', () => {
  it('accepts ratings 1-5', () => {
    for (const r of [1, 2, 3, 4, 5]) expect(validateCSAT(r)).toBe(true);
  });
  it('rejects ratings outside 1-5', () => {
    for (const r of [0, 6, -1, 100, 3.5, NaN]) expect(validateCSAT(r), `rating ${r}`).toBe(false);
  });
});

describe('listConversations', () => {
  it('returns threads with id/title/createdAt, message count, and CSAT from metadata', async () => {
    const mem = makeFakeMemory(
      [T('t1', { csat: 5, csatComment: 'great' }), T('t2')],
      [M('t1'), M('t1'), M('t2')], // t1 has 2 messages, t2 has 1
    );
    const result = await listConversations(mem);
    expect(result.total).toBe(2);
    const t1 = result.conversations.find((c) => c.id === 't1');
    expect(t1?.messageCount).toBe(2);
    expect(t1?.csat).toBe(5);
    expect(t1?.csatComment).toBe('great');
    const t2 = result.conversations.find((c) => c.id === 't2');
    expect(t2?.messageCount).toBe(1);
    expect(t2?.csat).toBeUndefined();
  });

  it('orders conversations by updatedAt DESC (most recent first)', async () => {
    const mem = makeFakeMemory(
      [
        { ...T('old'), updatedAt: new Date('2026-07-01') },
        { ...T('new'), updatedAt: new Date('2026-07-10') },
      ],
      [],
    );
    const result = await listConversations(mem);
    expect(result.conversations[0].id).toBe('new');
    expect(result.conversations[1].id).toBe('old');
  });

  it('returns an empty list (not an error) when there are no threads', async () => {
    const mem = makeFakeMemory([], []);
    const result = await listConversations(mem);
    expect(result.total).toBe(0);
    expect(result.conversations).toEqual([]);
  });

  it('respects perPage limit', async () => {
    const mem = makeFakeMemory([T('t1'), T('t2'), T('t3')], []);
    const result = await listConversations(mem, { perPage: 2 });
    expect(result.conversations).toHaveLength(2);
  });
});

describe('setThreadCSAT', () => {
  it('writes csat + comment into thread metadata via updateThread', async () => {
    const mem = makeFakeMemory([T('t1')]);
    await setThreadCSAT(mem, { threadId: 't1', rating: 4, comment: 'good' });
    expect(mem.updateThread).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', metadata: expect.objectContaining({ csat: 4, csatComment: 'good' }) }));
  });

  it('merges CSAT into existing metadata without clobbering other keys', async () => {
    const mem = makeFakeMemory([T('t1', { otherKey: 'keep' })]);
    await setThreadCSAT(mem, { threadId: 't1', rating: 5 });
    const t = await mem.getThreadById({ threadId: 't1' });
    expect(t?.metadata).toMatchObject({ csat: 5, otherKey: 'keep' });
  });

  it('throws on invalid rating (does not write)', async () => {
    const mem = makeFakeMemory([T('t1')]);
    await expect(setThreadCSAT(mem, { threadId: 't1', rating: 0 })).rejects.toThrow(/csat|rating/i);
    await expect(setThreadCSAT(mem, { threadId: 't1', rating: 6 })).rejects.toThrow(/csat|rating/i);
    expect(mem.updateThread).not.toHaveBeenCalled();
  });

  it('throws when the thread does not exist', async () => {
    const mem = makeFakeMemory([T('t1')]);
    await expect(setThreadCSAT(mem, { threadId: 'missing', rating: 3 })).rejects.toThrow(/not found|exist/i);
  });
});
