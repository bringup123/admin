// The ManyChat fields and tags the meeting reminders need (src/domain/reminders.ts).
// Dry run by default; --apply creates what is missing. Never changes or deletes.
// Usage: npx tsx scripts/manychat-reminder-fields.ts [--apply]
const BASE = process.env.MANYCHAT_API_BASE ?? 'https://api.manychat.com';
const TOKEN = process.env.MANYCHAT_API_TOKEN ?? '';
const APPLY = process.argv.includes('--apply');
if (!TOKEN) {
  console.error('MANYCHAT_API_TOKEN is empty');
  process.exit(2);
}

const FIELDS: Array<{ name: string; description: string }> = [
  { name: 'V3_Meeting_Type', description: 'V3 reminders: «פגישת מיפוי הצרכים» or «פגישת הדמו»' },
  { name: 'V3_Meeting_When', description: 'V3 reminders: the whole moment, «יום רביעי, 28.10 בשעה 11:00»' },
  { name: 'V3_Meet_Code', description: 'V3 reminders: the Google Meet code alone, abc-defg-hij — the button variable' },
  { name: 'V3_Booking_Uid', description: 'V3 reminders: the cal.com booking uid — https://cal.com/booking/{{1}} reschedules' },
];
const TAGS = ['v3_reminder_day', 'v3_reminder_hour'];

async function api(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ManyChat ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const fields = ((await api('/fb/page/getCustomFields')).data ?? []) as Array<{ id: number; name: string; type: string }>;
const tags = ((await api('/fb/page/getTags')).data ?? []) as Array<{ id: number; name: string }>;
for (const f of FIELDS) {
  const hit = fields.find((x) => x.name === f.name);
  if (hit) {
    console.log(`✓ field ${f.name} exists — id ${hit.id} (${hit.type})`);
    continue;
  }
  if (!APPLY) {
    console.log(`✗ field ${f.name} missing`);
    continue;
  }
  const made = await api('/fb/page/createCustomField', { caption: f.name, type: 'text', description: f.description });
  console.log(`+ field ${f.name} created — id ${made.data?.field?.id ?? made.data?.id ?? JSON.stringify(made.data)}`);
}
for (const t of TAGS) {
  const hit = tags.find((x) => x.name === t);
  if (hit) {
    console.log(`✓ tag ${t} exists — id ${hit.id}`);
    continue;
  }
  if (!APPLY) {
    console.log(`✗ tag ${t} missing`);
    continue;
  }
  const made = await api('/fb/page/createTag', { name: t });
  console.log(`+ tag ${t} created — id ${made.data?.tag?.id ?? made.data?.id ?? JSON.stringify(made.data)}`);
}
if (!APPLY) console.log('\nDRY RUN — re-run with --apply to create the missing ones.');
