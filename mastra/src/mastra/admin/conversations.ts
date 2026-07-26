/**
 * Admin read-only API logic: list conversations + per-thread CSAT.
 *
 * Designed as PURE functions that take a Memory-shaped dependency
 * (`AdminMemory`), so the logic is unit-testable with an in-memory fake and
 * the HTTP route in index.ts is a thin wrapper.
 *
 * CSAT rides on the thread's existing `metadata` JSONB column (zero schema
 * change — see docs/requirements-v2.md). We namespace the keys as
 * `csat` (1-5) and `csatComment?` to avoid clashing with Mastra's own
 * `metadata.mastra.*` keys.
 */

/** The subset of Memory methods the admin logic needs. Keeps the module
 *  testable with a fake; the real Memory satisfies this structurally. */
export interface AdminMemory {
  listThreads(args: {
    perPage?: number | false;
    page?: number;
    orderBy?: { field?: string; direction?: 'ASC' | 'DESC' };
  }): Promise<{ threads: AdminThread[]; total: number; page: number; perPage: number | false; hasMore: boolean }>;
  listMessagesByResourceId(args: {
    resourceId: string;
    perPage?: number | false;
  }): Promise<{ messages: AdminMessage[]; total: number }>;
  getThreadById(args: { threadId: string; resourceId?: string }): Promise<AdminThread | null>;
  updateThread(args: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<AdminThread>;
}

export interface AdminThread {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata?: Record<string, unknown>;
}

export interface AdminMessage {
  threadId: string;
  role: string;
  createdAt?: Date | string;
}

export interface ConversationRecord {
  id: string;
  title: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  csat?: number;
  csatComment?: string;
}

export interface CSATInput {
  threadId: string;
  rating: number;
  comment?: string;
}

/** Validate a CSAT rating is an integer in [1,5]. */
export function validateCSAT(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/**
 * List conversations with message counts and CSAT (from thread metadata).
 * Orders by updatedAt DESC (most recent first) by default.
 */
export async function listConversations(
  mem: AdminMemory,
  opts: { perPage?: number; resourceId?: string } = {},
): Promise<{ conversations: ConversationRecord[]; total: number; page: number; perPage: number }> {
  const perPage = opts.perPage ?? 100;
  // Ask the store for the page; also slice defensively in case the store
  // ignores perPage (fakes/some backends).
  const { threads, total } = await mem.listThreads({
    perPage: false,
    page: 0,
    orderBy: { field: 'updatedAt', direction: 'DESC' },
  });

  // Count messages per thread. listMessagesByResourceId is scoped to a
  // resourceId; default-user is the value the UI sends for all chats.
  const resourceId = opts.resourceId ?? 'default-user';
  const msgRes = await mem.listMessagesByResourceId({ resourceId, perPage: false }).catch(() => ({ messages: [], total: 0 }));
  const counts = new Map<string, number>();
  for (const m of msgRes.messages) {
    counts.set(m.threadId, (counts.get(m.threadId) ?? 0) + 1);
  }

  const all = threads.map((t) => {
    const md = t.metadata ?? {};
    const rec: ConversationRecord = {
      id: t.id,
      title: t.title ?? t.id,
      resourceId: t.resourceId,
      createdAt: String(t.createdAt),
      updatedAt: String(t.updatedAt),
      messageCount: counts.get(t.id) ?? 0,
    };
    if (typeof md.csat === 'number') rec.csat = md.csat;
    if (typeof md.csatComment === 'string') rec.csatComment = md.csatComment;
    return rec;
  });

  // Defensive client-side sort by updatedAt DESC (storage orderBy varies).
  // Compare by parsed timestamp, not string — String(Date) is locale-formatted
  // and does not sort chronologically.
  const toMs = (s: string) => Date.parse(s) || 0;
  all.sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));

  const conversations = all.slice(0, perPage);
  return { conversations, total, page: 0, perPage };
}

/**
 * Write a CSAT rating + optional comment into the thread's metadata, merging
 * with any existing metadata keys. Throws on invalid rating or unknown thread.
 */
export async function setThreadCSAT(mem: AdminMemory, input: CSATInput): Promise<void> {
  if (!validateCSAT(input.rating)) {
    throw new Error(`Invalid CSAT rating ${input.rating}: must be an integer 1-5`);
  }
  const thread = await mem.getThreadById({ threadId: input.threadId });
  if (!thread) {
    throw new Error(`Thread ${input.threadId} not found`);
  }
  const merged: Record<string, unknown> = { ...(thread.metadata ?? {}) };
  merged.csat = input.rating;
  if (typeof input.comment === 'string' && input.comment.trim()) {
    merged.csatComment = input.comment.trim();
  }
  await mem.updateThread({ id: input.threadId, title: thread.title ?? input.threadId, metadata: merged });
}
