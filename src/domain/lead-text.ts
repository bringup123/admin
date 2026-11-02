import type { Db } from '../db/db.js';
import type { Env } from '../env.js';
import type { CrmPort } from '../ports.js';
import { normalizePhone } from './phone.js';
import { readSwitches } from './switches.js';

// A Lead who types something in WhatsApp (Ayala, 2026-11-02). ManyChat's
// Default Reply posts it here: the words go onto the card as an update, and
// the answer says whether ManyChat should thank them — once, not once per
// line, and only when a person has switched that on.

/** Ayala's wording, 2026-11-02. ManyChat sends it; it lives in the Default
 *  Reply flow, and is here so the card can say what the Lead was told. */
export const THANK_YOU_HE = 'תודה על ההודעה, הצוות שלנו יצור איתך קשר בהקדם.';

/** A Lead who writes three lines in a row is thanked once. */
export const ACK_QUIET_MS = 12 * 60 * 60_000;

const MAX_TEXT = 2000;

export type LeadTextOutcome = {
  outcome: 'noted' | 'unmatched' | 'empty';
  itemId?: string;
  /** What ManyChat's Response Mapping reads into V3_Ack. */
  ack: 'yes' | 'no';
  ackReason?: string;
};

export async function handleLeadText(
  deps: { db: Db; env: Env; crm: CrmPort; clock: { now(): Date } },
  body: Record<string, unknown>
): Promise<LeadTextOutcome> {
  const { db, env, crm, clock } = deps;
  const raw = String(body.leadId ?? '').trim();
  const itemId = /^\d+$/.test(raw) ? raw : '';
  const text = String(body.text ?? '').trim().slice(0, MAX_TEXT);
  const phone = normalizePhone(String(body.phone ?? '')) ?? '';
  const log = (type: string, payload: unknown) =>
    db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [type, itemId || null, JSON.stringify(payload)]);

  // The words, on the card. A Lead a card cannot be found for is still on
  // record, with the number to find them by.
  let outcome: LeadTextOutcome['outcome'] = 'empty';
  if (text) {
    const card = itemId ? await crm.getCard(itemId) : null;
    if (card) {
      await crm.postUpdate(itemId, `הליד כתב בוואטסאפ:\n«${text}»`);
      outcome = 'noted';
    } else {
      outcome = 'unmatched';
    }
  }
  await log(outcome === 'noted' ? 'lead_text' : 'lead_text_unmatched', {
    ...(outcome === 'noted' ? {} : { text, leadId: raw.slice(0, 60) }),
    phone: phone || null,
  });

  // Whether to thank them. Every guard a message has: the kill switch, its
  // own switch, the cage — and once in twelve hours for this person.
  const no = async (ackReason: string): Promise<LeadTextOutcome> => ({ outcome, ...(itemId ? { itemId } : {}), ack: 'no', ackReason });
  const sw = await readSwitches(db);
  if (!sw.interactions_enabled) return no('paused');
  if (!sw.text_reply) return no('switch_off');
  if (!phone) return no('no_phone');
  if ((env.appEnv !== 'production' || sw.allowlist_only) && !env.phoneAllowlist.includes(phone)) return no('not_allowlisted');
  const since = new Date(clock.now().getTime() - ACK_QUIET_MS).toISOString();
  const recent = await db.query(
    "select 1 from events where type = 'text_ack' and payload->>'phone' = $1 and created_at >= $2 limit 1",
    [phone, since]
  );
  if (recent.rows.length) return no('thanked_recently');
  await db.query('insert into events (type, monday_item_id, payload, created_at) values ($1, $2, $3, $4)', [
    'text_ack',
    itemId || null,
    JSON.stringify({ phone }),
    clock.now().toISOString(),
  ]);
  if (outcome === 'noted') await crm.postUpdate(itemId, `נשלחה לליד תשובה אוטומטית: «${THANK_YOU_HE}»`);
  return { outcome, ...(itemId ? { itemId } : {}), ack: 'yes' };
}

/** ManyChat pastes a field into the body as it is, so a Lead who types a
 *  quotation mark or a new line can break the JSON. Read it anyway. */
export function readManychatBody(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    const field = (k: string) => raw.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`))?.[1];
    const event = field('event');
    if (!event) return null;
    // The text is whatever stands between its opening quote and the last
    // quote before the closing brace.
    const t = raw.match(/"text"\s*:\s*"([\s\S]*)"\s*[,}][^"]*$/)?.[1] ?? raw.match(/"text"\s*:\s*"([\s\S]*)"/)?.[1];
    return { leadId: field('leadId') ?? '', event, phone: field('phone') ?? '', text: t ?? '' };
  }
}
