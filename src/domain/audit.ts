import type { Db } from '../db/db.js';
import type { CrmPort } from '../ports.js';
import { bookingPage } from './links.js';

// Does the board say what V3's bookings say? Every meeting still ahead,
// compared with its card: the date, the room, and (needs-mapping) the
// change-or-cancel link. Reads only.

export interface MeetingAudit {
  uid: string;
  itemId: string;
  meeting: string;
  start: string;
  ok: boolean;
  problems: string[];
}

export async function auditMeetings(deps: { db: Db; crm: CrmPort }): Promise<MeetingAudit[]> {
  const rows = await deps.db.query<{ uid: string; monday_item_id: string; meeting: string; start_at: string; meeting_url: string | null }>(
    "select uid, monday_item_id, meeting, start_at, meeting_url from bookings where status = 'booked' and start_at > now() order by start_at"
  );
  const out: MeetingAudit[] = [];
  for (const b of rows.rows) {
    const start = new Date(b.start_at).toISOString();
    const problems: string[] = [];
    const card = await deps.crm.getCard(b.monday_item_id);
    if (!card) {
      out.push({ uid: b.uid, itemId: b.monday_item_id, meeting: b.meeting, start, ok: false, problems: ['card not on the board'] });
      continue;
    }
    const demo = b.meeting === 'demo';
    const date = (demo ? card.demoDate : card.meetingDate) ?? '';
    const link = demo ? card.demoLink : card.meetingLink;
    if (!date) problems.push('date empty');
    else if (!date.includes('T')) problems.push(`date without time (${date})`);
    else if (Math.abs(new Date(date).getTime() - new Date(start).getTime()) > 60_000) problems.push(`date differs (${date})`);
    const room = b.meeting_url ?? bookingPage(b.uid);
    if (!link) problems.push('meeting link empty');
    else if (link !== room) problems.push(`meeting link differs (${link.slice(0, 60)})`);
    if (!demo && !b.uid.startsWith('manual-')) {
      const change = card.meetingChangeLink ?? '';
      if (!change) problems.push('change/cancel link empty');
      else if (change !== bookingPage(b.uid)) problems.push(`change/cancel link differs (${change.slice(0, 60)})`);
    }
    out.push({ uid: b.uid, itemId: b.monday_item_id, meeting: b.meeting, start, ok: problems.length === 0, problems });
  }
  return out;
}
