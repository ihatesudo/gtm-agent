/**
 * Asset storage adapter (Decision 2: Turso metadata + R2/local blobs)
 *
 * In local dev:   keeps an in-memory store (suitable for the local POC)
 * In Cloudflare:  stores metadata in Turso, blobs in R2 via binding
 *
 * Usage:
 *   import { getAssetStore } from '../storage/asset-store.js';
 *   const store = getAssetStore(env);   // pass Workers Env or undefined locally
 *   await store.put('file.md', 'content');
 */

import { createClient } from '@libsql/client';

export interface AssetMeta {
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AssetStore {
  put(filename: string, content: string | Uint8Array): Promise<void>;
  get(filename: string): Promise<string | null>;
  list(): Promise<AssetMeta[]>;
  delete(filename: string): Promise<void>;
}

// ─── Local in-memory adapter (dev / fallback) ───────────────────────────────

const localAssets = new Map<string, { content: string; meta: AssetMeta }>();

function safeFilename(filename: string): string | null {
  const name = filename.split(/[\\/]/).pop()?.trim() ?? '';
  return name && name === filename ? name : null;
}

function makeMemoryStore(): AssetStore {
  return {
    async put(filename, content) {
      const name = safeFilename(filename);
      if (!name) throw new Error('Asset filename must not contain a path');
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      localAssets.set(name, {
        content: text,
        meta: {
          filename: name,
          contentType: name.endsWith('.md') ? 'text/markdown' : 'text/plain',
          sizeBytes: new TextEncoder().encode(text).length,
          createdAt: new Date().toISOString(),
        },
      });
    },
    async get(filename) {
      return localAssets.get(filename)?.content ?? null;
    },
    async list() {
      return [...localAssets.values()].map(({ meta }) => meta);
    },
    async delete(filename) {
      localAssets.delete(filename);
    },
  };
}

// ─── Cloudflare R2 + Turso adapter ─────────────────────────────────────────

export interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  delete(key: string): Promise<void>;
}

function makeTursoR2Store(r2: R2Bucket): AssetStore {
  function getDb() {
    return createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  async function ensureTable() {
    const db = getDb();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS assets (
        filename TEXT PRIMARY KEY,
        content_type TEXT NOT NULL DEFAULT 'text/plain',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  return {
    async put(filename, content) {
      await ensureTable();
      const db = getDb();
      const str = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const sizeBytes = new TextEncoder().encode(str).length;
      const contentType = filename.endsWith('.md') ? 'text/markdown'
        : filename.endsWith('.json') ? 'application/json'
        : filename.endsWith('.html') ? 'text/html'
        : 'text/plain';
      await r2.put(`assets/${filename}`, str);
      await db.execute({
        sql: `INSERT INTO assets (filename, content_type, size_bytes, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(filename) DO UPDATE SET
                content_type = excluded.content_type,
                size_bytes   = excluded.size_bytes`,
        args: [filename, contentType, sizeBytes, new Date().toISOString()],
      });
    },
    async get(filename) {
      const obj = await r2.get(`assets/${filename}`);
      if (!obj) return null;
      return obj.text();
    },
    async list() {
      await ensureTable();
      const db = getDb();
      const result = await db.execute(
        'SELECT filename, content_type, size_bytes, created_at FROM assets ORDER BY created_at DESC'
      );
      return result.rows.map(r => ({
        filename: r.filename as string,
        contentType: r.content_type as string,
        sizeBytes: r.size_bytes as number,
        createdAt: r.created_at as string,
      }));
    },
    async delete(filename) {
      await ensureTable();
      const db = getDb();
      await r2.delete(`assets/${filename}`);
      await db.execute({ sql: 'DELETE FROM assets WHERE filename = ?', args: [filename] });
    },
  };
}

// ─── Public factory ─────────────────────────────────────────────────────────

/** Call with `env` in a Cloudflare Worker context, or undefined for local dev. */
export function getAssetStore(env?: { ASSETS_BUCKET?: R2Bucket }): AssetStore {
  if (env?.ASSETS_BUCKET) {
    return makeTursoR2Store(env.ASSETS_BUCKET);
  }
  return makeMemoryStore();
}
