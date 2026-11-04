import { describe, expect, it } from 'vitest';
import { handleCalcomWebhook } from '../src/domain/calcom.js';
import { handleMeetingEdit } from '../src/domain/board-edits.js';
import { runReminders } from '../src/domain/reminders.js';
import { card, harness } from './helpers.js';

const DATE = 'date_mm0q3ske';
const LINK = 'link_mm0w28s';
const DEMO_DATE = 'date_mm8frbxn';

type H = Awaited<ReturnType<typeof harness>>;

async function booked() {
  const h = await harness();
  await h.on('interactions_enabled', 'reminder_day', 'reminder_hour');
  h.crm.add(card({ id: '30', status: 'חדש' }));
  h.messenger.contacts.set('c1', { phone: '+972501112233', itemId: '30' });
  // Wednesday 28.10, 11:00 in Israel; the clock is Monday 26.10, 08:00 UTC.
  await handleCalcomWebhook(h.deps, {
    triggerEvent: 'BOOKING_CREATED',
    payload: {
      uid: 'u1',
      eventTypeId: 6812251,
      startTime: '2026-10-28T09:00:00Z',
      attendees: [],
      responses: { dafna_lead: '30' },
      videoCallData: { url: 'https://meet.google.com/abc-defg-hij' },
    },
  });
  h.crm.updates = [];
  h.messenger.fields = [];
  return h;
}
const at = (h: H, iso: string) => (h.clock.t = new Date(iso));
const bookingRow = async (h: H) =>
  (await h.db.query<{ status: string; start_at: string; meeting_url: string }>("select status, start_at, meeting_url from bookings where uid like '%'")).rows;

describe('a meeting changed by hand on the board', () => {
  it('V3’s own writes coming back are echoes', async () => {
    const h = await booked();
    expect(await handleMeetingEdit(h.deps, '30', DATE)).toEqual({ outcome: 'echo', itemId: '30' });
    expect(await handleMeetingEdit(h.deps, '30', LINK)).toEqual({ outcome: 'echo', itemId: '30' });
    expect(h.crm.updates).toEqual([]);
  });

  it('a new time moves the reminders and ManyChat, and the card says cal.com did not move', async () => {
    const h = await booked();
    h.crm.cards.get('30')!.meetingDate = '2026-10-29T12:00:00.000Z';
    expect((await handleMeetingEdit(h.deps, '30', DATE)).outcome).toBe('moved');
    expect(new Date((await bookingRow(h))[0]!.start_at).toISOString()).toBe('2026-10-29T12:00:00.000Z');
    expect(h.messenger.fields.at(-1)!.fields.V3_Meeting_When).toBe('יום חמישי, 29.10 בשעה 14:00');
    expect(h.crm.updates[0]!.text).toContain('ב-Cal.com וביומן של שגיא הפגישה לא השתנתה');
    at(h, '2026-10-27T09:00:00Z'); // the old day-before
    expect(await runReminders(h.deps)).toEqual([]);
    at(h, '2026-10-28T12:00:00Z'); // the new one
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'sent' }]);
  });

  it('a cleared date stops the reminders', async () => {
    const h = await booked();
    h.crm.cards.get('30')!.meetingDate = '';
    expect((await handleMeetingEdit(h.deps, '30', DATE)).outcome).toBe('cleared');
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    // A second webhook for the same clearing finds nothing open.
    expect((await handleMeetingEdit(h.deps, '30', DATE)).outcome).toBe('echo');
  });

  it('a Meet link pasted by hand is the one the hour-before sends', async () => {
    const h = await booked();
    h.crm.cards.get('30')!.meetingLink = 'https://meet.google.com/xyz-abcd-efg';
    expect((await handleMeetingEdit(h.deps, '30', LINK)).outcome).toBe('link_updated');
    at(h, '2026-10-28T08:00:00Z');
    await runReminders(h.deps);
    expect(h.messenger.fields.at(-1)!.fields.V3_Meet_Code).toBe('xyz-abcd-efg');
  });

  it('a date set on a card with no booking becomes a meeting with reminders; a day alone or a past date does not', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'reminder_day', 'reminder_hour');
    h.crm.add(card({ id: '40', status: 'בניסיונות תפיסה', demoDate: '2026-10-30T10:00:00.000Z' }));
    expect((await handleMeetingEdit(h.deps, '40', DEMO_DATE)).outcome).toBe('created');
    expect(h.crm.updates[0]!.text).toContain('נרשמה ידנית פגישת הדמו');
    // A manual meeting needs a status that says so for the reminder to go.
    h.crm.cards.get('40')!.status = 'נקבעה פגישת דמו';
    at(h, '2026-10-29T10:00:00Z');
    expect((await runReminders(h.deps))[0]).toMatchObject({ kind: 'reminder_day', outcome: 'sent' });

    h.crm.add(card({ id: '41', meetingDate: '2026-11-02' }));
    expect((await handleMeetingEdit(h.deps, '41', DATE)).outcome).toBe('no_time');
    h.crm.add(card({ id: '42', meetingDate: '2026-01-01T10:00:00.000Z' }));
    expect((await handleMeetingEdit(h.deps, '42', DATE)).outcome).toBe('past');
  });

  it('the monday webhook routes the meeting columns here', async () => {
    const h = await booked();
    const res = await h.app.request('/webhooks/monday?token=mon-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: { boardId: 1753447162, pulseId: 30, columnId: DATE, type: 'update_column_value' } }),
    });
    expect(await res.json()).toEqual({ outcome: 'echo', itemId: '30' });
  });
});
