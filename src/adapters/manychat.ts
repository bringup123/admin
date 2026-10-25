import type { MessengerPort } from '../ports.js';

// ManyChat adapter, copied from the dafna project (src/adapters/manychat.ts)
// and cut to what V3 sends. Auth is `Bearer <account-scoped key>`.

/** `dafna_lead_id` — the monday item id the contact is being messaged about.
 *  Created by the dafna project on 2026-08-23; V3 reuses it because the
 *  approved booking buttons and cal.com's hidden question already read it. */
const LEAD_FIELD_ID = 14899233;
/** `WAID` — the WhatsApp number, digits only. The only way to find a contact
 *  by telephone: a WhatsApp contact has no phone or email system field. */
const WAID_FIELD_ID = 14191205;

function waid(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

/** «This contact does not carry that tag» — a 400, not a success. Narrow on
 *  purpose: a 400 also covers a tag that does not exist on the account. */
function isTagNotOnContact(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('400') && /can ?not remove tag from subscriber/i.test(message);
}

export function manychatMessenger(cfg: { apiToken: string; apiBase: string }): MessengerPort {
  const headers = { authorization: `Bearer ${cfg.apiToken}`, 'content-type': 'application/json' };

  async function call(path: string, init?: { method?: string; body?: unknown }): Promise<Record<string, unknown>> {
    const res = await fetch(`${cfg.apiBase}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ManyChat ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
    return JSON.parse(text) as Record<string, unknown>;
  }

  async function findBy(fieldId: number, value: string): Promise<string | null> {
    const body = await call(`/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(value)}`);
    const rows = Array.isArray(body.data) ? body.data : [];
    const first = rows[0] as { id?: unknown } | undefined;
    return first?.id ? String(first.id) : null;
  }

  return {
    findContactByLeadId: (itemId) => findBy(LEAD_FIELD_ID, itemId),
    findContactByPhone: (e164) => findBy(WAID_FIELD_ID, waid(e164)),

    async createContact({ phoneE164, itemId, firstName }) {
      const body = await call('/fb/subscriber/createSubscriber', {
        method: 'POST',
        body: { whatsapp_phone: phoneE164, ...(firstName ? { first_name: firstName } : {}) },
      });
      const id = String((body.data as { id?: unknown } | undefined)?.id ?? '');
      if (!id) throw new Error('ManyChat createSubscriber returned no id');
      // Both ids at once: the item id so this Lead is found next time, the
      // number so the *person* is found when they come back as another Lead —
      // ManyChat refuses to create a contact for a number it already knows.
      await call('/fb/subscriber/setCustomFields', {
        method: 'POST',
        body: {
          subscriber_id: id,
          fields: [
            { field_id: LEAD_FIELD_ID, field_value: itemId },
            { field_id: WAID_FIELD_ID, field_value: waid(phoneE164) },
          ],
        },
      });
      return id;
    },

    async setFields(contactId, fields) {
      const entries = Object.entries(fields).filter(([, v]) => v !== undefined && v !== '');
      if (entries.length === 0) return;
      await call('/fb/subscriber/setCustomFields', {
        method: 'POST',
        body: { subscriber_id: contactId, fields: entries.map(([field_name, field_value]) => ({ field_name, field_value })) },
      });
    },

    async applyTag(contactId, tag) {
      // Remove, then add: an automation fires on a tag being ADDED, and adding
      // one the contact already carries is a silent no-op. The remove may fail
      // with a 400 on a contact that never had the tag — the ordinary case.
      try {
        await call('/fb/subscriber/removeTagByName', { method: 'POST', body: { subscriber_id: contactId, tag_name: tag } });
      } catch (err) {
        if (!isTagNotOnContact(err)) throw err;
      }
      await call('/fb/subscriber/addTagByName', { method: 'POST', body: { subscriber_id: contactId, tag_name: tag } });
    },
  };
}
