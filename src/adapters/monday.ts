import { COL } from '../board.js';
import type { Card, CardWrite, CrmPort } from '../ports.js';

// monday adapter: the reads and writes V3 needs, nothing more. The traps
// behind each choice were found in the dafna project (its docs/INTEGRATIONS.md).

const API = 'https://api.monday.com/v2';

type Cell = { id: string; text: string | null; value: string | null };

function cellText(cells: Cell[], id: string): string {
  return (cells.find((c) => c.id === id)?.text ?? '').trim();
}

/** A phone cell's value is `{ phone, countryShortName, … }`; its text may be
 *  formatted for display. The raw number is the one to normalise. */
function phoneOf(cells: Cell[]): string {
  const cell = cells.find((c) => c.id === COL.phone);
  if (!cell) return '';
  try {
    const parsed = cell.value ? (JSON.parse(cell.value) as { phone?: string }) : null;
    if (parsed?.phone) return parsed.phone;
  } catch {
    // fall through to the text
  }
  return (cell.text ?? '').trim();
}

/** A link cell's text is «label - url»; the value carries the url alone. */
function linkUrl(cells: Cell[], id: string): string {
  const cell = cells.find((c) => c.id === id);
  if (!cell?.value) return '';
  try {
    return String((JSON.parse(cell.value) as { url?: string }).url ?? '');
  } catch {
    return '';
  }
}

/** Monday takes date+time in UTC and shows it in the account's timezone. */
function dateCell(iso: string): { date: string; time: string } {
  const d = new Date(iso).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 19) };
}

export function mondayCrm(cfg: { token: string; boardId: string }): CrmPort {
  async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(API, {
      method: 'POST',
      headers: { authorization: cfg.token, 'content-type': 'application/json', 'API-Version': '2024-10' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`monday API → ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(`monday GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
    return body.data as T;
  }

  return {
    async getCard(itemId) {
      const data = await gql<{
        items: Array<{ id: string; name: string; created_at: string | null; board: { id: string } | null; column_values: Cell[] }>;
      }>(
        `query ($ids: [ID!]) {
           items(ids: $ids, limit: 1) { id name created_at board { id } column_values { id text value } }
         }`,
        { ids: [itemId] }
      );
      const item = data.items[0];
      // Item ids are global: an id from another board is not one of our Leads.
      if (!item || item.board?.id !== cfg.boardId) return null;
      const cells = item.column_values;
      const card: Card = {
        id: item.id,
        name: item.name ?? '',
        phone: phoneOf(cells),
        email: cellText(cells, COL.email),
        status: cellText(cells, COL.status),
        trigger: cellText(cells, COL.trigger),
        meetingLink: linkUrl(cells, COL.meetingLink),
        demoLink: linkUrl(cells, COL.demoLink),
        ...(item.created_at ? { createdAt: item.created_at } : {}),
      };
      return card;
    },

    async updateCard(itemId, w: CardWrite) {
      const values: Record<string, unknown> = {};
      if (w.status !== undefined) values[COL.status] = { label: w.status };
      if (w.closeReason !== undefined) values[COL.closeReason] = { label: w.closeReason };
      // Monday clears a column on an empty string.
      if (w.trigger === null) values[COL.trigger] = '';
      if (w.meetingDate !== undefined) values[COL.meetingDate] = w.meetingDate ? dateCell(w.meetingDate) : '';
      if (w.meetingLink !== undefined) values[COL.meetingLink] = w.meetingLink ?? '';
      if (w.meetingChangeLink !== undefined) values[COL.meetingChangeLink] = w.meetingChangeLink ?? '';
      if (w.demoDate !== undefined) values[COL.demoDate] = w.demoDate ? dateCell(w.demoDate) : '';
      if (w.demoLink !== undefined) values[COL.demoLink] = w.demoLink ?? '';
      if (Object.keys(values).length === 0) return;
      // create_labels_if_missing: false, deliberately. The status column is
      // full, and a mistyped label must fail loudly rather than become one.
      await gql(
        `mutation ($board: ID!, $item: ID!, $values: JSON!) {
           change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values, create_labels_if_missing: false) { id }
         }`,
        { board: cfg.boardId, item: itemId, values: JSON.stringify(values) }
      );
    },

    async findCardByEmail(email) {
      const wanted = email.trim();
      if (!wanted) return null;
      // A text column matches the whole cell, case and all, so both spellings
      // are asked for (a text column ORs them; a phone column would AND them).
      const data = await gql<{
        items_page_by_column_values: { items: Array<{ id: string; created_at: string | null }> };
      }>(
        `query ($board: ID!, $cols: [ItemsPageByColumnValuesQuery!]) {
           items_page_by_column_values(board_id: $board, columns: $cols, limit: 10) { items { id created_at } }
         }`,
        { board: cfg.boardId, cols: [{ column_id: COL.email, column_values: [...new Set([wanted, wanted.toLowerCase()])] }] }
      );
      const items = [...data.items_page_by_column_values.items].sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      );
      return items[0]?.id ?? null;
    },

    async postUpdate(itemId, body) {
      await gql(`mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, {
        item: itemId,
        body,
      });
    },
  };
}
