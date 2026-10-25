import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA, type Db } from './db.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

/** Every migration not yet applied, in file-name order. Every name is
 *  schema-qualified, so nothing lands in `public` whatever the search_path. */
export async function migrate(db: Db): Promise<void> {
  await db.exec(`create schema if not exists ${SCHEMA}`);
  await db.query(
    `create table if not exists ${SCHEMA}.schema_migrations (name text primary key, applied_at timestamptz not null default now())`
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await db.query(`select 1 from ${SCHEMA}.schema_migrations where name = $1`, [file]);
    if (done.rows.length > 0) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await db.exec(sql);
    await db.query(`insert into ${SCHEMA}.schema_migrations (name) values ($1)`, [file]);
  }
}
