/**
 * memory.test.ts — guards the conversation-persistence contract.
 *
 * CONTEXT: previously the Director's Memory was constructed WITHOUT a storage
 * backend, so conversation history lived only in localStorage on the client
 * and was never persisted server-side. These tests lock in that:
 *   1. The Director's Memory is wired to the shared LibSQL store (so threads/
 *      messages survive restarts and become queryable by an admin view).
 *   2. The shared store is the SAME instance used by the Mastra app (single
 *      source of truth) — exported from a dedicated module to avoid a circular
 *      dependency between index.ts and director.ts.
 *   3. Specialists remain memoryless (no accidental cross-agent state).
 */
import { describe, it, expect } from 'vitest';
import { directorMemory } from '../mastra/agents/director.js';
import { ALL_SPECIALIST_AGENTS } from '../mastra/agents/specialists.js';
import { sharedStorage } from '../mastra/storage/store.js';

describe('conversation persistence (Memory → LibSQL)', () => {
  it('exports a shared storage instance (single source of truth)', () => {
    expect(sharedStorage).toBeTruthy();
    // It must expose the threads/messages memory domain used by admin queries.
    const store = sharedStorage as unknown as {
      getStore?: (name: string) => unknown;
    };
    expect(typeof store.getStore).toBe('function');
  });

  it('director Memory has a storage backend (no longer memory-only)', () => {
    // The Memory must carry a storage backend — before the fix this was
    // undefined, which is exactly why conversation history was never persisted.
    expect(directorMemory).toBeTruthy();
    expect(
      (directorMemory as unknown as { storage?: unknown }).storage,
      'directorMemory.storage must be set',
    ).toBeTruthy();
  });

  it('director Memory storage shares the SAME LibSQL client + id as the app store', () => {
    // The Memory constructor wraps the LibSQLStore but reuses the underlying
    // DB connection. The meaningful persistence guarantee is: same id and the
    // same DB client (so threads/messages land in the same database the admin
    // view queries), not referential equality of the wrapper.
    const memStore = (directorMemory as unknown as { storage?: { id?: string; client?: unknown } }).storage;
    const appStore = sharedStorage as unknown as { id?: string; client?: unknown };
    expect(memStore?.id).toBe(appStore.id);
    expect(memStore?.client, 'must share the underlying DB client').toBe(appStore.client);
  });

  it('specialists module exports NO memory instance (no per-specialist persistence)', () => {
    // Specialists are constructed with no `memory` field (see specialists.ts).
    // ALL_SPECIALIST_AGENTS must be a map of Agent instances, never Memory.
    for (const [, value] of Object.entries(ALL_SPECIALIST_AGENTS)) {
      const ctor = (value as { constructor?: { name?: string } }).constructor?.name || '';
      expect(ctor.replace(/^_/, ''), 'specialist exports must be Agents, not Memory').toBe('Agent');
    }
  });
});
