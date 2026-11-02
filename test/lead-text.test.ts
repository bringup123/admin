import { describe, expect, it } from 'vitest';
import { manychatCallbackToken } from '../src/domain/lead-replies.js';
import { readManychatBody } from '../src/domain/lead-text.js';
import { ALLOWED, card, harness } from './helpers.js';

type H = Awaited<ReturnType<typeof harness>>;
const send = (h: H, raw: string) =>
  h.app.request(`/webhooks/manychat?token=${manychatCallbackToken(h.env)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw,
  });
const text = (leadId: string, words: string, phone = ALLOWED) => JSON.stringify({ leadId, event: 'text', text: words, phone });

describe('a Lead who types in WhatsApp', () => {
  it('the words go onto the card; no thank-you while its switch is off', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    const res = await (await send(h, text('30', 'אפשר לדבר מחר?'))).json();
    expect(res).toEqual({ outcome: 'noted', itemId: '30', ack: 'no', ackReason: 'paused' });
    expect(h.crm.updates).toEqual([{ itemId: '30', text: 'הליד כתב בוואטסאפ:\n«אפשר לדבר מחר?»' }]);
  });

  it('switched on: thanked once, not once per line', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'text_reply');
    h.crm.add(card({ id: '30' }));
    expect((await (await send(h, text('30', 'שלום'))).json()).ack).toBe('yes');
    expect(h.crm.updates.map((u) => u.text)).toEqual([
      'הליד כתב בוואטסאפ:\n«שלום»',
      'נשלחה לליד תשובה אוטומטית: «תודה על ההודעה, הצוות שלנו יצור קשר בהקדם.»',
    ]);
    h.clock.advance(5 * 60_000);
    expect(await (await send(h, text('30', 'רציתי לשאול על המחיר'))).json()).toMatchObject({ ack: 'no', ackReason: 'thanked_recently' });
    expect(h.crm.updates.at(-1)!.text).toBe('הליד כתב בוואטסאפ:\n«רציתי לשאול על המחיר»');
    h.clock.advance(13 * 60 * 60_000);
    expect((await (await send(h, text('30', 'עדיין רלוונטי'))).json()).ack).toBe('yes');
  });

  it('the cage holds: a number off the allowlist is not thanked, but its words are kept', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'text_reply');
    h.crm.add(card({ id: '30' }));
    expect(await (await send(h, text('30', 'היי', '+972529998877'))).json()).toMatchObject({ outcome: 'noted', ack: 'no', ackReason: 'not_allowlisted' });
    expect(await (await send(h, text('30', 'היי', ''))).json()).toMatchObject({ ack: 'no', ackReason: 'no_phone' });
  });

  it('no card id: on record with the number, nothing on any card', async () => {
    const h = await harness();
    const res = await (await send(h, text('', 'מי אתם?'))).json();
    expect(res).toMatchObject({ outcome: 'unmatched', ack: 'no' });
    expect(h.crm.updates).toEqual([]);
    const ev = await h.db.query<{ payload: { text: string } }>("select payload from events where type = 'lead_text_unmatched'");
    expect(ev.rows[0]!.payload.text).toBe('מי אתם?');
  });

  it('a quotation mark or a new line the Lead typed does not lose the message', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    const raw = `{"leadId": "30", "event": "text", "phone": "${ALLOWED}", "text": "ראיתי את "המאמר"\nמעניין"}`;
    expect((await (await send(h, raw)).json()).outcome).toBe('noted');
    expect(h.crm.updates[0]!.text).toBe('הליד כתב בוואטסאפ:\n«ראיתי את "המאמר"\nמעניין»');
    expect(readManychatBody('not json at all')).toBeNull();
  });

  it('the reminder buttons still work through the same address', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    expect((await (await send(h, JSON.stringify({ leadId: '30', event: 'confirmed' }))).json()).outcome).toBe('noted');
  });
});
