// Vercel entry. vercel.json rewrites every path here. Exported as a classic
// Node (req, res) listener — the shape @vercel/node accepts unambiguously —
// bridging to the bootstrapped Hono app (built once per cold start).
import { getRequestListener } from '@hono/node-server';
import { getApp } from '../src/server.js';

export default getRequestListener(async (req) => {
  const app = await getApp();
  return app.fetch(req);
});
