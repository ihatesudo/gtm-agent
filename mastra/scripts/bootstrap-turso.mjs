#!/usr/bin/env node
/**
 * Idempotently provisions the application-owned Turso tables.
 * Mastra creates its own internal storage tables when the server starts.
 */
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || url.startsWith('file:')) {
  console.error('TURSO_DATABASE_URL must be set to a remote libsql:// URL.');
  process.exit(1);
}

if (!authToken) {
  console.error('TURSO_AUTH_TOKEN is required for a remote Turso database.');
  process.exit(1);
}

const db = createClient({ url, authToken });

const statements = [
  `CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS assets (
    filename TEXT PRIMARY KEY,
    content_type TEXT NOT NULL DEFAULT 'text/plain',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    credits_remaining_cents INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS replays (
    campaign_id TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL,
    project_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_replays_project_id ON replays(project_id)',
];

try {
  for (const sql of statements) await db.execute(sql);
  const tables = await db.execute(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN ('projects', 'assets', 'users', 'replays')
    ORDER BY name
  `);
  console.log(`Turso schema ready (${tables.rows.map((row) => row.name).join(', ')}).`);
} catch (error) {
  console.error('Turso bootstrap failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  db.close();
}
