// The two outside systems V3 talks to, as interfaces, so tests use fakes.

export interface Card {
  id: string;
  name: string;
  /** The raw phone cell, normalised by the caller. */
  phone: string;
  email: string;
  status: string;
  trigger: string;
  meetingLink: string;
  demoLink: string;
  /** The two meeting-date cells: an ISO instant when the cell has a time, the
   *  bare day (YYYY-MM-DD) when it has none, '' when empty. */
  meetingDate?: string;
  demoDate?: string;
  /** The change-or-cancel link of the needs-mapping meeting. */
  meetingChangeLink?: string;
  createdAt?: string;
}

/** Column writes. Status-like values are label text; links are { url, text };
 *  dates are ISO instants; `null` clears the cell. */
export interface CardWrite {
  status?: string;
  closeReason?: string;
  trigger?: null;
  meetingDate?: string | null;
  meetingLink?: { url: string; text: string } | null;
  meetingChangeLink?: { url: string; text: string } | null;
  demoDate?: string | null;
  demoLink?: { url: string; text: string } | null;
}

export interface CrmPort {
  getCard(itemId: string): Promise<Card | null>;
  /** Writes what it can. A status label the board no longer has is dropped,
   *  the rest written, and the dropped labels returned — the board's labels
   *  are a person's to change, and a renamed label must not lose a date. */
  updateCard(itemId: string, write: CardWrite): Promise<{ refusedLabels?: string[] }>;
  findCardByEmail(email: string): Promise<string | null>;
  /** One page of cards whose demo-link cell is empty, newest first. */
  listCardsWithoutDemoLink(input: { cursor?: string; limit: number }): Promise<{ cards: Card[]; cursor: string | null }>;
  /** An update on the card, so a person reads what happened. */
  postUpdate(itemId: string, text: string): Promise<void>;
}

export interface MessengerPort {
  findContactByLeadId(itemId: string): Promise<string | null>;
  findContactByPhone(e164: string): Promise<string | null>;
  createContact(input: { phoneE164: string; itemId: string; firstName?: string }): Promise<string>;
  setFields(contactId: string, fields: Record<string, string>): Promise<void>;
  /** Adding the tag is the send: a ManyChat automation on it sends the template. */
  applyTag(contactId: string, tag: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}
