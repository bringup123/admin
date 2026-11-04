import { COL } from '../board.js';
import type { Clock, CrmPort, MessengerPort } from '../ports.js';
import type { Db } from '../db/db.js';
import type { Env } from '../env.js';
import { meetingToContact, type Meeting } from './calcom.js';
import { MEETING_HE, meetingWhen } from './reminders.js';

// A person changes a meeting on the board instead of in cal.com (Ayala,
// 2026-11-04). The reminders and ManyChat read V3's bookings, so the change
// is copied there: a new date or time moves the reminders, a cleared date
// stops them, a pasted room becomes the one the hour-before sends, and a date
// set on a card with no booking (a meeting arranged by telephone) becomes one.
// cal.com and Sagi's calendar are not changed — the card says so.
//
// V3 writes these same cells on every booking, and monday sends that back
// too. A cell that already says what the booking says is that echo.

export const MEETING_COLUMNS: Record<string, { meeting: Meeting; kind: 'date' | 'link' }> = {
  [COL.meetingDate]: { meeting: 'needs_mapping', kind: 'date' },
  [COL.meetingLink]: { meeting: 'needs_mapping', kind: 'link' },
  [COL.demoDate]: { meeting: 'demo', kind: 'date' },
  [COL.demoLink]: { meeting: 'demo', kind: 'link' },
};

export interface BoardEditDeps {
  db: Db;
  env: Env;
  crm: CrmPort;
  messenger: MessengerPort;
  clock: Clock;
}

export type BoardEditOutcome = { outcome: string; itemId: string };

/** A meeting room, as opposed to a booking page or V3's own booking link. */
function isRoom(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/cal\.com\//i.test(url);
}

const NOT_IN_CALENDAR = 'שימו לב: ב-Cal.com וביומן של שגיא הפגישה לא השתנתה.';

export async function handleMeetingEdit(deps: BoardEditDeps, itemId: string, columnId: string): Promise<BoardEditOutcome> {
  const { db, env, crm, clock } = deps;
  const col = MEETING_COLUMNS[columnId];
  if (!col) return { outcome: 'ignored', itemId };
  const card = await crm.getCard(itemId);
  if (!card) return { outcome: 'not_on_board', itemId };
  const { meeting } = col;
  const date = (meeting === 'needs_mapping' ? card.meetingDate : card.demoDate) ?? '';
  const link = meeting === 'needs_mapping' ? card.meetingLink : card.demoLink;
  const room = isRoom(link) ? link : undefined;
  const now = clock.now();
  const log = (type: string, payload: unknown) =>
    db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [type, itemId, JSON.stringify(payload)]);
  const r = await db.query<{ uid: string; start_at: string | null; meeting_url: string | null }>(
    `select uid, start_at, meeting_url from bookings where monday_item_id = $1 and meeting = $2 and status = 'booked'
      order by created_at desc limit 1`,
    [itemId, meeting]
  );
  const row = r.rows[0];
  const name = MEETING_HE[meeting];

  if (col.kind === 'link') {
    // A booking link V3 wrote, or a room that is already the booking's.
    if (!row || !room || room === row.meeting_url) return { outcome: 'echo', itemId };
    await db.query('update bookings set meeting_url = $2, updated_at = now() where uid = $1', [row.uid, room]);
    if (row.start_at) await meetingToContact(deps, itemId, meeting, new Date(row.start_at), row.uid, room);
    await crm.postUpdate(itemId, `הלינק ל${name} עודכן ידנית במאנדיי. התזכורת שעה לפני תשלח את הלינק החדש. ${NOT_IN_CALENDAR}`);
    await log('meeting_edited_by_hand', { meeting, field: 'link', uid: row.uid });
    return { outcome: 'link_updated', itemId };
  }

  if (!date) {
    // Cleared. V3 clears the cell itself on a cancellation, after it has
    // already closed the booking — so a booking still open means a person.
    if (!row) return { outcome: 'echo', itemId };
    await db.query("update bookings set status = 'cleared_by_hand', updated_at = now() where uid = $1", [row.uid]);
    await crm.postUpdate(itemId, `תאריך ${name} נמחק ידנית במאנדיי, ולכן לא יישלחו תזכורות לפגישה הזו. ${NOT_IN_CALENDAR}`);
    await log('meeting_edited_by_hand', { meeting, field: 'cleared', uid: row.uid });
    return { outcome: 'cleared', itemId };
  }

  if (!date.includes('T')) {
    await crm.postUpdate(itemId, `ב${name} נרשם תאריך בלי שעה, ולכן לא יישלחו תזכורות. כדי שיישלחו — להוסיף שעה לתאריך.`);
    await log('meeting_edited_by_hand', { meeting, field: 'date_without_time' });
    return { outcome: 'no_time', itemId };
  }

  const start = new Date(date);
  if (row?.start_at && Math.abs(new Date(row.start_at).getTime() - start.getTime()) < 60_000) {
    return { outcome: 'echo', itemId };
  }
  if (row) {
    // The move counts as booked now: a reminder whose moment has passed is
    // not sent late (src/domain/reminders.ts).
    await db.query('update bookings set start_at = $2, meeting_url = coalesce($3, meeting_url), created_at = $4, updated_at = now() where uid = $1', [
      row.uid,
      start.toISOString(),
      room ?? null,
      now.toISOString(),
    ]);
    await meetingToContact(deps, itemId, meeting, start, row.uid, room ?? row.meeting_url ?? undefined);
    await crm.postUpdate(
      itemId,
      `מועד ${name} עודכן ידנית במאנדיי ל${meetingWhen(start, env.timezone)}. התזכורות והשדות במאניצ'אט עודכנו. ${NOT_IN_CALENDAR}`
    );
    await log('meeting_edited_by_hand', { meeting, field: 'date', uid: row.uid, start: start.toISOString() });
    return { outcome: 'moved', itemId };
  }
  // No booking behind it: a meeting arranged some other way. A past date is
  // a record, not a meeting to remind anyone of.
  if (start <= now) return { outcome: 'past', itemId };
  const uid = `manual-${itemId}-${meeting}-${now.getTime()}`;
  await db.query(
    'insert into bookings (uid, monday_item_id, meeting, start_at, meeting_url, created_at) values ($1, $2, $3, $4, $5, $6)',
    [uid, itemId, meeting, start.toISOString(), room ?? null, now.toISOString()]
  );
  await meetingToContact(deps, itemId, meeting, start, uid, room);
  await crm.postUpdate(
    itemId,
    `נרשמה ידנית ${name} ל${meetingWhen(start, env.timezone)}, והליד יקבל עליה תזכורות.${room ? '' : ' אין לה לינק לפגישה, ולכן התזכורת שעה לפני לא תישלח — אפשר להדביק לינק Meet בעמודת הלינק.'} ${NOT_IN_CALENDAR}`
  );
  await log('meeting_edited_by_hand', { meeting, field: 'created', uid, start: start.toISOString() });
  return { outcome: 'created', itemId };
}
