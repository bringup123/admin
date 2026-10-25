// Normalisation to E.164, with an explicit reject path.
// The four real formats observed on the live board (docs/INTEGRATIONS.md) are
// the fixtures for this function's tests. A mis-normalised number does not
// fail — it dials a real but wrong person — so anything unrecognised is
// rejected, never guessed at.
//
// SINCE 2026-08-30 IT ALSO KNOWS ISRAEL'S NUMBERING PLAN (T-077). Length alone
// cannot tell a short mobile from a landline: «972» plus eight digits is right
// for 03-565-6887 and wrong for 050-599530, and the second was being dialled.
// The platform answers such a call with `no_answer` / conversationStatus 130 /
// 0 seconds — byte-identical to a real no answer — so the Lead burned its whole
// Attempt curve and the card read «לא נענה» with nothing to show anything was
// wrong. Rejecting here is what makes that durable: withdrawing the queued job
// alone did not hold, because the five-minute safety poll simply re-queued it
// (proved live at 11:05 → re-queued 11:10 → dialled 11:14).

import { israeliPlanFault } from './israeli-numbers.js';

export function normalizePhone(raw: unknown): string | null {
  const e164 = shapeE164(raw);
  if (e164 === null) return null;
  // A number that cannot ring is not a number. Every guard already treats null
  // as `invalid_phone`, which is the one block reason that never schedules a
  // retry — so the Lead stops being spent on it.
  return israeliPlanFault(e164) === null ? e164 : null;
}

/** The E.164 shape alone, before the numbering plan has an opinion. Exported
 *  for the unreachable sweep, which has to say WHY a number cannot ring — and
 *  cannot, if the only answer it can get back is null. Nothing that dials
 *  should use this: `normalizePhone` is the one that decides. */
export function shapeE164(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (cleaned === '') return null;

  if (cleaned.startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  }
  if (!/^\d+$/.test(cleaned)) return null;

  // 972509089908 — country code without the +
  if (cleaned.startsWith('972') && cleaned.length >= 11 && cleaned.length <= 12) {
    return `+${cleaned}`;
  }
  // 0533325770 — Israeli local: leading 0, then 8–9 digits
  if (cleaned.startsWith('0') && (cleaned.length === 9 || cleaned.length === 10)) {
    return `+972${cleaned.slice(1)}`;
  }
  return null;
}
