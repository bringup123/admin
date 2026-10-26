import { buildApp, type AppDeps } from '../src/app.js';
import { pgliteDb } from '../src/db/db.js';
import { migrate } from '../src/db/migrate.js';
import { envFromProcess, type Env } from '../src/env.js';
import type { Card, CardWrite, CrmPort, MessengerPort } from '../src/ports.js';
import { setSwitch, type SwitchKey } from '../src/domain/switches.js';

export const ALLOWED = '+972501112233';

export function testEnv(over: Partial<Env> = {}): Env {
  return {
    ...envFromProcess({}),
    appEnv: 'test',
    mondayWebhookSecret: 'mon-secret',
    calcomWebhookSecret: 'cal-secret',
    calcomEventTypeId: 6812251,
    calcomDemoEventTypeId: 7000001,
    bookingUrl: 'https://cal.com/sagi/needs',
    demoBookingUrl: 'https://cal.com/sagi/demo',
    killSwitchToken: 'kill-token',
    adminToken: 'admin-token',
    cronSecret: 'cron-secret',
    phoneAllowlist: [ALLOWED],
    maxMessagesPerDay: 100,
    ...over,
  };
}

export function card(over: Partial<Card> & { id: string }): Card {
  return { name: 'דנה כהן', phone: '0501112233', email: 'dana@example.com', status: 'חדש', trigger: '', meetingLink: '', demoLink: '', ...over };
}

export class FakeCrm implements CrmPort {
  cards = new Map<string, Card>();
  writes: Array<{ itemId: string; write: CardWrite }> = [];
  updates: Array<{ itemId: string; text: string }> = [];
  failGet = false;
  add(c: Card) {
    this.cards.set(c.id, { ...c });
  }
  async getCard(itemId: string) {
    if (this.failGet) throw new Error('board down');
    const c = this.cards.get(itemId);
    return c ? { ...c } : null;
  }
  /** Labels the fake board does not have; a write naming one is refused for them. */
  missingLabels = new Set<string>();
  async updateCard(itemId: string, input: CardWrite) {
    const write = { ...input };
    const refusedLabels = [write.status, write.closeReason].filter((x): x is string => !!x && this.missingLabels.has(x));
    if (refusedLabels.length) {
      delete write.status;
      delete write.closeReason;
    }
    this.writes.push({ itemId, write });
    const c = this.cards.get(itemId);
    if (!c) return refusedLabels.length ? { refusedLabels } : {};
    if (write.status !== undefined) c.status = write.status;
    if (write.trigger === null) c.trigger = '';
    if (write.meetingLink !== undefined) c.meetingLink = write.meetingLink?.url ?? '';
    if (write.demoLink !== undefined) c.demoLink = write.demoLink?.url ?? '';
    return refusedLabels.length ? { refusedLabels } : {};
  }
  async findCardByEmail(email: string) {
    for (const c of this.cards.values()) if (c.email.toLowerCase() === email.toLowerCase()) return c.id;
    return null;
  }
  async postUpdate(itemId: string, text: string) {
    this.updates.push({ itemId, text });
  }
  lastWrite(itemId: string): CardWrite | undefined {
    return [...this.writes].reverse().find((w) => w.itemId === itemId)?.write;
  }
}

export class FakeMessenger implements MessengerPort {
  contacts = new Map<string, { phone: string; itemId: string }>();
  tags: Array<{ contactId: string; tag: string }> = [];
  fields: Array<{ contactId: string; fields: Record<string, string> }> = [];
  fail = false;
  async findContactByLeadId(itemId: string) {
    for (const [id, c] of this.contacts) if (c.itemId === itemId) return id;
    return null;
  }
  async findContactByPhone(e164: string) {
    for (const [id, c] of this.contacts) if (c.phone === e164) return id;
    return null;
  }
  async createContact(input: { phoneE164: string; itemId: string }) {
    const id = `c${this.contacts.size + 1}`;
    this.contacts.set(id, { phone: input.phoneE164, itemId: input.itemId });
    return id;
  }
  async setFields(contactId: string, fields: Record<string, string>) {
    this.fields.push({ contactId, fields });
  }
  async applyTag(contactId: string, tag: string) {
    if (this.fail) throw new Error('ManyChat → 500');
    this.tags.push({ contactId, tag });
  }
}

export class TestClock {
  constructor(public t = new Date('2026-10-26T08:00:00Z')) {}
  now() {
    return new Date(this.t);
  }
  advance(ms: number) {
    this.t = new Date(this.t.getTime() + ms);
  }
}

export async function harness(envOver: Partial<Env> = {}) {
  const db = await pgliteDb();
  await migrate(db);
  const env = testEnv(envOver);
  const crm = new FakeCrm();
  const messenger = new FakeMessenger();
  const clock = new TestClock();
  const deps: AppDeps = { db, env, crm, messenger, clock };
  const app = buildApp(deps);
  const on = async (...keys: SwitchKey[]) => {
    for (const k of keys) await setSwitch(db, k, true, 'test');
  };
  return { db, env, crm, messenger, clock, deps, app, on };
}
