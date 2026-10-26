import { STATUS } from '../board.js';
import type { CardWrite, Clock, CrmPort } from '../ports.js';
import type { Db } from '../db/db.js';
import type { Env } from '../env.js';
import { bookingPage, CALCOM_LEAD_QUESTION, cardBookingUrl } from './links.js';
import { BOOKING_LINK_TEXT, DEMO_LINK_TEXT } from './welcome.js';

// What cal.com tells V3 after the fact. Copied from the dafna project
// (src/domain/calcom-webhook.ts, live since 2026-09-03) and cut to what V3
// needs: no queued meeting messages, no dial to withdraw. Added: the two event
// types are told apart (Sagi's brief, part 6) — the dafna version took every
// booking on the account as a needs-mapping meeting.

export const HANDLED_TRIGGERS = new Set(['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED']);

export type Meeting = 'needs_mapping' | 'demo';

export interface CalcomEvent {
  trigger: string;
  uid: string;
  start?: Date;
  attendees: Array<{ name: string; email: string }>;
  /** The card id the booking carries in the hidden question. */
  itemIdHint?: string;
  meetingUrl?: string;
  rescheduleUid?: string;
  cancellationReason?: string;
  eventTypeId?: number;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The hidden question's answer, whichever shape cal.com sends it in: a bare
 *  value, `{ label, value }`, or `{ value, isHidden }`. */
function responseValue(responses: unknown, key: string): string | undefined {
  if (!responses || typeof responses !== 'object') return undefined;
  const raw = (responses as Record<string, unknown>)[key];
  if (raw && typeof raw === 'object') return str((raw as Record<string, unknown>).value);
  return str(raw);
}

export function parseCalcomEvent(body: unknown): CalcomEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const trigger = str(b.triggerEvent);
  const payload = (b.payload ?? {}) as Record<string, unknown>;
  const uid = str(payload.uid);
  if (!trigger || !uid) return null;
  const startRaw = str(payload.startTime);
  const start = startRaw ? new Date(startRaw) : undefined;
  const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
  const video = (payload.videoCallData ?? {}) as Record<string, unknown>;
  const location = str(payload.location);
  const attendees = Array.isArray(payload.attendees)
    ? (payload.attendees as Array<Record<string, unknown>>).map((a) => ({
        name: str(a.name) ?? '',
        email: (str(a.email) ?? '').toLowerCase(),
      }))
    : [];
  const hint = responseValue(payload.responses, CALCOM_LEAD_QUESTION) ?? str(metadata.itemId);
  const typeId = Number(payload.eventTypeId);
  return {
    trigger,
    uid,
    start: start && !Number.isNaN(start.getTime()) ? start : undefined,
    attendees,
    // A card id is digits; anything else in the field is not one.
    ...(hint && /^\d+$/.test(hint) ? { itemIdHint: hint } : {}),
    ...(() => {
      const url =
        str(video.url) ?? str(metadata.videoCallUrl) ?? (location && /^https?:\/\//.test(location) ? location : undefined);
      return url ? { meetingUrl: url } : {};
    })(),
    ...(str(payload.rescheduleUid) ? { rescheduleUid: str(payload.rescheduleUid)! } : {}),
    ...(str(payload.cancellationReason) ? { cancellationReason: str(payload.cancellationReason)! } : {}),
    ...(Number.isFinite(typeId) && typeId > 0 ? { eventTypeId: typeId } : {}),
  };
}

export type CalcomOutcome =
  | { outcome: 'ignored'; reason: string }
  | { outcome: 'already_recorded'; itemId: string }
  | { outcome: 'unmatched'; uid: string }
  | { outcome: 'booked' | 'rescheduled' | 'cancelled'; itemId: string; meeting: Meeting };

export interface CalcomDeps {
  db: Db;
  env: Env;
  crm: CrmPort;
  /** When a booking was recorded: a meeting booked inside a reminder's
   *  window gets no reminder for it (src/domain/reminders.ts). */
  clock: Clock;
}

interface BookingRow {
  uid: string;
  monday_item_id: string;
  meeting: Meeting;
  status: string;
}

export function meetingFor(env: Pick<Env, 'calcomEventTypeId' | 'calcomDemoEventTypeId'>, typeId?: number): Meeting | null {
  if (!typeId) return null;
  if (typeId === env.calcomEventTypeId) return 'needs_mapping';
  if (env.calcomDemoEventTypeId && typeId === env.calcomDemoEventTypeId) return 'demo';
  return null;
}

/** The card columns a booking of each kind writes. */
function bookedWrite(meeting: Meeting, start: Date, uid: string, meetingUrl?: string): CardWrite {
  const room = meetingUrl ?? bookingPage(uid);
  if (meeting === 'needs_mapping') {
    return {
      status: STATUS.meetingBooked,
      meetingDate: start.toISOString(),
      meetingLink: { url: room, text: 'פגישה' },
      meetingChangeLink: { url: bookingPage(uid), text: 'שינוי/ביטול' },
    };
  }
  return { status: STATUS.demoBooked, demoDate: start.toISOString(), demoLink: { url: room, text: 'דמו' } };
}

export async function handleCalcomWebhook(deps: CalcomDeps, body: unknown): Promise<CalcomOutcome> {
  const { db, env, crm } = deps;
  const ev = parseCalcomEvent(body);
  if (!ev) return { outcome: 'ignored', reason: 'not a booking event' };
  if (!HANDLED_TRIGGERS.has(ev.trigger)) return { outcome: 'ignored', reason: ev.trigger };
  const log = (type: string, itemId: string | null, payload: unknown) =>
    db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [type, itemId, JSON.stringify(payload)]);
  const byUid = async (uid: string | undefined): Promise<BookingRow | undefined> => {
    if (!uid) return undefined;
    const r = await db.query<BookingRow>('select uid, monday_item_id, meeting, status from bookings where uid = $1', [uid]);
    return r.rows[0];
  };

