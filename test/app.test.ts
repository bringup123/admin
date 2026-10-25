import { describe, expect, it } from 'vitest';
import { readSwitches } from '../src/domain/switches.js';
import { card, harness } from './helpers.js';

const monday = (h: Awaited<ReturnType<typeof harness>>, body: unknown, token = 'mon-secret') =>
  h.app.request(`/webhooks/monday?token=${token}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('POST /webhooks/monday', () => {
  it('answers the handshake', async () => {
    const h = await harness();
    const res = await monday(h, { challenge: 'abc' }, '');
    expect(await res.json()).toEqual({ challenge: 'abc' });
  });

  it('refuses a call without the secret', async () => {
    const h = await harness();
    expect((await monday(h, { event: {} }, 'wrong')).status).toBe(403);
  });

  it('ignores another board', async () => {
    const h = await harness();
    const res = await monday(h, { event: { type: 'create_pulse', boardId: 5106022212, pulseId: 1 } });
    expect(await res.json()).toEqual({ outcome: 'ignored', reason: 'foreign_board' });
  });

  it('queues a new card for its welcome', async () => {
    const h = await harness();
    const res = await monday(h, { event: { type: 'create_pulse', boardId: 1753447162, pulseId: 40 } });
    expect(await res.json()).toEqual({ outcome: 'queued' });
    const q = await h.db.query('select monday_item_id from welcome_queue');
    expect(q.rows).toEqual([{ monday_item_id: '40' }]);
  });

  it('routes «טריגר נציגה» to the buttons', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'no_answer_3');
    h.crm.add(card({ id: '41', trigger: '3 שיחות לא נענו' }));
    const res = await monday(h, { event: { type: 'update_column_value', boardId: 1753447162, pulseId: 41, columnId: 'color_mm8f5qtn' } });
    expect(await res.json()).toMatchObject({ outcome: 'sent', kind: 'no_answer_3' });
  });
});

describe('the switches', () => {
  it('/kill stops everything, with the kill token or the admin token, and nothing else', async () => {
    const h = await harness();
    await h.on('interactions_enabled');
    expect((await h.app.request('/kill?token=nope')).status).toBe(403);
    expect((await h.app.request('/kill?token=kill-token')).status).toBe(200);
    expect((await readSwitches(h.db)).interactions_enabled).toBe(false);
  });

  it('the switch page needs the admin token and sets one switch', async () => {
    const h = await harness();
    expect((await h.app.request('/switch?token=kill-token')).status).toBe(403);
    const page = await h.app.request('/switch?token=admin-token');
    expect(await page.text()).toContain('הודעת ברוכים הבאים');
    const form = new URLSearchParams({ key: 'welcome', on: 'true', by: 'אילה' });
    const res = await h.app.request('/switch?token=admin-token', {
      method: 'POST',
      body: form.toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status).toBe(303);
    expect((await readSwitches(h.db)).welcome).toBe(true);
  });

  it('the tick needs the cron secret', async () => {
    const h = await harness();
    expect((await h.app.request('/internal/tick')).status).toBe(403);
    const res = await h.app.request('/internal/tick', { headers: { authorization: 'Bearer cron-secret' } });
    expect(await res.json()).toEqual({ welcome: [] });
  });
});

describe('the schema pin', () => {
  it('every table V3 creates is in v3', async () => {
    const h = await harness();
    const r = await h.db.query<{ table_schema: string }>(
      "select distinct table_schema from information_schema.tables where table_name in ('messages','welcome_queue','bookings','events','control','webhook_inbox')"
    );
    expect(r.rows).toEqual([{ table_schema: 'v3' }]);
  });
});
