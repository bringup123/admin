import type { Env } from '../env.js';

/** The hidden booking question on Sagi's cal.com event types that carries the
 *  monday item id. Typed by hand in the cal.com console on each event type;
 *  the links prefill it, the webhook reads it back. Named in the dafna
 *  project, kept so the approved template buttons stay valid. */
export const CALCOM_LEAD_QUESTION = 'dafna_lead';

/**
 * The card's own booking link: the Lead's name, the address the invitation
 * goes to, and the hidden question naming the card. `name` first on purpose —
 * cal.com ignores the remaining prefill when it finds no name
 * (calcom/cal.com#11488). cal.com will not book without an email, so a Lead
 * with none on the card books under `noEmailAddress`.
 */
export function cardBookingUrl(
  base: string,
  env: Pick<Env, 'noEmailAddress'>,
  lead: { itemId: string; name?: string; email?: string }
): string {
  const page = base.replace(/\/+$/, '');
  if (!page) return '';
  const q = new URLSearchParams();
  if (lead.name?.trim()) q.set('name', lead.name.trim());
  q.set('email', lead.email?.trim() || env.noEmailAddress);
  q.set(CALCOM_LEAD_QUESTION, lead.itemId);
  return `${page}?${q.toString()}`;
}

/** cal.com's own page for one booking — the only way to move or cancel it. */
export function bookingPage(uid: string): string {
  return `https://cal.com/booking/${uid}`;
}
