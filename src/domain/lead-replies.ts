import { createHmac } from 'node:crypto';
import type { Db } from '../db/db.js';
import type { Env } from '../env.js';
import type { CrmPort } from '../ports.js';
import type { Meeting } from './calcom.js';
import { MEETING_HE, meetingWhen } from './reminders.js';

// What a Lead pressed in WhatsApp, brought back to the card (Ayala,
// 2026-11-01). ManyChat's automation on the reminder's quick replies calls
// POST /webhooks/manychat with the contact's dafna_lead_id. Nothing is sent
// from here; the card gets an update the rep reads.

export const LEAD_REPLIES = {
  /** «מאשר/ת הגעה» on the day-before reminder. */
  confirmed: (about: string) => `הליד אישר הגעה${about} (לחץ «מאשר/ת הגעה» בתזכורת).`,
  /** «שינוי מועד» on the day-before reminder. A move or a cancellation made
   *  on cal.com arrives by itself; this says only that the Lead asked. */
  reschedule_requested: (about: string) =>
    `הליד ביקש לשנות מועד${about} (לחץ «שינוי מועד» בתזכורת). אם ישנה או יבטל ב-Cal.com, הכרטיס יתעדכן מעצמו.`,
} as const;
export type LeadReply = keyof typeof LEAD_REPLIES;

/** The secret in the URL ManyChat calls. Derived from CRON_SECRET, so it needs
 *  no setting of its own on Vercel; `scripts/manychat-callback-url.ts` prints it. */
export function manychatCallbackToken(env: Pick<Env, 'cronSecret'>): string {
  if (!env.cronSecret) return '';
  return createHmac('sha256', env.cronSecret).update('v3 manychat callback').digest('hex').slice(0, 32);
}

export type LeadReplyOutcome =
  | { outcome: 'ignored'; reason: string }
  | { outcome: 'noted'; itemId: string; reply: LeadReply };

export async function handleLeadReply(
  deps: { db: Db; env: Env; crm: CrmPort },
  body: unknown
): Promise<LeadReplyOutcome> {
  const { db, env, crm } = deps;
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const itemId = String(b.leadId ?? '').trim();
  const reply = String(b.event ?? '').trim();
  const log = (type: string, payload: unknown) =>
    db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [
      type,
      /^\d+$/.test(itemId) ? itemId : null,
      JSON.stringify(payload),
    ]);
  // An empty field in ManyChat sends "" or the literal placeholder.
  if (!/^\d+$/.test(itemId)) {
    await log('lead_reply_refused', { reason: 'no_lead_id', leadId: itemId.slice(0, 60), event: reply.slice(0, 60) });
    return { outcome: 'ignored', reason: 'no_lead_id' };
  }
  if (!Object.prototype.hasOwnProperty.call(LEAD_REPLIES, reply)) {
    await log('lead_reply_refused', { reason: 'unknown_event', event: reply.slice(0, 60) });
    return { outcome: 'ignored', reason: 'unknown_event' };
  }
  const card = await crm.getCard(itemId);
  if (!card) {
    await log('lead_reply_refused', { reason: 'not_on_board', event: reply });
    return { outcome: 'ignored', reason: 'not_on_board' };
  }
  // The meeting the Lead is answering about: the next one still booked.
  const next = await db.query<{ meeting: Meeting; start_at: string }>(
    `select meeting, start_at from bookings where monday_item_id = $1 and status = 'booked' and start_at > now()
      order by start_at limit 1`,
    [itemId]
  );
  const m = next.rows[0];
  const about = m ? ` ל${MEETING_HE[m.meeting]} (${meetingWhen(new Date(m.start_at), env.timezone)})` : '';
  const kind = reply as LeadReply;
  await crm.postUpdate(itemId, LEAD_REPLIES[kind](about));
  await log('lead_reply', { event: kind });
  return { outcome: 'noted', itemId, reply: kind };
}
