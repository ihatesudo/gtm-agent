import { LibSQLStore } from '@mastra/libsql';

/**
 * Shared LibSQL store — the single source of truth for all persistence.
 *
 * Lives in its own module so that BOTH the Mastra app instance (index.ts) AND
 * the Director's Memory (agents/director.ts) can import the SAME instance
 * without a circular dependency (index.ts imports director.ts, so director.ts
 * cannot import the store from index.ts).
 *
 * Production: Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). Local dev: the
 * `file:mastra.db` SQLite file. Conversation threads/messages, CSAT metadata,
 * FAQ rows, editor overrides, and asset metadata all coexist in this one DB.
 */
export const sharedStorage = new LibSQLStore({
  id: 'mastra-storage',
  url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});
