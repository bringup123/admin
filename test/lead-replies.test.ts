import { describe, expect, it } from 'vitest';
import { handleCalcomWebhook } from '../src/domain/calcom.js';
import { manychatCallbackToken } from '../src/domain/lead-replies.js';
import { card, harness } from './helpers.js';

const url = (token: string) => `/webhooks/manychat?token=${token}`;
const post = (h: Awaited<ReturnType<typeof harness>>, body: unknown, token = manychatCallbackToken(h.env)) =>
  h.app.request(url(token), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('a Lead’s reply from WhatsApp, back on the card', () => {
  it('«confirmed» puts an update on the card naming the next meeting, and sends nothing', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    // A booking well in the future, so it is still «next» whatever day the test runs.
    await handleCalcomWebhook(h.deps, {
      triggerEvent: 'BOOKING_CREATED',
      payload: { uid: 'u1', eventTypeId: 6812251, startTime: '2099-03-04T09:00:00Z', attendees: [], responses: { dafna_lead: '30' } },
    });
    h.crm.updates = [];
    const res = await post(h, { leadId: '30', event: 'confirmed' });
    expect(await res.json()).toEqual({ outcome: 'noted', itemId: '30', reply: 'confirmed' });
    expect(h.crm.updates).toEqual([{ itemId: '30', text: expect.stringMatching(/^הליד אישר הגעה לפגישת מיפוי הצרכים \(יום .*, 4\.3 בשעה 11:00\)/) }]);
    expect(h.messenger.tags).toEqual([]);
  });

  it('«reschedule_requested» says the Lead asked, without a meeting if there is none', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    await post(h, { leadId: '30', event: 'reschedule_requested' });
    expect(h.crm.updates[0]!.text).toBe('הליד ביקש לשנות מועד (לחץ «שינוי מועד» בתזכורת). אם ישנה או יבטל ב-Cal.com, הכרטיס יתעדכן מעצמו.');
  });

  it('refuses a wrong token, an empty lead id, an unknown event and a card not on the board', async () => {
    const h = await harness();
    h.crm.add(card({ id: '30' }));
    expect((await post(h, { leadId: '30', event: 'confirmed' }, 'wrong')).status).toBe(403);
    expect(await (await post(h, { leadId: '', event: 'confirmed' })).json()).toEqual({ outcome: 'ignored', reason: 'no_lead_id' });
    expect(await (await post(h, { leadId: '{{dafna_lead_id}}', event: 'confirmed' })).json()).toEqual({ outcome: 'ignored', reason: 'no_lead_id' });
    expect(await (await post(h, { leadId: '30', event: 'hello' })).json()).toEqual({ outcome: 'ignored', reason: 'unknown_event' });
    expect(await (await post(h, { leadId: '99', event: 'confirmed' })).json()).toEqual({ outcome: 'ignored', reason: 'not_on_board' });
    expect(h.crm.updates).toEqual([]);
  });

  it('with no CRON_SECRET, nothing opens', async () => {
    const h = await harness({ cronSecret: '' });
    expect((await post(h, { leadId: '30', event: 'confirmed' }, '')).status).toBe(403);
  });
});

describe('the callback URL', () => {
  it('is on the switch page, behind the admin token, and nowhere else', async () => {
    const h = await harness();
    const token = manychatCallbackToken(h.env);
    const page = await (await h.app.request('/switch?token=admin-token')).text();
    expect(page).toContain(`/webhooks/manychat?token=${token}`);
    expect((await h.app.request('/switch?token=wrong')).status).toBe(403);
    expect(await (await h.app.request('/health')).text()).not.toContain(token);
  });
});
