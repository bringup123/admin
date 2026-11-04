// The board's webhooks, read and registered from the live service — the one
// place that holds the board's token for certain (a cloud session's network
// may answer monday as another account; 2026-11-01).

const API = 'https://api.monday.com/v2';

export interface WebhookPlan {
  existing: Array<{ id: string; event: string; config: string }>;
  wanted: Array<{ columnId: string; what: string; present: boolean; created?: string }>;
}

export async function ensureColumnWebhooks(cfg: {
  token: string;
  boardId: string;
  url: string;
  columns: Array<{ columnId: string; what: string }>;
  apply: boolean;
}): Promise<WebhookPlan> {
  const gql = async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
    const res = await fetch(API, {
      method: 'POST',
      headers: { authorization: cfg.token, 'content-type': 'application/json', 'API-Version': '2024-10' },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(`monday GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
    return body.data as T;
  };
  const { webhooks } = await gql<{ webhooks: Array<{ id: string; event: string; config: string }> }>(
    'query ($b: ID!) { webhooks(board_id: $b) { id event config } }',
    { b: cfg.boardId }
  );
  const plan: WebhookPlan = { existing: webhooks, wanted: [] };
  for (const c of cfg.columns) {
    // monday does not return a webhook's URL; one on this column for this
    // event is taken to be ours.
    const present = webhooks.some((w) => w.event === 'change_specific_column_value' && (w.config ?? '').includes(c.columnId));
    const entry: WebhookPlan['wanted'][number] = { ...c, present };
    if (!present && cfg.apply) {
      const made = await gql<{ create_webhook: { id: string } }>(
        'mutation ($b: ID!, $u: String!, $c: JSON) { create_webhook(board_id: $b, url: $u, event: change_specific_column_value, config: $c) { id } }',
        { b: cfg.boardId, u: cfg.url, c: JSON.stringify({ columnId: c.columnId }) }
      );
      entry.created = made.create_webhook.id;
    }
    plan.wanted.push(entry);
  }
  return plan;
}
