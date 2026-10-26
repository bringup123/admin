import { describe, expect, it } from 'vitest';
import { handleCalcomWebhook } from '../src/domain/calcom.js';
import { meetingWhen, outOfShabbat, runReminders } from '../src/domain/reminders.js';
import { card, harness } from './helpers.js';

const NEEDS = 6812251;
const DEMO = 7000001;
const TZ = 'Asia/Jerusalem';

function booking(over: Record<string, unknown> = {}, trigger = 'BOOKING_CREATED') {
  return {
    triggerEvent: trigger,
    payload: {
      uid: 'u1',
      eventTypeId: NEEDS,
      // Wednesday 28.10, 11:00 in Israel.
      startTime: '2026-10-28T09:00:00Z',
      attendees: [{ name: 'דנה כהן', email: 'dana@example.com' }],
      responses: { dafna_lead: { value: '30', isHidden: true } },
      videoCallData: { url: 'https://meet.google.com/abc-defg-hij' },
      ...over,
    },
  };
}

async function booked(over: Record<string, unknown> = {}) {
  const h = await harness();
  await h.on('interactions_enabled', 'reminder_day', 'reminder_hour');
  h.crm.add(card({ id: '30', status: 'נשלחה הודעה ראשונה' }));
  // The clock starts on Monday 26.10, 08:00 UTC.
  await handleCalcomWebhook(h.deps, booking(over));
  return h;
}

const at = (h: Awaited<ReturnType<typeof harness>>, iso: string) => {
  h.clock.t = new Date(iso);
};

