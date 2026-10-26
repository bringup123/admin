import type { Db } from '../db/db.js';
import type { Env } from '../env.js';
import type { Clock, MessengerPort } from '../ports.js';
import { normalizePhone } from './phone.js';
import { readSwitches, type MessageKind } from './switches.js';

// The one way V3 sends a WhatsApp. Every guard is here, in this order, and
// every refusal is written down — a press that says nothing reads as a broken
// button (found in the dafna project, 2026-09-10).

export const TAGS: Record<MessageKind, string> = {
  welcome: 'v3_welcome',
  no_answer_3: 'v3_no_answer_3',
  no_answer_5: 'v3_no_answer_5',
  reminder_day: 'v3_reminder_day',
  reminder_hour: 'v3_reminder_hour',
};

export type Refusal =
  | 'paused'
  | 'switch_off'
  | 'invalid_phone'
  | 'not_allowlisted'
  | 'daily_cap'
  | 'no_first_name'
  | 'already_sent'
  | 'channel_failed';

export type SendResult = { sent: true; phone: string } | { sent: false; reason: Refusal; detail?: string };

export interface SendDeps {
  db: Db;
  env: Env;
  messenger: MessengerPort;
  clock: Clock;
}

/** The card on the CRM, as monday links it. */
export function cardUrl(itemId: string): string {
  return `https://bringup-io.monday.com/boards/1753447162/views/23542451/pulses/${itemId}`;
}

/** The first word of the card's title, which is the Lead's full name. A title
 *  with a digit in it, or none at all, is not a name to greet anyone by. */
export function firstName(cardName: string): string {
  const word = cardName.trim().split(/\s+/)[0] ?? '';
  const clean = word.replace(/[.,;:!?"'«»()\-–—]+$/g, '').replace(/^[.,;:!?"'«»()\-–—]+/g, '');
  if (!clean || /\d/.test(clean)) return '';
  return clean;
}

/** Midnight in the account's timezone, as an instant — the daily cap's day. */
function startOfLocalDay(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const sinceMidnightMs = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnightMs);
}

export async function sendMessage(
  deps: SendDeps,
  input: {
    kind: MessageKind;
    itemId: string;
    rawPhone: string;
    cardName: string;
    /** Once per Lead unless said otherwise; a reminder is once per meeting. */
    dedupeKey?: string;
    /** More contact fields for this message's template to read. */
    fields?: Record<string, string>;
  }
): Promise<SendResult> {
  const { db, env, messenger, clock } = deps;
  const { kind, itemId } = input;
  const refuse = async (reason: Refusal, detail?: string): Promise<SendResult> => {
    await db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [
      'send_refused',
      itemId,
      JSON.stringify({ kind, reason, ...(detail ? { detail } : {}) }),
    ]);
    return { sent: false, reason, ...(detail ? { detail } : {}) };
  };

  const sw = await readSwitches(db);
  if (!sw.interactions_enabled) return refuse('paused');
  if (!sw[kind]) return refuse('switch_off');

  const phone = normalizePhone(input.rawPhone);
  if (!phone) return refuse('invalid_phone');
  // Outside production the allowlist applies whatever the switch says.
  if ((env.appEnv !== 'production' || sw.allowlist_only) && !env.phoneAllowlist.includes(phone)) {
    return refuse('not_allowlisted');
  }

  const since = startOfLocalDay(clock.now(), env.timezone);
  const today = await db.query<{ n: string }>(
    "select count(*)::text as n from messages where created_at >= $1 and status <> 'failed'",
    [since.toISOString()]
  );
  if (Number(today.rows[0]?.n ?? 0) >= env.maxMessagesPerDay) return refuse('daily_cap');

  const name = firstName(input.cardName);
  if (!name) return refuse('no_first_name');

  // Once only, for ever. A second attempt conflicts here and sends nothing.
  const dedupeKey = input.dedupeKey ?? `${kind}:${itemId}`;
  const inserted = await db.query<{ id: number }>(
    `insert into messages (monday_item_id, kind, dedupe_key, phone, created_at) values ($1, $2, $3, $4, $5)
     on conflict (dedupe_key) do nothing returning id`,
    [itemId, kind, dedupeKey, phone, clock.now().toISOString()]
  );
  const row = inserted.rows[0];
  if (!row) return refuse('already_sent');

  try {
    // This Lead first, then the person behind it: ManyChat refuses to create
    // a contact for a number it already knows.
    let contactId = await messenger.findContactByLeadId(itemId);
    if (!contactId) contactId = await messenger.findContactByPhone(phone);
    if (!contactId) contactId = await messenger.createContact({ phoneE164: phone, itemId, firstName: name });
    // This contact is being messaged about THIS card — the booking button's
    // tail and the hidden question read it.
    await messenger.setFields(contactId, {
      dafna_lead_id: itemId,
      dafna_first_name: name,
      // The field Ayala's V3 automations read for «היי {{1}}» (2026-10-26).
      V3_Name: name,
      // The card's address in monday, so a person reading the contact in
      // ManyChat reaches the card in one click (Ayala, 2026-10-26). MOID was
      // Bringi's field and held a bare item id; it holds the link from now on.
      MOID: cardUrl(itemId),
      ...input.fields,
    });
    await messenger.applyTag(contactId, TAGS[kind]);
  } catch (err) {
    // A failure spends nothing: the row goes, so the next attempt can send.
    await db.query('delete from messages where id = $1', [row.id]);
    return refuse('channel_failed', err instanceof Error ? err.message.slice(0, 500) : String(err));
  }
  await db.query("update messages set status = 'sent', sent_at = now() where id = $1", [row.id]);
  await db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [
    'message_sent',
    itemId,
    JSON.stringify({ kind, tag: TAGS[kind] }),
  ]);
  return { sent: true, phone };
}

/** What a refusal means, in the words the rep reads on the card. */
export const REFUSAL_HE: Record<Refusal, string> = {
  paused: 'המערכת עצורה (מתג החירום). ההודעה לא נשלחה.',
  switch_off: 'השליחה של ההודעה הזו כבויה במסך המתגים. ההודעה לא נשלחה.',
  invalid_phone: 'אין בכרטיס מספר טלפון תקין. ההודעה לא נשלחה.',
  not_allowlisted: 'המערכת במצב בדיקה ושולחת רק למספרי בדיקה. ההודעה לא נשלחה.',
  daily_cap: 'הגענו למכסת ההודעות היומית. ההודעה לא נשלחה.',
  no_first_name: 'לא נמצא שם פרטי בשם הכרטיס. ההודעה לא נשלחה — יש לתקן את השם וללחוץ שוב.',
  already_sent: 'ההודעה הזו כבר נשלחה לליד הזה בעבר. לא נשלחה שוב.',
  channel_failed: 'השליחה ב-ManyChat נכשלה. ההודעה לא נשלחה — אפשר ללחוץ שוב.',
};
