import { STATUS } from '../board.js';
import type { Meeting } from './calcom.js';
import { REFUSAL_HE, sendMessage, type SendResult } from './send.js';
import type { WelcomeDeps } from './welcome.js';

// Two WhatsApp reminders before every needs-mapping and demo meeting: a day
// before, and an hour before with the Meet link (Ayala, 2026-10-26). V3 times
// them and ManyChat sends them, like every other message: the contact's fields
// are set and a tag is added.
//
// Nothing is scheduled ahead. Each tick reads the live bookings, so a
// cancelled meeting is no longer among them and a moved one carries its new
// time; v3.reminders only records that a reminder was dealt with.

export type ReminderKind = 'reminder_day' | 'reminder_hour';
const KINDS: ReminderKind[] = ['reminder_day', 'reminder_hour'];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Saturday night, after Shabbat has gone out everywhere in Israel all year
 *  round (the latest is about 20:45, in June). */
const MOTZEI_SHABBAT_HOUR = 21;
/** From Friday afternoon. */
const SHABBAT_FROM_HOUR = 15;

export const MEETING_HE: Record<Meeting, string> = { needs_mapping: 'פגישת מיפוי הצרכים', demo: 'פגישת הדמו' };
const KIND_HE: Record<ReminderKind, string> = { reminder_day: 'יום לפני', reminder_hour: 'שעה לפני' };

interface WallTime {
  weekday: number; // 0 = Sunday
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function wallTime(d: Date, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/** The instant a wall-clock time names in the zone (two passes cover a
 *  daylight-saving change between the guess and the answer). */
function fromWallTime(y: number, m: number, d: number, h: number, timeZone: string): Date {
  let t = Date.UTC(y, m - 1, d, h);
  for (let i = 0; i < 2; i++) {
    const w = wallTime(new Date(t), timeZone);
    const shown = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    t += Date.UTC(y, m - 1, d, h) - shown;
  }
  return new Date(t);
}

/** A moment between Friday afternoon and Saturday night moves to Saturday
 *  night (Ayala, 2026-10-26: «במוצאי שבת»). Holidays are not known here. */
export function outOfShabbat(d: Date, timeZone: string): Date {
  const w = wallTime(d, timeZone);
  const friday = w.weekday === 5 && w.hour >= SHABBAT_FROM_HOUR;
  const saturday = w.weekday === 6 && w.hour < MOTZEI_SHABBAT_HOUR;
  if (!friday && !saturday) return d;
  const sat = new Date(Date.UTC(w.year, w.month - 1, w.day + (friday ? 1 : 0)));
  return fromWallTime(sat.getUTCFullYear(), sat.getUTCMonth() + 1, sat.getUTCDate(), MOTZEI_SHABBAT_HOUR, timeZone);
}

export function reminderDue(kind: ReminderKind, start: Date, timeZone: string): Date {
  if (kind === 'reminder_hour') return new Date(start.getTime() - HOUR);
  return outOfShabbat(new Date(start.getTime() - 24 * HOUR), timeZone);
}

/** Past this, the reminder is not sent at all: a «day before» two hours
 *  before, or an «hour before» with the meeting about to start, is noise. */
function lastChance(kind: ReminderKind, start: Date): Date {
  return new Date(start.getTime() - (kind === 'reminder_day' ? 2 * HOUR : 10 * MINUTE));
}

/** «יום שני, 27.10 בשעה 10:00» — one field for the whole moment, so the
 *  template has a single variable and nothing to reorder in a Hebrew line. */
export function meetingWhen(start: Date, timeZone: string): string {
  const w = wallTime(start, timeZone);
  const day = new Intl.DateTimeFormat('he-IL', { timeZone, weekday: 'long' }).format(start);
  return `${day}, ${w.day}.${w.month} בשעה ${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

/** «abc-defg-hij» out of a Google Meet address; the template's button base
 *  is `https://meet.google.com/` and this is its variable. */
export function meetCode(url: string | null | undefined): string | undefined {
  return url?.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})\b/)?.[1];
}

interface BookingRow {
  uid: string;
  monday_item_id: string;
  meeting: Meeting;
  start_at: string;
  meeting_url: string | null;
  created_at: string;
}

type Outcome = { uid: string; kind: ReminderKind; outcome: string };

