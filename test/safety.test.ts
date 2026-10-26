// The safety rails. AGENTS.md: these tests may never be skipped or deleted.
import { describe, expect, it } from 'vitest';
import { sendMessage, firstName } from '../src/domain/send.js';
import { readSwitches, setSwitch } from '../src/domain/switches.js';
import { ALLOWED, harness } from './helpers.js';

const send = (h: Awaited<ReturnType<typeof harness>>, over: Partial<{ itemId: string; rawPhone: string; cardName: string }> = {}) =>
  sendMessage(h.deps, { kind: 'welcome', itemId: '1', rawPhone: '0501112233', cardName: 'דנה כהן', ...over });

describe('the switches start safe', () => {
  it('the kill switch and every message are off, the cage is shut, on a fresh database', async () => {
    const h = await harness();
    expect(await readSwitches(h.db)).toEqual({
      interactions_enabled: false,
      welcome: false,
      no_answer_3: false,
      no_answer_5: false,
      allowlist_only: true,
    });
  });
});

describe('sendMessage guards', () => {
  it('sends nothing while the kill switch is off, even with the message on', async () => {
    const h = await harness();
    await h.on('welcome');
    expect(await send(h)).toEqual({ sent: false, reason: 'paused' });
    expect(h.messenger.tags).toEqual([]);
  });

  it('sends nothing while the message switch is off', async () => {
    const h = await harness();
    await h.on('interactions_enabled');
    expect(await send(h)).toEqual({ sent: false, reason: 'switch_off' });
    expect(h.messenger.tags).toEqual([]);
  });

  it('outside production a number off the allowlist is refused, whatever the cage says', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    await setSwitch(h.db, 'allowlist_only', false, 'test');
    expect(await send(h, { rawPhone: '0509998877' })).toEqual({ sent: false, reason: 'not_allowlisted' });
    expect(h.messenger.tags).toEqual([]);
  });

  it('in production the cage still refuses a number off the allowlist until it is opened', async () => {
    const h = await harness({ appEnv: 'production' });
    await h.on('interactions_enabled', 'welcome');
    expect(await send(h, { rawPhone: '0509998877' })).toEqual({ sent: false, reason: 'not_allowlisted' });
    await setSwitch(h.db, 'allowlist_only', false, 'test');
    expect((await send(h, { rawPhone: '0509998877' })).sent).toBe(true);
  });

  it('refuses a number no telephone can reach', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    expect(await send(h, { rawPhone: '050-599530' })).toEqual({ sent: false, reason: 'invalid_phone' });
  });

  it('sends an allowlisted number once, and never twice', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    expect(await send(h)).toEqual({ sent: true, phone: ALLOWED });
    expect(await send(h)).toEqual({ sent: false, reason: 'already_sent' });
    expect(h.messenger.tags).toEqual([{ contactId: 'c1', tag: 'v3_welcome' }]);
    expect(h.messenger.fields[0]?.fields).toEqual({
      dafna_lead_id: '1',
      dafna_first_name: 'דנה',
      V3_Name: 'דנה',
      MOID: 'https://bringup-io.monday.com/boards/1753447162/views/23542451/pulses/1',
    });
  });

  it('a channel failure spends nothing: the next attempt sends', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    h.messenger.fail = true;
    expect((await send(h)) as { reason?: string }).toMatchObject({ sent: false, reason: 'channel_failed' });
    h.messenger.fail = false;
    expect((await send(h)).sent).toBe(true);
  });

  it('stops at the daily cap', async () => {
    const h = await harness({ maxMessagesPerDay: 1 });
    await h.on('interactions_enabled', 'welcome');
    expect((await send(h, { itemId: '1' })).sent).toBe(true);
    expect(await send(h, { itemId: '2' })).toEqual({ sent: false, reason: 'daily_cap' });
  });

  it('refuses a card whose title holds no first name', async () => {
    const h = await harness();
    await h.on('interactions_enabled', 'welcome');
    expect(await send(h, { cardName: '  ' })).toEqual({ sent: false, reason: 'no_first_name' });
  });
});

describe('firstName', () => {
  it('is the first word of the title', () => {
    expect(firstName('דנה כהן')).toBe('דנה');
    expect(firstName('  הדס ')).toBe('הדס');
    expect(firstName('יוסי, חברת אבג')).toBe('יוסי');
    expect(firstName('')).toBe('');
    expect(firstName('050-1234567')).toBe('');
  });
});
