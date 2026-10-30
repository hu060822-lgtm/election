import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pool } from './db.js';
import { config } from './config.js';

/** Applies every migrations/*.sql not yet recorded in schema_migrations. Safe to run repeatedly. */
export async function migrate(log = console.log) {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    // Serialise concurrent migrators (e.g. two app instances booting at once)
    await client.query('SELECT pg_advisory_lock(20261128)');
    const files = (await fs.readdir(config.migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await fs.readFile(path.join(config.migrationsDir, f), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        log(`  ✓ applied ${f}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
      }
    }
    log('Migrations up to date.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(20261128)').catch(() => {});
    client.release();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