/** One pass. Called by the tick, every minute. */
export async function runReminders(deps: WelcomeDeps): Promise<Outcome[]> {
  const { db, env, crm, clock } = deps;
  const now = clock.now();
  const log = (type: string, itemId: string, payload: unknown) =>
    db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [type, itemId, JSON.stringify(payload)]);
  // A day-before reminder is never later than 24 hours before the meeting
  // (Shabbat only moves it later), so nothing further out can be due.
  const upcoming = await db.query<BookingRow>(
    `select uid, monday_item_id, meeting, start_at, meeting_url, created_at from bookings
      where status = 'booked' and start_at > $1 and start_at <= $2 order by start_at`,
    [now.toISOString(), new Date(now.getTime() + 25 * HOUR).toISOString()]
  );
  const out: Outcome[] = [];
  for (const b of upcoming.rows) {
    const start = new Date(b.start_at);
    for (const kind of KINDS) {
      const due = reminderDue(kind, start, env.timezone);
      if (now < due) continue;
      // The claim. A second tick conflicts here; so does every tick after
      // this reminder was settled, whatever the outcome.
      const claimed = await db.query(
        `insert into reminders (booking_uid, kind, start_at, monday_item_id, created_at) values ($1, $2, $3, $4, $5)
         on conflict do nothing returning booking_uid`,
        [b.uid, kind, start.toISOString(), b.monday_item_id, now.toISOString()]
      );
      if (!claimed.rows.length) continue;
      const settle = async (status: 'sent' | 'skipped', outcome: string) => {
        await db.query(
          'update reminders set status = $4, outcome = $5, updated_at = now() where booking_uid = $1 and kind = $2 and start_at = $3',
          [b.uid, kind, start.toISOString(), status, outcome]
        );
        out.push({ uid: b.uid, kind, outcome });
      };
      try {
        // Booked inside the window: the Lead has just chosen this time.
        if (new Date(b.created_at) > due) {
          await settle('skipped', 'booked_late');
          continue;
        }
        if (now >= lastChance(kind, start)) {
          await log('reminder_too_late', b.monday_item_id, { uid: b.uid, kind, due: due.toISOString() });
          await settle('skipped', 'too_late');
          continue;
        }
        const card = await crm.getCard(b.monday_item_id);
        if (!card) {
          await settle('skipped', 'not_on_board');
          continue;
        }
        // A person who moved the card on («לא רלוונטי», a meeting held, a
        // deal) has said this meeting is not the Lead's next step.
        if (card.status !== STATUS.meetingBooked && card.status !== STATUS.demoBooked) {
          await log('reminder_status_moved', b.monday_item_id, { uid: b.uid, kind, status: card.status });
          await settle('skipped', 'status_moved');
          continue;
        }
        const code = meetCode(b.meeting_url);
        if (kind === 'reminder_hour' && !code) {
          await crm.postUpdate(
            b.monday_item_id,
            `תזכורת שעה לפני ${MEETING_HE[b.meeting]} לא נשלחה: לפגישה אין לינק Google Meet.`
          );
          await settle('skipped', 'no_meet_link');
          continue;
        }
        const result: SendResult = await sendMessage(deps, {
          kind,
          itemId: b.monday_item_id,
          rawPhone: card.phone,
          cardName: card.name,
          dedupeKey: `${kind}:${b.uid}:${start.toISOString()}`,
          fields: {
            V3_Meeting_Type: MEETING_HE[b.meeting],
            V3_Meeting_When: meetingWhen(start, env.timezone),
            V3_Booking_Uid: b.uid,
            ...(code ? { V3_Meet_Code: code } : {}),
          },
        });
        if (!result.sent && result.reason === 'channel_failed') {
          // ManyChat failed and nothing was spent: tried again next tick.
          throw new Error(`channel_failed: ${result.detail ?? ''}`);
        }
        if (!result.sent) {
          // Like the welcome: a reminder a switch held back is not sent later.
          if (result.reason !== 'paused' && result.reason !== 'switch_off' && result.reason !== 'not_allowlisted') {
            await crm.postUpdate(b.monday_item_id, `תזכורת ${KIND_HE[kind]} ${MEETING_HE[b.meeting]}: ${REFUSAL_HE[result.reason]}`);
          }
          await settle('skipped', result.reason);
          continue;
        }
        await crm.postUpdate(
          b.monday_item_id,
          `נשלחה לליד תזכורת בוואטסאפ ${KIND_HE[kind]} ${MEETING_HE[b.meeting]} (${meetingWhen(start, env.timezone)}).`
        );
        await settle('sent', 'sent');
      } catch (err) {
        // A board or network failure: the claim goes, and the next tick tries
        // again until the last chance passes.
        await db.query('delete from reminders where booking_uid = $1 and kind = $2 and start_at = $3', [b.uid, kind, start.toISOString()]);
        await log('reminder_error', b.monday_item_id, {
          uid: b.uid,
          kind,
          error: err instanceof Error ? err.message.slice(0, 500) : String(err),
        });
        out.push({ uid: b.uid, kind, outcome: 'error' });
      }
    }
  }
  return out;
}
