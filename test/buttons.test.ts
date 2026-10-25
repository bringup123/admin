import { describe, expect, it } from 'vitest';
import { handleTrigger } from '../src/domain/buttons.js';
import { card, harness } from './helpers.js';

describe("the rep's buttons", () => {
  it('«3 שיחות לא נענו» clears the trigger, sends once, and says so on the card', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'no_answer_3');
    h.crm.add(card({ id: '20', trigger: '3 שיחות לא נענו', status: 'בניסיונות תפיסה' }));
    expect(await handleTrigger(h.deps, '20')).toEqual({ outcome: 'sent', itemId: '20', kind: 'no_answer_3' });
    const c = h.crm.cards.get('20')!;
    expect(c.trigger).toBe('');
    expect(c.status).toBe('בניסיונות תפיסה');
    expect(h.messenger.tags.map((t) => t.tag)).toEqual(['v3_no_answer_3']);
    expect(h.crm.updates.at(-1)?.text).toContain('נשלחה');

    // A second press: the message has gone once, and is not sent again.
    h.crm.cards.get('20')!.trigger = '3 שיחות לא נענו';
    expect(await handleTrigger(h.deps, '20')).toMatchObject({ outcome: 'refused', reason: 'already_sent' });
    expect(h.messenger.tags).toHaveLength(1);
  });

  it('«5 שיחות לא נענו» sends the last message and hands the Lead to Sagi', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'no_answer_5');
    h.crm.add(card({ id: '21', trigger: '5 שיחות לא נענו', status: 'בניסיונות תפיסה' }));
    expect(await handleTrigger(h.deps, '21')).toEqual({ outcome: 'sent', itemId: '21', kind: 'no_answer_5' });
    expect(h.crm.cards.get('21')!.status).toBe('לבדיקת שגיא');
    expect(h.crm.writes.some((w) => w.itemId === '21' && w.write.closeReason === 'לא ענה')).toBe(true);
  });

  it('a label arriving over an empty cell is a stale retry and does nothing', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'no_answer_3');
    h.crm.add(card({ id: '22', trigger: '' }));
    expect(await handleTrigger(h.deps, '22')).toEqual({ outcome: 'ignored', reason: 'stale_press' });
    expect(h.messenger.tags).toEqual([]);
    expect(h.crm.writes).toEqual([]);
  });

  it('a press refused by a switch says why on the card, clears the trigger, and moves nothing', async () => {
    const h = await harness();
    await h.on('interactions_enabled');
    h.crm.add(card({ id: '23', trigger: '5 שיחות לא נענו', status: 'בניסיונות תפיסה' }));
    expect(await handleTrigger(h.deps, '23')).toMatchObject({ outcome: 'refused', reason: 'switch_off' });
    const c = h.crm.cards.get('23')!;
    expect(c.trigger).toBe('');
    expect(c.status).toBe('בניסיונות תפיסה');
    expect(h.crm.updates.at(-1)?.text).toContain('כבויה');
  });
});