  if (ev.trigger === 'BOOKING_CANCELLED') {
    const row = await byUid(ev.uid);
    if (!row) {
      await log('meeting_cancelled_unknown', null, { uid: ev.uid, attendees: ev.attendees });
      return { outcome: 'ignored', reason: 'unknown booking' };
    }
    if (row.status === 'cancelled') return { outcome: 'ignored', reason: 'already cancelled' };
    const itemId = row.monday_item_id;
    await db.query("update bookings set status = 'cancelled', updated_at = now() where uid = $1", [row.uid]);
    const card = await crm.getCard(itemId);
    const lead = { itemId, name: card?.name ?? '', email: card?.email ?? '' };
    // The label goes back to Sagi only if it is still the one the booking
    // wrote: a status a person moved since is theirs (dafna, 2026-08-31).
    if (row.meeting === 'needs_mapping') {
      const stillBooked = card?.status === STATUS.meetingBooked;
      await crm.updateCard(itemId, {
        meetingDate: null,
        meetingChangeLink: null,
        // The booking link back in the cell it came out of: a Lead who
        // cancelled can book again.
        meetingLink: env.bookingUrl ? { url: cardBookingUrl(env.bookingUrl, env, lead), text: BOOKING_LINK_TEXT } : null,
        ...(stillBooked ? { status: STATUS.sagiCheck } : {}),
      });
      await log('meeting_cancelled', itemId, { uid: ev.uid, meeting: row.meeting, reason: ev.cancellationReason ?? null, statusReset: stillBooked });
    } else {
      const stillBooked = card?.status === STATUS.demoBooked;
      await crm.updateCard(itemId, {
        demoDate: null,
        demoLink: env.demoBookingUrl ? { url: cardBookingUrl(env.demoBookingUrl, env, lead), text: DEMO_LINK_TEXT } : null,
        ...(stillBooked ? { status: STATUS.sagiCheck } : {}),
      });
      await log('meeting_cancelled', itemId, { uid: ev.uid, meeting: row.meeting, reason: ev.cancellationReason ?? null, statusReset: stillBooked });
    }
    await crm.postUpdate(
      itemId,
      `${row.meeting === 'demo' ? 'פגישת הדמו' : 'פגישת מיפוי הצרכים'} בוטלה ב-Cal.com${ev.cancellationReason ? `. סיבה: ${ev.cancellationReason}` : ''}.`
    );
    return { outcome: 'cancelled', itemId, meeting: row.meeting };
  }

  if (!ev.start) return { outcome: 'ignored', reason: 'no start time' };

