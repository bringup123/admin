// The two monday webhooks V3 needs on the CRM board, pointed at a deployment.
//
//   set -a; source .env; set +a
//   npx tsx scripts/monday-webhooks.ts --url https://<deployment>           dry run: what is there, what would be made
//   npx tsx scripts/monday-webhooks.ts --url https://<deployment> --apply   register what is missing
//   npx tsx scripts/monday-webhooks.ts --url https://<deployment> --remove --apply
//
// monday does not return a webhook's URL, so «already there» is known only
// from this repo's record: docs/INTEGRATIONS.md lists the ids it made.

import { COL } from '../src/board.js';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const arg = (n: string) => args[args.indexOf(n) + 1];
const base = (arg('--url') ?? '').replace(/\/+$/, '');
const apply = flag('--apply');
const remove = flag('--remove');
const token = process.env.MONDAY_API_TOKEN ?? '';
const secret = process.env.MONDAY_WEBHOOK_SECRET ?? '';
const board = process.env.MONDAY_BOARD_ID ?? '1753447162';
if (!base.startsWith('https://')) throw new Error('--url https://… is required');
if (!token || !secret) throw new Error('MONDAY_API_TOKEN and MONDAY_WEBHOOK_SECRET are required');

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { authorization: token, 'content-type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data as T;
}

const url = `${base}/webhooks/monday?token=${encodeURIComponent(secret)}`;
const wanted = [
  { event: 'create_item', config: {} as Record<string, unknown>, what: 'a new card → the welcome' },
  { event: 'change_specific_column_value', config: { columnId: COL.trigger }, what: '«טריגר נציגה» → the buttons' },
];

const existing = await gql<{ webhooks: Array<{ id: string; event: string; config: string }> }>(
  `query ($b: ID!) { webhooks(board_id: $b) { id event config } }`,
  { b: board }
);
console.log(`board ${board} has ${existing.webhooks.length} webhooks:`);
for (const w of existing.webhooks) console.log(`  ${w.id}  ${w.event}  ${w.config}`);

if (remove) {
  const ids = (arg('--ids') ?? '').split(',').filter(Boolean);
  if (ids.length === 0) throw new Error('--remove needs --ids <id,id> (monday does not say which webhook points where)');
  for (const id of ids) {
    if (!apply) console.log(`would delete ${id}`);
    else console.log('deleted', (await gql<{ delete_webhook: { id: string } }>(`mutation ($id: ID!) { delete_webhook(id: $id) { id } }`, { id })).delete_webhook.id);
  }
} else {
  for (const w of wanted) {
    if (!apply) {
      console.log(`would register ${w.event} ${JSON.stringify(w.config)} (${w.what}) → ${base}/webhooks/monday?token=…`);
      continue;
    }
    const made = await gql<{ create_webhook: { id: string } }>(
      `mutation ($b: ID!, $u: String!, $c: JSON) { create_webhook(board_id: $b, url: $u, event: ${w.event}, config: $c) { id } }`,
      { b: board, u: url, c: JSON.stringify(w.config) }
    );
    console.log(`registered ${w.event} (${w.what}): webhook ${made.create_webhook.id}`);
  }
}
