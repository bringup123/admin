import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { handleCalcomWebhook } from '../src/domain/calcom.js';
import { card, harness } from './helpers.js';

const NEEDS = 6812251;
const DEMO = 7000001;

function booking(over: Record<string, unknown> = {}, trigger = 'BOOKING_CREATED') {
  return {
    triggerEvent: trigger,
    payload: {
      uid: 'u1',
      eventTypeId: NEEDS,
      startTime: '2026-10-28T09:00:00Z',
      attendees: [{ name: 'דנה כהן', email: 'dana@example.com' }],
      responses: { dafna_lead: { value: '30', isHidden: true } },
      videoCallData: { url: 'https://meet.google.com/abc' },
      ...over,
    },
  };
}

describe('cal.com bookings', () => {
  it('a needs-mapping booking lands on its card with «נקבעה פגישה», the date and the room', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30', status: 'נשלחה הודעה ראשונה' }));
    expect(await handleCalcomWebhook(h.deps, booking())).toEqual({ outcome: 'booked', itemId: '30', meeting: 'needs_mapping' });
    const w = h.crm.lastWrite('30')!;
    expect(w.status).toBe('נקבעה פגישה');
    expect(w.meetingDate).toBe('2026-10-28T09:00:00.000Z');
    expect(w.meetingLink).toEqual({ url: 'https://meet.google.com/abc', text: 'פגישה' });
    expect(w.meetingChangeLink?.url).toBe('https://cal.com/booking/u1');
    expect(w.demoDate).toBeUndefined();
  });

  it('a demo booking writes the demo columns and «נקבעה פגישת דמו», and leaves the needs-mapping ones alone', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30', status: 'נקבעה פגישה' }));
    expect(await handleCalcomWebhook(h.deps, booking({ uid: 'd1', eventTypeId: DEMO }))).toEqual({
      outcome: 'booked',
      itemId: '30',
      meeting: 'demo',
    });
    const w = h.crm.lastWrite('30')!;
    expect(w.status).toBe('נקבעה פגישת דמו');
    expect(w.demoDate).toBe('2026-10-28T09:00:00.000Z');
    expect(w.demoLink).toEqual({ url: 'https://meet.google.com/abc', text: 'דמו' });
    expect(w.meetingDate).toBeUndefined();
    expect(w.meetingLink).toBeUndefined();
  });

  it('a booking on another of Sagi’s event types is not V3’s business', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    expect(await handleCalcomWebhook(h.deps, booking({ eventTypeId: 999 }))).toEqual({ outcome: 'ignored', reason: 'event type 999' });
    expect(h.crm.writes).toEqual([]);
  });

  it('the same booking twice is recorded once', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    await handleCalcomWebhook(h.deps, booking());
    expect(await handleCalcomWebhook(h.deps, booking())).toEqual({ outcome: 'already_recorded', itemId: '30' });
  });

  it('falls back to the attendee email when the link carried no card id, and logs a stranger', async () => {
    const h = await harness();
    h.crm.add(card({ id: '31', email: 'Dana@Example.com' }));
    expect(await handleCalcomWebhook(h.deps, booking({ responses: {} }))).toMatchObject({ outcome: 'booked', itemId: '31' });
    expect(
      await handleCalcomWebhook(h.deps, booking({ uid: 'u2', responses: {}, attendees: [{ name: 'x', email: 'who@else.com' }] }))
    ).toEqual({ outcome: 'unmatched', uid: 'u2' });
    const ev = await h.db.query<{ type: string }>("select type from events where type = 'booking_unmatched'");
    expect(ev.rows).toHaveLength(1);
  });

  it('never matches the placeholder address every emailless Lead books under', async () => {
    const h = await harness();
    h.crm.add(card({ id: '32', email: 'leads@bringup.io' }));
    expect(
      await handleCalcomWebhook(h.deps, booking({ responses: {}, attendees: [{ name: 'x', email: 'leads@bringup.io' }] }))
    ).toMatchObject({ outcome: 'unmatched' });
  });

  it('a reschedule moves the date and keeps the status the card has now', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    await handleCalcomWebhook(h.deps, booking());
    h.crm.cards.get('30')!.status = 'לחזור במועד';
    const moved = booking({ uid: 'u1b', rescheduleUid: 'u1', startTime: '2026-10-29T10:00:00Z' }, 'BOOKING_RESCHEDULED');
    expect(await handleCalcomWebhook(h.deps, moved)).toEqual({ outcome: 'rescheduled', itemId: '30', meeting: 'needs_mapping' });
    const w = h.crm.lastWrite('30')!;
    expect(w.meetingDate).toBe('2026-10-29T10:00:00.000Z');
    expect(w.status).toBeUndefined();
    // And the new uid is the one a later cancellation names.
    const cancel = await handleCalcomWebhook(h.deps, booking({ uid: 'u1b' }, 'BOOKING_CANCELLED'));
    expect(cancel).toEqual({ outcome: 'cancelled', itemId: '30', meeting: 'needs_mapping' });
  });

  it('a cancellation clears the meeting, puts the booking link back, and hands the card to Sagi only if it still says booked', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    await handleCalcomWebhook(h.deps, booking());
    expect(h.crm.cards.get('30')!.status).toBe('נקבעה פגישה');
    await handleCalcomWebhook(h.deps, booking({}, 'BOOKING_CANCELLED'));
    const w = h.crm.lastWrite('30')!;
    expect(w.status).toBe('לבדיקת שגיא');
    expect(w.meetingDate).toBeNull();
    expect(w.meetingChangeLink).toBeNull();
    expect(w.meetingLink?.url).toContain('dafna_lead=30');

    h.crm.add(card({ id: '33' }));
    await handleCalcomWebhook(h.deps, booking({ uid: 'u3', responses: { dafna_lead: '33' } }));
    h.crm.cards.get('33')!.status = 'הצעת מחיר';
    await handleCalcomWebhook(h.deps, booking({ uid: 'u3' }, 'BOOKING_CANCELLED'));
    expect(h.crm.lastWrite('33')!.status).toBeUndefined();
  });

  it('a demo cancellation touches only the demo columns', async () => {
    const h = await harness();
    h.crm.add(card({ id: '34' }));
    await handleCalcomWebhook(h.deps, booking({ uid: 'd2', eventTypeId: DEMO, responses: { dafna_lead: '34' } }));
    await handleCalcomWebhook(h.deps, booking({ uid: 'd2' }, 'BOOKING_CANCELLED'));
    const w = h.crm.lastWrite('34')!;
    expect(w.status).toBe('לבדיקת שגיא');
    expect(w.demoDate).toBeNull();
    expect(w.demoLink?.url).toContain('https://cal.com/sagi/demo?');
    expect(w.meetingDate).toBeUndefined();
  });
});

describe('POST /webhooks/calcom', () => {
  const sign = (raw: string, secret = 'cal-secret') => createHmac('sha256', secret).update(raw).digest('hex');

  it('refuses a body without the right signature, and accepts a signed one', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    const raw = JSON.stringify(booking());
    const bad = await h.app.request('/webhooks/calcom', { method: 'POST', body: raw, headers: { 'x-cal-signature-256': sign(raw, 'nope') } });
    expect(bad.status).toBe(403);
    const ok = await h.app.request('/webhooks/calcom', { method: 'POST', body: raw, headers: { 'x-cal-signature-256': sign(raw) } });
    expect(await ok.json()).toMatchObject({ outcome: 'booked', itemId: '30' });
  });

  it('opens nothing when no secret is configured', async () => {
    const h = await harness({ calcomWebhookSecret: '' });
    const raw = JSON.stringify(booking());
    const res = await h.app.request('/webhooks/calcom', { method: 'POST', body: raw, headers: { 'x-cal-signature-256': sign(raw, '') } });
    expect(res.status).toBe(403);
  });
});
