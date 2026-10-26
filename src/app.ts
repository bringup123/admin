import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { COL } from './board.js';
import type { Db } from './db/db.js';
import type { Env } from './env.js';
import type { Clock, CrmPort, MessengerPort } from './ports.js';
import { handleTrigger } from './domain/buttons.js';
import { handleCalcomWebhook } from './domain/calcom.js';
import { isSwitchKey, readSwitches, setSwitch, SWITCHES, type SwitchKey } from './domain/switches.js';
import { runReminders } from './domain/reminders.js';
import { enqueueWelcome, runWelcomeQueue } from './domain/welcome.js';

export interface AppDeps {
  db: Db;
  env: Env;
  crm: CrmPort;
  messenger: MessengerPort;
  clock: Clock;
}

const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** A secret that is not set opens nothing. */
const tokenOk = (given: string | undefined, expected: string) => !!expected && !!given && eq(given, expected);

export function buildApp(deps: AppDeps): Hono {
  const { db, env } = deps;
  const app = new Hono();
  const log = (type: string, itemId: string | null, payload: unknown) =>
    db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [type, itemId, JSON.stringify(payload)]);

  app.get('/health', async (c) => c.json({ ok: true, appEnv: env.appEnv, switches: await readSwitches(db) }));

  // ── monday ────────────────────────────────────────────────────────────────
  // One endpoint for both webhooks: a new card, and «טריגר נציגה» changing.
  // monday signs nothing, so the URL carries a secret; and item ids are
  // global, so an event from another board is refused.
  app.post('/webhooks/monday', async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && typeof body.challenge === 'string') return c.json({ challenge: body.challenge });
    if (!tokenOk(c.req.query('token'), env.mondayWebhookSecret)) return c.json({ error: 'forbidden' }, 403);
    if (!body) return c.json({ error: 'invalid json' }, 400);
    await db.query('insert into webhook_inbox (source, payload) values ($1, $2)', ['monday', JSON.stringify(body)]);
    const ev = (body.event ?? {}) as Record<string, unknown>;
    const itemId = ev.pulseId != null ? String(ev.pulseId) : '';
    if (String(ev.boardId ?? '') !== env.mondayBoardId) {
      await log('monday_foreign_board', itemId || null, { boardId: ev.boardId ?? null });
      return c.json({ outcome: 'ignored', reason: 'foreign_board' });
    }
    if (!itemId) return c.json({ outcome: 'ignored', reason: 'no item' });
    const columnId = ev.columnId ?? ev.column_id;
    if (columnId === COL.trigger) return c.json(await handleTrigger(deps, itemId));
    // Only two webhooks point here; the one without a column is the new card
    // (`create_pulse`) — the same test the dafna service has used since 2026-08.
    if (ev.type === 'create_pulse' || !columnId) {
      const queued = await enqueueWelcome(deps, itemId);
      return c.json({ outcome: queued ? 'queued' : 'already_queued' });
    }
    return c.json({ outcome: 'ignored', reason: `event ${String(ev.type ?? '')}` });
  });

  // ── cal.com ───────────────────────────────────────────────────────────────
  app.post('/webhooks/calcom', async (c) => {
    const raw = await c.req.text();
    if (!env.calcomWebhookSecret) {
      await log('calcom_webhook_refused', null, { reason: 'no_secret_configured' });
      return c.json({ error: 'forbidden' }, 403);
    }
    const given = c.req.header('x-cal-signature-256') ?? '';
    const expected = createHmac('sha256', env.calcomWebhookSecret).update(raw).digest('hex');
    if (!eq(given, expected)) {
      await log('calcom_webhook_refused', null, { reason: 'bad_signature' });
      return c.json({ error: 'forbidden' }, 403);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    // cal.com's «ping» when a webhook is created carries no booking.
    await db.query('insert into webhook_inbox (source, payload) values ($1, $2)', ['calcom', JSON.stringify(body)]);
    return c.json(await handleCalcomWebhook(deps, body));
  });

  // ── the tick ──────────────────────────────────────────────────────────────
  // Vercel cron, every minute; Vercel sends `Authorization: Bearer CRON_SECRET`.
  const tick = async (c: Context) => {
    const auth = (c.req.header('authorization') ?? '').replace(/^Bearer /, '');
    if (!tokenOk(auth, env.cronSecret)) return c.json({ error: 'forbidden' }, 403);
    return c.json({ welcome: await runWelcomeQueue(deps), reminders: await runReminders(deps) });
  };
  app.get('/internal/tick', tick);
  app.post('/internal/tick', tick);

  // ── the switches ──────────────────────────────────────────────────────────
  // The bookmark a non-developer holds. GET, because that is what a bookmark
  // is; one click, no confirmation — an emergency stop that asks is not one.
  app.get('/kill', async (c) => {
    const t = c.req.query('token');
    if (!tokenOk(t, env.killSwitchToken) && !tokenOk(t, env.adminToken)) return c.json({ error: 'forbidden' }, 403);
    await setSwitch(db, 'interactions_enabled', false, 'kill link');
    return c.html(page('המערכת נעצרה', '<p>שום הודעה לא תישלח לאף ליד עד שהמתג יופעל מחדש במסך המתגים.</p>'));
  });

  // What happened lately, for reading back without a database client: the
  // last events, the welcome queue and the last webhook bodies. Admin token.
  app.get('/api/recent', async (c) => {
    if (!tokenOk(c.req.query('token'), env.adminToken)) return c.json({ error: 'forbidden' }, 403);
    const events = await db.query('select id, type, monday_item_id, payload, created_at from events order by id desc limit 30');
    const queue = await db.query('select * from welcome_queue order by created_at desc limit 20');
    const inbox = await db.query('select id, source, payload, received_at from webhook_inbox order by id desc limit 10');
    const messages = await db.query('select id, monday_item_id, kind, status, error, created_at, sent_at from messages order by id desc limit 20');
    return c.json({ events: events.rows, queue: queue.rows, messages: messages.rows, inbox: inbox.rows });
  });

  app.get('/switch', async (c) => {
    const t = c.req.query('token') ?? '';
    if (!tokenOk(t, env.adminToken)) return c.json({ error: 'forbidden' }, 403);
    return c.html(switchPage(await readSwitches(db), t, env));
  });

  app.post('/switch', async (c) => {
    const t = c.req.query('token') ?? '';
    if (!tokenOk(t, env.adminToken)) return c.json({ error: 'forbidden' }, 403);
    const form = await c.req.parseBody();
    const key = String(form.key ?? '');
    if (!isSwitchKey(key)) return c.json({ error: 'unknown switch' }, 400);
    await setSwitch(db, key, String(form.on ?? '') === 'true', String(form.by ?? '') || 'switch page');
    return c.redirect(`/switch?token=${encodeURIComponent(t)}`, 303);
  });

  return app;
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--on:#0a7d32;--off:#b3261e;--line:#e5e5ea}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#f2f2f7;--muted:#a1a1a6;--on:#30d158;--off:#ff6961;--line:#2c2c2e}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;margin:0;padding:16px;max-width:640px}
h1{font-size:1.4rem}.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.on{color:var(--on);font-weight:600}.off{color:var(--off);font-weight:600}button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer}
p.note{color:var(--muted);font-size:.9rem}</style></head><body><h1>${title}</h1>${body}</body></html>`;
}

function switchPage(sw: Record<SwitchKey, boolean>, token: string, env: Env): string {
  const rows = (Object.keys(SWITCHES) as SwitchKey[])
    .map((key) => {
      const on = sw[key];
      return `<div class="row"><div><div>${SWITCHES[key].he}</div><div class="${on ? 'on' : 'off'}">${on ? 'פעיל' : 'כבוי'}</div></div>
<form method="post" action="/switch?token=${encodeURIComponent(token)}"><input type="hidden" name="key" value="${key}"><input type="hidden" name="on" value="${!on}"><button>${on ? 'לכבות' : 'להפעיל'}</button></form></div>`;
    })
    .join('');
  const prodNote =
    env.appEnv === 'production'
      ? ''
      : '<p class="note">זו לא סביבת ייצור: נשלח רק למספרי בדיקה, בלי קשר למתג האחרון.</p>';
  return page('מסע לקוח V3 — מתגים', `${rows}${prodNote}<p class="note">כל שינוי נרשם. ההודעות נשלחות רק כשגם המערכת פעילה וגם המתג של ההודעה פעיל.</p>`);
}
