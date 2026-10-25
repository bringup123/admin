import type { Hono } from 'hono';
import { buildApp } from './app.js';
import { manychatMessenger } from './adapters/manychat.js';
import { mondayCrm } from './adapters/monday.js';
import { assertSchema, pgDb } from './db/db.js';
import { migrate } from './db/migrate.js';
import { envFromProcess } from './env.js';

// Built once per cold start: migrate, check the schema pin, wire the adapters.
let app: Promise<Hono> | undefined;

export function getApp(): Promise<Hono> {
  app ??= (async () => {
    const env = envFromProcess();
    if (!env.databaseUrl) throw new Error('DATABASE_URL is required');
    const db = await pgDb(env.databaseUrl);
    await migrate(db);
    await assertSchema(db);
    return buildApp({
      db,
      env,
      crm: mondayCrm({ token: env.mondayApiToken, boardId: env.mondayBoardId }),
      messenger: manychatMessenger({ apiToken: env.manychatApiToken, apiBase: env.manychatApiBase }),
      clock: { now: () => new Date() },
    });
  })();
  return app;
}