describe('meeting reminders', () => {
  it('a day before, then an hour before, each once, with the meeting in the fields', async () => {
    const h = await booked();
    at(h, '2026-10-27T08:59:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'sent' }]);
    expect(h.messenger.tags.map((t) => t.tag)).toEqual(['v3_reminder_day']);
    expect(h.messenger.fields.at(-1)!.fields).toMatchObject({
      V3_Name: 'דנה',
      V3_Meeting_Type: 'פגישת מיפוי הצרכים',
      V3_Meeting_When: 'יום רביעי, 28.10 בשעה 11:00',
      V3_Meet_Code: 'abc-defg-hij',
      V3_Booking_Uid: 'u1',
    });
    expect(h.crm.updates.at(-1)!.text).toContain('תזכורת בוואטסאפ יום לפני');
    at(h, '2026-10-27T09:05:00Z');
    expect(await runReminders(h.deps)).toEqual([]);

    at(h, '2026-10-28T08:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_hour', outcome: 'sent' }]);
    expect(h.messenger.tags.map((t) => t.tag)).toEqual(['v3_reminder_day', 'v3_reminder_hour']);
    at(h, '2026-10-28T08:01:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
  });

  it('a demo meeting is reminded too, and says so', async () => {
    const h = await booked({ uid: 'd1', eventTypeId: DEMO });
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'd1', kind: 'reminder_day', outcome: 'sent' }]);
    expect(h.messenger.fields.at(-1)!.fields.V3_Meeting_Type).toBe('פגישת הדמו');
  });

  it('a cancelled meeting is not reminded', async () => {
    const h = await booked();
    await handleCalcomWebhook(h.deps, booking({}, 'BOOKING_CANCELLED'));
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    expect(h.messenger.tags).toEqual([]);
  });

  it('a moved meeting is reminded at its new time only', async () => {
    const h = await booked();
    await handleCalcomWebhook(
      h.deps,
      booking({ uid: 'u2', rescheduleUid: 'u1', startTime: '2026-10-29T09:00:00Z' }, 'BOOKING_RESCHEDULED')
    );
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    at(h, '2026-10-28T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u2', kind: 'reminder_day', outcome: 'sent' }]);
    expect(h.messenger.fields.at(-1)!.fields.V3_Meeting_When).toBe('יום חמישי, 29.10 בשעה 11:00');
  });

  it('a meeting booked less than a day ahead gets the hour-before only', async () => {
    const h = await booked({ startTime: '2026-10-26T14:00:00Z' });
    at(h, '2026-10-26T13:00:00Z');
    expect(await runReminders(h.deps)).toEqual([
      { uid: 'u1', kind: 'reminder_day', outcome: 'booked_late' },
      { uid: 'u1', kind: 'reminder_hour', outcome: 'sent' },
    ]);
    expect(h.messenger.tags.map((t) => t.tag)).toEqual(['v3_reminder_hour']);
  });

  it('a Sunday meeting is reminded on Saturday night, not on Shabbat', async () => {
    // Sunday 1.11, 10:00 in Israel. A day before is Saturday 10:00.
    const h = await booked({ startTime: '2026-11-01T08:00:00Z' });
    at(h, '2026-10-31T08:00:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    at(h, '2026-10-31T18:59:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    // 21:00 in Israel.
    at(h, '2026-10-31T19:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'sent' }]);
  });

  it('Shabbat runs from Friday afternoon to Saturday 21:00, in summer time too', () => {
    expect(outOfShabbat(new Date('2026-10-30T10:00:00Z'), TZ)).toEqual(new Date('2026-10-30T10:00:00Z')); // Fri 12:00
    expect(outOfShabbat(new Date('2026-10-30T14:00:00Z'), TZ)).toEqual(new Date('2026-10-31T19:00:00Z')); // Fri 16:00
    expect(outOfShabbat(new Date('2026-10-31T19:30:00Z'), TZ)).toEqual(new Date('2026-10-31T19:30:00Z')); // Sat 21:30
    expect(outOfShabbat(new Date('2026-06-13T07:00:00Z'), TZ)).toEqual(new Date('2026-06-13T18:00:00Z')); // June, +3
    expect(meetingWhen(new Date('2026-11-01T08:00:00Z'), TZ)).toBe('יום ראשון, 1.11 בשעה 10:00');
  });

  it('a reminder its switch held back is not sent when the switch comes on', async () => {
    const h = await booked();
    await h.db.query("update control set value = 'false' where key = 'reminder_day'");
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'switch_off' }]);
    await h.on('reminder_day');
    at(h, '2026-10-27T09:01:00Z');
    expect(await runReminders(h.deps)).toEqual([]);
    expect(h.messenger.tags).toEqual([]);
    expect(h.crm.updates.some((u) => u.text.includes('תזכורת'))).toBe(false);
  });

  it('a card a person moved on is not reminded', async () => {
    const h = await booked();
    h.crm.cards.get('30')!.status = 'לא רלוונטי לעולם';
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'status_moved' }]);
    expect(h.messenger.tags).toEqual([]);
  });

  it('a tick that comes too late sends nothing', async () => {
    const h = await booked();
    at(h, '2026-10-28T07:30:00Z');
    expect(await runReminders(h.deps)).toEqual([
      { uid: 'u1', kind: 'reminder_day', outcome: 'too_late' },
    ]);
    expect(h.messenger.tags).toEqual([]);
  });

  it('no Meet link: the hour-before is not sent, and the card says why', async () => {
    const h = await booked({ videoCallData: {} });
    at(h, '2026-10-28T08:00:00Z');
    const out = await runReminders(h.deps);
    expect(out.find((o) => o.kind === 'reminder_hour')).toEqual({ uid: 'u1', kind: 'reminder_hour', outcome: 'no_meet_link' });
    expect(h.crm.updates.at(-1)!.text).toContain('אין לינק Google Meet');
  });

  it('a ManyChat failure is tried again on the next tick', async () => {
    const h = await booked();
    h.messenger.fail = true;
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'error' }]);
    h.messenger.fail = false;
    at(h, '2026-10-27T09:01:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'sent' }]);
  });

  it('outside the cage, nothing', async () => {
    const h = await booked();
    h.crm.cards.get('30')!.phone = '0529998877';
    at(h, '2026-10-27T09:00:00Z');
    expect(await runReminders(h.deps)).toEqual([{ uid: 'u1', kind: 'reminder_day', outcome: 'not_allowlisted' }]);
    expect(h.messenger.tags).toEqual([]);
  });
});
