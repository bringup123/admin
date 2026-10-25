import { serve } from '@hono/node-server';
import { getApp } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const app = await getApp();
serve({ fetch: app.fetch, port });
console.log(`V3 listening on :${port}`);
