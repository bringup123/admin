import { describe, expect, it } from 'vitest';
import { enqueueWelcome, FIRST_DELAY_MS, GIVE_UP_AFTER_MS, RETRY_MS, runWelcomeQueue } from '../src/domain/welcome.js';
import { card, harness } from './helpers.js';

describe('the welcome message', () => {
  it('waits before reading the card, then sends, moves the status and writes both links', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.crm.add(card({ id: '10' }));
    expect(await enqueueWelcome(h.deps, '10')).toBe(true);
    expect(await runWelcomeQueue(h.deps)).toEqual([]);
    h.clock.advance(FIRST_DELAY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '10', outcome: 'sent' }]);
    expect(h.messenger.tags.map((t) => t.tag)).toEqual(['v3_welcome']);
    const c = h.crm.cards.get('10')!;
    expect(c.status).toBe('נשלחה הודעה ראשונה');
    expect(c.meetingLink).toBe('https://cal.com/sagi/needs?name=%D7%93%D7%A0%D7%94+%D7%9B%D7%94%D7%9F&email=dana%40example.com&dafna_lead=10');
    expect(c.demoLink).toContain('https://cal.com/sagi/demo?');
    expect(c.demoLink).toContain('dafna_lead=10');
  });

  it('a status label gone from the board costs the status only: the links are written and the card is not sent twice', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.crm.missingLabels.add('נשלחה הודעה ראשונה');
    h.crm.add(card({ id: '18' }));
    await enqueueWelcome(h.deps, '18');
    h.clock.advance(FIRST_DELAY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '18', outcome: 'sent' }]);
    const c = h.crm.cards.get('18')!;
    expect(c.status).toBe('חדש');
    expect(c.meetingLink).toContain('dafna_lead=18');
    h.clock.advance(RETRY_MS * 3);
    expect(await runWelcomeQueue(h.deps)).toEqual([]);
    const ev = await h.db.query<{ type: string }>("select type from events where type = 'label_missing'");
    expect(ev.rows).toHaveLength(1);
  });

  it('queues a card once however many times monday says it was created', async () => {
    const h = await harness();
    expect(await enqueueWelcome(h.deps, '10')).toBe(true);
    expect(await enqueueWelcome(h.deps, '10')).toBe(false);
  });

  it('leaves a status a person set alone, and links already on the card', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.crm.add(card({ id: '11', status: 'לחזור במועד', meetingLink: 'https://meet.example/x' }));
    await enqueueWelcome(h.deps, '11');
    h.clock.advance(FIRST_DELAY_MS);
    await runWelcomeQueue(h.deps);
    const c = h.crm.cards.get('11')!;
    expect(c.status).toBe('לחזור במועד');
    expect(c.meetingLink).toBe('https://meet.example/x');
  });

  it('welcomes only a card whose status still says it is new', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.crm.add(card({ id: '16', status: 'הצעת מחיר' }));
    h.crm.add(card({ id: '17', status: '' }));
    await enqueueWelcome(h.deps, '16');
    await enqueueWelcome(h.deps, '17');
    h.clock.advance(FIRST_DELAY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([
      { itemId: '16', outcome: 'not_a_new_lead' },
      { itemId: '17', outcome: 'sent' },
    ]);
    expect(h.crm.cards.get('16')!.status).toBe('הצעת מחיר');
    expect(h.crm.cards.get('17')!.status).toBe('נשלחה הודעה ראשונה');
  });

  it('waits for a phone that is filled after the card is created, and gives up after half an hour', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.crm.add(card({ id: '12', phone: '' }));
    await enqueueWelcome(h.deps, '12');
    h.clock.advance(FIRST_DELAY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '12', outcome: 'waiting_for_phone' }]);
    h.crm.cards.get('12')!.phone = '0501112233';
    h.clock.advance(RETRY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '12', outcome: 'sent' }]);

    h.crm.add(card({ id: '13', phone: '' }));
    await enqueueWelcome(h.deps, '13');
    h.clock.advance(GIVE_UP_AFTER_MS + FIRST_DELAY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '13', outcome: 'invalid_phone' }]);
    expect(h.crm.updates.some((u) => u.itemId === '13' && u.text.includes('לא נשלחה'))).toBe(true);
  });

  it('a card that arrives while the welcome is off is never sent later', async () => {
    const h = await harness();
    await h.on('interactions_enabled');
    h.crm.add(card({ id: '14' }));
    await enqueueWelcome(h.deps, '14');
    h.clock.advance(FIRST_DELAY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '14', outcome: 'switch_off' }]);
    await h.on('welcome');
    h.clock.advance(RETRY_MS * 10);
    expect(await runWelcomeQueue(h.deps)).toEqual([]);
    expect(h.messenger.tags).toEqual([]);
    expect(h.crm.cards.get('14')!.status).toBe('חדש');
  });

  it('a board failure puts the card back on the queue', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.crm.add(card({ id: '15' }));
    await enqueueWelcome(h.deps, '15');
    h.clock.advance(FIRST_DELAY_MS);
    h.crm.failGet = true;
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '15', outcome: 'error' }]);
    h.crm.failGet = false;
    h.clock.advance(RETRY_MS);
    expect(await runWelcomeQueue(h.deps)).toEqual([{ itemId: '15', outcome: 'sent' }]);
  });
});