  if (ev.trigger === 'BOOKING_RESCHEDULED') {
    const row = (await byUid(ev.rescheduleUid)) ?? (await byUid(ev.uid));
    if (row && row.status !== 'cancelled') {
      const itemId = row.monday_item_id;
      if (row.uid !== ev.uid) {
        await db.query("update bookings set status = 'cancelled', replaced_by = $2, updated_at = now() where uid = $1", [row.uid, ev.uid]);
        await db.query(
          `insert into bookings (uid, monday_item_id, meeting, start_at, meeting_url, created_at) values ($1, $2, $3, $4, $5, $6)
           on conflict (uid) do update set start_at = excluded.start_at, meeting_url = coalesce(excluded.meeting_url, bookings.meeting_url), status = 'booked', updated_at = now()`,
          [ev.uid, itemId, row.meeting, ev.start.toISOString(), ev.meetingUrl ?? null, deps.clock.now().toISOString()]
        );
      } else {
        // A move on the same uid counts as booked now, for the reminders.
        await db.query('update bookings set start_at = $2, meeting_url = coalesce($3, meeting_url), created_at = $4, updated_at = now() where uid = $1', [
          row.uid,
          ev.start.toISOString(),
          ev.meetingUrl ?? null,
          deps.clock.now().toISOString(),
        ]);
      }
      const { status: _keep, ...dates } = bookedWrite(row.meeting, ev.start, ev.uid, ev.meetingUrl);
      // A move keeps whatever status the card has now.
      await crm.updateCard(itemId, dates);
      await log('meeting_rescheduled', itemId, { from: row.uid, to: ev.uid, start: ev.start.toISOString(), meeting: row.meeting });
      return { outcome: 'rescheduled', itemId, meeting: row.meeting };
    }
    // A reschedule of a booking V3 never saw is treated as a new booking.
  }

  // BOOKING_CREATED, or a reschedule with no row behind it.
  const meeting = meetingFor(env, ev.eventTypeId);
  if (!meeting) {
    // Another of Sagi's event types — not V3's business.
    return { outcome: 'ignored', reason: `event type ${ev.eventTypeId ?? 'missing'}` };
  }
  const echo = await byUid(ev.uid);
  if (echo) return { outcome: 'already_recorded', itemId: echo.monday_item_id };

  let itemId: string | null = null;
  if (ev.itemIdHint && (await crm.getCard(ev.itemIdHint))) itemId = ev.itemIdHint;
  if (!itemId) itemId = await matchByEmail(deps, ev);
  if (!itemId) {
    await log('booking_unmatched', null, {
      uid: ev.uid,
      meeting,
      start: ev.start.toISOString(),
      attendees: ev.attendees,
      hint: ev.itemIdHint ?? null,
    });
    return { outcome: 'unmatched', uid: ev.uid };
  }

  // A Lead who books again has two meetings in the diary; the newer one is
  // the one they mean.
  await db.query(
    "update bookings set status = 'cancelled', replaced_by = $3, updated_at = now() where monday_item_id = $1 and meeting = $2 and status = 'booked'",
    [itemId, meeting, ev.uid]
  );
  await db.query('insert into bookings (uid, monday_item_id, meeting, start_at, meeting_url, created_at) values ($1, $2, $3, $4, $5, $6)', [
    ev.uid,
    itemId,
    meeting,
    ev.start.toISOString(),
    ev.meetingUrl ?? null,
    deps.clock.now().toISOString(),
  ]);
  await crm.updateCard(itemId, bookedWrite(meeting, ev.start, ev.uid, ev.meetingUrl));
  await crm.postUpdate(
    itemId,
    `נקבעה ${meeting === 'demo' ? 'פגישת דמו' : 'פגישת מיפוי צרכים'} ב-Cal.com ל-${formatIsrael(ev.start, env.timezone)}. שינוי/ביטול: ${bookingPage(ev.uid)}`
  );
  await log('meeting_booked', itemId, { uid: ev.uid, meeting, start: ev.start.toISOString() });
  return { outcome: 'booked', itemId, meeting };
}

export function formatIsrael(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(d);
}

/** The fallback for a link that carried no id. The placeholder address every
 *  emailless Lead books under would match them all to each other, so it is
 *  never looked up. */
async function matchByEmail(deps: CalcomDeps, ev: CalcomEvent): Promise<string | null> {
  const placeholder = deps.env.noEmailAddress.toLowerCase();
  for (const a of ev.attendees) {
    if (!a.email || a.email === placeholder) continue;
    const hit = await deps.crm.findCardByEmail(a.email);
    if (hit) return hit;
  }
  return null;
}
