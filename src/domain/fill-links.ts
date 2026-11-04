import type { CrmPort } from '../ports.js';
import type { Env } from '../env.js';
import { fillCardLinks } from './welcome.js';

// The cards that existed before V3 have no demo link of their own (Ayala,
// 2026-11-04: «לא קיים לינק לתיאום פגישת דמו»). One page at a time, from the
// live service, because it holds the board's token: GET reads and counts,
// `apply=1` writes. Empty cells only — a link already there is a person's or a
// meeting's, and stays.

/** Leads that are finished: no booking link is wanted on them. */
export const CLOSED_STATUSES = ['לא רלוונטי לעולם', 'הסתיים - לשמור על קשר', 'אושר', 'עבר לעידן', 'עבר ליוסי'];

export interface FillLinksResult {
  apply: boolean;
  checked: number;
  /** Cards written (or that would be, on a dry run). */
  filled: number;
  skippedClosed: number;
  byStatus: Record<string, number>;
  /** Pass back as `cursor` for the next page; null when the board is done. */
  cursor: string | null;
}

export async function runFillLinks(
  deps: { crm: CrmPort; env: Env },
  opts: { apply: boolean; limit: number; cursor?: string; includeClosed?: boolean }
): Promise<FillLinksResult> {
  const page = await deps.crm.listCardsWithoutDemoLink({ limit: opts.limit, ...(opts.cursor ? { cursor: opts.cursor } : {}) });
  const out: FillLinksResult = { apply: opts.apply, checked: 0, filled: 0, skippedClosed: 0, byStatus: {}, cursor: page.cursor };
  for (const card of page.cards) {
    out.checked++;
    if (!opts.includeClosed && CLOSED_STATUSES.includes(card.status)) {
      out.skippedClosed++;
      continue;
    }
    out.byStatus[card.status || '(ריק)'] = (out.byStatus[card.status || '(ריק)'] ?? 0) + 1;
    if (opts.apply) await fillCardLinks(deps, card);
    out.filled++;
  }
  return out;
}
