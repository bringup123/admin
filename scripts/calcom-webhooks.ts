// cal.com webhooks for V3: one per event type (needs-mapping, demo), and the
// account-wide one the dafna service listens on, switched off.
//
//   set -a; source .env; set +a
//   npx tsx scripts/calcom-webhooks.ts --url https://<deployment>                         dry run
//   npx tsx scripts/calcom-webhooks.ts --url https://<deployment> --apply                 create or refresh the two
//   npx tsx scripts/calcom-webhooks.ts --disable-account-wide <webhookId> --apply         the dafna one off
//
// Why per event type: an account-wide webhook sends every booking on Sagi's
// account, which is how the dafna service came to take a demo for a
// needs-mapping meeting. Endpoints (bringup-journey, scripts/journey-calcom-webhooks.ts):
//   GET/POST /v2/event-types/{id}/webhooks · PATCH/DELETE …/{webhookId} · GET /v2/webhooks

const API = 'https://api.cal.com/v2';
const TRIGGERS = ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'];
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const arg = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const apply = flag('--apply');
const key = process.env.CALCOM_API_KEY ?? '';
const secret = process.env.CALCOM_WEBHOOK_SECRET ?? '';
if (!key) throw new Error('CALCOM_API_KEY is required');

async function call(path: string, init?: { method?: string; body?: unknown }): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? 'GET',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`cal.com ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}
type Hook = { id: string; subscriberUrl: string; active: boolean; triggers: string[] };
const hooksOf = (body: Record<string, unknown>) => (Array.isArray(body.data) ? (body.data as Hook[]) : []);

const accountWide = hooksOf(await call('/webhooks?take=250'));
console.log(`account-wide webhooks: ${accountWide.length}`);
for (const h of accountWide) console.log(`  ${h.id}  ${h.active ? 'ACTIVE' : 'off'}  ${h.subscriberUrl}`);

const off = arg('--disable-account-wide');
if (off) {
  if (!apply) console.log(`would switch off account-wide webhook ${off}`);
  else {
    await call(`/webhooks/${off}`, { method: 'PATCH', body: { active: false } });
    console.log(`switched off account-wide webhook ${off}`);
  }
}

const base = (arg('--url') ?? '').replace(/\/+$/, '');
if (base) {
  if (!secret) throw new Error('CALCOM_WEBHOOK_SECRET is required: the route writes the board and must be signed');
  const target = `${base}/webhooks/calcom`;
  const types = [
    { id: Number(process.env.CALCOM_EVENT_TYPE_ID ?? 6812251), what: 'needs-mapping' },
    { id: Number(process.env.CALCOM_DEMO_EVENT_TYPE_ID ?? 0), what: 'demo' },
  ];
  for (const t of types) {
    if (!t.id) {
      console.log(`${t.what}: no event type id — skipped`);
      continue;
    }
    const hooks = hooksOf(await call(`/event-types/${t.id}/webhooks?take=250`));
    const mine = hooks.find((h) => h.subscriberUrl === target);
    const body = { active: true, subscriberUrl: target, triggers: TRIGGERS, secret };
    if (!apply) {
      console.log(`${t.what} (${t.id}): ${hooks.length} webhooks; would ${mine ? `refresh ${mine.id}` : 'create one'} → ${target}`);
      continue;
    }
    if (mine) await call(`/event-types/${t.id}/webhooks/${mine.id}`, { method: 'PATCH', body });
    else await call(`/event-types/${t.id}/webhooks`, { method: 'POST', body });
    console.log(`${t.what} (${t.id}): webhook ${mine ? 'refreshed' : 'created'} → ${target}`);
  }
}
