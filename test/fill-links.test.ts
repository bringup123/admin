import { describe, expect, it } from 'vitest';
import { handleTrigger } from '../src/domain/buttons.js';
import { card, harness } from './helpers.js';

describe('booking links on cards from before V3', () => {
  it('a dry run counts and writes nothing; apply fills empty cells only, and skips closed Leads', async () => {
    const h = await harness();
    h.crm.add(card({ id: '1', status: 'בניסיונות תפיסה' }));
    h.crm.add(card({ id: '2', status: 'לא רלוונטי לעולם' }));
    h.crm.add(card({ id: '3', status: 'חדש', meetingLink: 'https://meet.google.com/abc-defg-hij' }));
    h.crm.add(card({ id: '4', status: 'חדש', demoLink: 'https://cal.com/x' }));
    const dry = await (await h.app.request('/api/fill-links?token=admin-token')).json();
    expect(dry).toMatchObject({ apply: false, checked: 3, filled: 2, skippedClosed: 1, cursor: null });
    expect(h.crm.writes).toEqual([]);

    const done = await (await h.app.request('/api/fill-links?token=admin-token&apply=1')).json();
    expect(done.filled).toBe(2);
    expect(h.crm.cards.get('1')!.demoLink).toContain('dafna_lead=1');
    expect(h.crm.cards.get('1')!.meetingLink).toContain('dafna_lead=1');
    // A meeting room already in the cell stays.
    expect(h.crm.cards.get('3')!.meetingLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(h.crm.cards.get('3')!.demoLink).toContain('dafna_lead=3');
    expect(h.crm.cards.get('2')!.demoLink).toBe('');
    expect((await h.app.request('/api/fill-links?token=wrong')).status).toBe(403);
  });

  it('pages through the board with the cursor', async () => {
    const h = await harness();
    for (let i = 1; i <= 5; i++) h.crm.add(card({ id: String(i) }));
    const first = await (await h.app.request('/api/fill-links?token=admin-token&limit=2')).json();
    expect(first).toMatchObject({ checked: 2, cursor: '2' });
  });

  it('a button press puts the links on the card even when the message is not sent', async () => {
    const h = await harness();
    h.crm.add(card({ id: '7', trigger: '3 שיחות לא נענו' }));
    expect((await handleTrigger(h.deps, '7')).outcome).toBe('refused');
    expect(h.crm.cards.get('7')!.demoLink).toContain('dafna_lead=7');
  });
});
