import { CLOSE_REASON_NO_ANSWER, STATUS, TRIGGER_LABELS } from '../board.js';
import { REFUSAL_HE, sendMessage } from './send.js';
import type { WelcomeDeps } from './welcome.js';

// The rep's two buttons (Sagi's brief, part 5). monday has no webhook for a
// button press, so each button's automation writes a label into «טריגר נציגה»
// and that column's webhook brings the card here (docs/ARCHITECTURE.md).

export type ButtonOutcome =
  | { outcome: 'ignored'; reason: string }
  | { outcome: 'sent' | 'refused'; itemId: string; kind: string; reason?: string };

const SENT_HE = {
  no_answer_3: 'נשלחה לליד הודעת וואטסאפ «3 שיחות לא נענו» (שני מאמרים ולינק לתיאום).',
  no_answer_5:
    'נשלחה לליד הודעת וואטסאפ אחרונה «5 שיחות לא נענו». הסטטוס עבר ל«לבדיקת שגיא» וסיבת הסגירה ל«לא ענה».',
} as const;

export async function handleTrigger(deps: WelcomeDeps, itemId: string): Promise<ButtonOutcome> {
  const { crm, db } = deps;
  const card = await crm.getCard(itemId);
  if (!card) return { outcome: 'ignored', reason: 'not_on_board' };
  // The cell is cleared after every press, so a label arriving over an empty
  // cell is monday retrying an old delivery (it retries for minutes) — or our
  // own clearing coming back as a change. Either way, nothing to do.
  if (!card.trigger) return { outcome: 'ignored', reason: 'stale_press' };
  const kind = (TRIGGER_LABELS as Record<string, 'no_answer_3' | 'no_answer_5' | undefined>)[card.trigger];
  // Cleared first, before anything can fail, so a retry finds it empty.
  await crm.updateCard(itemId, { trigger: null });
  if (!kind) {
    await db.query('insert into events (type, monday_item_id, payload) values ($1, $2, $3)', [
      'trigger_unknown_label',
      itemId,
      JSON.stringify({ label: card.trigger }),
    ]);
    return { outcome: 'ignored', reason: 'unknown_label' };
  }

  const result = await sendMessage(deps, { kind, itemId, rawPhone: card.phone, cardName: card.name });
  if (!result.sent) {
    await crm.postUpdate(itemId, `לחיצה על «${card.trigger}»: ${REFUSAL_HE[result.reason]}`);
    return { outcome: 'refused', itemId, kind, reason: result.reason };
  }
  if (kind === 'no_answer_5') {
    await crm.updateCard(itemId, { status: STATUS.sagiCheck, closeReason: CLOSE_REASON_NO_ANSWER });
  }
  await crm.postUpdate(itemId, SENT_HE[kind]);
  return { outcome: 'sent', itemId, kind };
}
