import { STATUS, WELCOME_OVERWRITES, WELCOME_STATUSES } from '../board.js';
import type { CrmPort } from '../ports.js';
import { cardBookingUrl } from './links.js';
import { normalizePhone } from './phone.js';
import { REFUSAL_HE, sendMessage, type SendDeps } from './send.js';

// The welcome message (Sagi's brief, part 2). A card is created before its
// phone is filled — a form or an automation writes the columns afterwards — so
// the card waits on a queue and is read again when it falls due.

export const FIRST_DELAY_MS = 90_000;
export const RETRY_MS = 5 * 60_000;
/** A card still without a usable phone this long after it arrived is given up. */
export const GIVE_UP_AFTER_MS = 30 * 60_000;

export const BOOKING_LINK_TEXT = 'קבע פגישה';
export const DEMO_LINK_TEXT = 'קבע דמו';

export interface WelcomeDeps extends SendDeps {
  crm: CrmPort;
}

export async function enqueueWelcome(deps: Pick<WelcomeDeps, 'db' | 'clock'>, itemId: string): Promise<boolean> {
  const now = deps.clock.now();
  const r = await deps.db.query(
    `insert into welcome_queue (monday_item_id, created_at, due_at) values ($1, $2, $3)
     on conflict (monday_item_id) do nothing returning monday_item_id`,
    [itemId, now.toISOString(), new Date(now.getTime() + FIRST_DELAY_MS).toISOString()]
  );
  return r.rows.length > 0;
}

type Outcome = { itemId: string; outcome: string };

/** One pass over the due cards. Called by the tick, every minute. */
export async function runWelcomeQueue(deps: WelcomeDeps, limit = 20): Promise<Outcome[]> {
  const { db, crm, clock } = deps;
  const now = clock.now();
  // Claimed before anything is done, so two overlapping ticks never take the
  // same card.
  const claimed = await db.query<{ monday_item_id: string; created_at: string; attempts: number }>(
    `update welcome_queue set status = 'working', updated_at = now()
      where monday_item_id in (
        select monday_item_id from welcome_queue where status = 'pending' and due_at <= $1
        order by due_at limit $2 for update skip locked)
      returning monday_item_id, created_at, attempts`,
    [now.toISOString(), limit]
  );
  const out: Outcome[] = [];
  for (const row of claimed.rows) {
    const itemId = row.monday_item_id;
    const settle = async (status: string, outcome: string) => {
      await db.query("update welcome_queue set status = $2, outcome = $3, updated_at = now() where monday_item_id = $1", [
        itemId,
        status,
        outcome,
      ]);
      out.push({ itemId, outcome });
    };
    try {
      const card = await crm.getCard(itemId);
      if (!card) {
        await settle('skipped', 'not_on_board');
        continue;
      }
      if (!WELCOME_STATUSES.includes(card.status)) {
        await settle('skipped', 'not_a_new_lead');
        continue;
      }
      if (!normalizePhone(card.phone)) {
        const age = now.getTime() - new Date(row.created_at).getTime();
        if (age < GIVE_UP_AFTER_MS) {
          await db.query(
            "update welcome_queue set status = 'pending', attempts = attempts + 1, due_at = $2, updated_at = now() where monday_item_id = $1",
            [itemId, new Date(now.getTime() + RETRY_MS).toISOString()]
          );
          out.push({ itemId, outcome: 'waiting_for_phone' });
          continue;
        }
        await crm.postUpdate(itemId, `הודעת ברוכים הבאים לא נשלחה: ${REFUSAL_HE.invalid_phone}`);
        await settle('gave_up', 'invalid_phone');
        continue;
      }
      const result = await sendMessage(deps, { kind: 'welcome', itemId, rawPhone: card.phone, cardName: card.name });
      if (!result.sent) {
        // A welcome refused by a switch is not sent later: a card that
        // arrived while sending was off is the rep's, and turning the switch
        // on must not send a backlog.
        if (result.reason !== 'paused' && result.reason !== 'switch_off' && result.reason !== 'not_allowlisted') {
          await crm.postUpdate(itemId, `הודעת ברוכים הבאים: ${REFUSAL_HE[result.reason]}`);
        }
        await settle('skipped', result.reason);
        continue;
      }
      const env = deps.env;
      const lead = { itemId, name: card.name, email: card.email };
      await crm.updateCard(itemId, {
        // A status a person (or a booking) set is theirs.
        ...(WELCOME_OVERWRITES.includes(card.status) ? { status: STATUS.firstMessageSent } : {}),
        // The card's own links, so a meeting booked from the card lands on it.
        ...(!card.meetingLink && env.bookingUrl
          ? { meetingLink: { url: cardBookingUrl(env.bookingUrl, env, lead), text: BOOKING_LINK_TEXT } }
          : {}),
        ...(!card.demoLink && env.demoBookingUrl
          ? { demoLink: { url: cardBookingUrl(env.demoBookingUrl, env, lead), text: DEMO_LINK_TEXT } }
          : {}),
      });
      await crm.postUpdate(itemId, 'נשלחה הודעת ברוכים הבאים בוואטסאפ.');
      await settle('done', 'sent');
    } catch (err) {
      // A board or network failure: back on the queue, tried again later.
      await db.query(
        "update welcome_queue set status = 'pending', attempts = attempts + 1, due_at = $2, updated_at = now() where monday_item_id = $1",
        [itemId, new Date(now.getTime() + RETRY_MS).toISOString()]
      );
      await db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [
        'welcome_error',
        itemId,
        JSON.stringify({ error: err instanceof Error ? err.message.slice(0, 500) : String(err) }),
      ]);
      out.push({ itemId, outcome: 'error' });
    }
  }
  return out;
}
