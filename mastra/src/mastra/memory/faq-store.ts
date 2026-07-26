import { createClient } from '@libsql/client';
import { z } from 'zod';

/**
 * FAQ knowledge base — self-built `faq` table with keyword (LIKE) retrieval.
 *
 * Mirrors the project-memory.ts LibSQL pattern (getDb / ensureTable / upsert).
 * No embeddings — MVP uses simple LIKE + tag matching with a lightweight
 * relevance score (title match > answer match > tag match). Pure scoring and
 * formatting helpers are exported separately for unit testing.
 *
 * Table coexists with Mastra's own tables (mastra_threads etc.) in the same
 * LibSQL/Turso DB identified by TURSO_DATABASE_URL / file:mastra.db locally.
 */

export const FaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  tags: z.array(z.string()).default([]),
  /** Provenance: 'docs' | 'seed' | 'user' | custom. */
  source: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Faq = z.infer<typeof FaqSchema>;

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function ensureTable() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS faq (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function upsertFaq(faq: Faq): Promise<void> {
  await ensureTable();
  const db = getDb();
  const now = new Date().toISOString();
  const toSave: Faq = { ...faq, updatedAt: now };
  await db.execute({
    sql: `INSERT INTO faq (id, question, answer, tags, source, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            question = excluded.question,
            answer = excluded.answer,
            tags = excluded.tags,
            source = excluded.source,
            data = excluded.data,
            updated_at = excluded.updated_at`,
    args: [
      toSave.id,
      toSave.question,
      toSave.answer,
      JSON.stringify(toSave.tags),
      toSave.source ?? null,
      JSON.stringify(toSave),
      toSave.createdAt,
      toSave.updatedAt,
    ],
  });
}

export async function listFaqs(): Promise<Faq[]> {
  await ensureTable();
  const db = getDb();
  const result = await db.execute('SELECT data FROM faq ORDER BY updated_at DESC');
  return result.rows.map((r) => JSON.parse(r.data as string) as Faq);
}

export async function getFaq(id: string): Promise<Faq | null> {
  await ensureTable();
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT data FROM faq WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return null;
  return JSON.parse(result.rows[0].data as string) as Faq;
}

export async function deleteFaq(id: string): Promise<void> {
  await ensureTable();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM faq WHERE id = ?', args: [id] });
}

/**
 * Relevance score for a FAQ against a query. Pure function.
 *   title match: +3 per matched term
 *   tag match:   +2
 *   answer match:+1
 * Returns 0 when nothing matches. Multi-term queries add per-term.
 */
export function scoreFaq(faq: Faq, query: string): number {
  const q = (query || '').toLowerCase().trim();
  if (!q) return 0;
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const title = faq.question.toLowerCase();
  const answer = faq.answer.toLowerCase();
  const tags = faq.tags.map((t) => t.toLowerCase());
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    if (tags.some((t) => t.includes(term))) score += 2;
    if (answer.includes(term)) score += 1;
  }
  return score;
}

/**
 * Search FAQs by keyword. Returns matching FAQs ranked by score (desc), best
 * first. Empty list when nothing matches (never throws).
 */
export async function searchFaqs(query: string, limit = 5): Promise<Faq[]> {
  const all = await listFaqs();
  // LIKE pre-filter to avoid scoring the whole corpus once it grows.
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
  const db = getDb();
  await ensureTable();
  const result = await db.execute({
    sql: `SELECT data FROM faq
          WHERE question LIKE ? ESCAPE '\\' OR answer LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'`,
    args: [like, like, like],
  }).catch(() => ({ rows: [] as Array<{ data: unknown }> }));
  const candidates = (result.rows.length
    ? result.rows.map((r) => JSON.parse(r.data as string) as Faq)
    : all // fallback: score everything if the LIKE query shape failed
  );
  return candidates
    .map((f) => ({ f, s: scoreFaq(f, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

/**
 * Format FAQ hits into a single string for the agent. Pure function.
 * Includes an explicit "no matches" message when empty so the agent can tell
 * the user the KB had nothing, rather than silently moving on.
 */
export function formatFaqResults(faqs: Faq[], query: string, max = 3): string {
  if (!faqs || faqs.length === 0) {
    return `FAQ knowledge base: no entries matched "${query.slice(0, 80)}". Treat this as: no canned answer found — answer from general knowledge instead.`;
  }
  const top = faqs.slice(0, max);
  const body = top
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}${f.tags.length ? `\n   tags: ${f.tags.join(', ')}` : ''}${f.source ? `\n   source: ${f.source}` : ''}`)
    .join('\n\n');
  return `FAQ knowledge base (${top.length} match${top.length > 1 ? 'es' : ''} for "${query.slice(0, 60)}"):\n\n${body}`;
}
