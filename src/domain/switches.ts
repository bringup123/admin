import type { Db } from '../db/db.js';

// The runtime switches, in `v3.control`. A missing row reads as the default,
// and every default is the safe one: nothing reaches a Lead until a person
// turns it on, and the cage stays shut until a person opens it.

export const MESSAGE_KINDS = ['welcome', 'no_answer_3', 'no_answer_5', 'reminder_day', 'reminder_hour'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const SWITCHES = {
  /** The kill switch. Off: nothing reaches any Lead. */
  interactions_enabled: { default: false, he: 'המערכת פעילה (מתג החירום)' },
  welcome: { default: false, he: 'הודעת ברוכים הבאים לליד חדש' },
  no_answer_3: { default: false, he: 'כפתור «3 שיחות לא נענו»' },
  no_answer_5: { default: false, he: 'כפתור «5 שיחות לא נענו»' },
  reminder_day: { default: false, he: 'תזכורת יום לפני פגישה (אפיון ודמו)' },
  reminder_hour: { default: false, he: 'תזכורת שעה לפני פגישה, עם לינק ה-Meet' },
  /** The cage. On: only numbers on PHONE_ALLOWLIST, even in production. */
  allowlist_only: { default: true, he: 'רק למספרים ברשימת הבדיקה' },
} as const;
export type SwitchKey = keyof typeof SWITCHES;

export function isSwitchKey(k: string): k is SwitchKey {
  return Object.prototype.hasOwnProperty.call(SWITCHES, k);
}

export async function readSwitches(db: Db): Promise<Record<SwitchKey, boolean>> {
  const r = await db.query<{ key: string; value: string }>('select key, value from control');
  const stored = new Map(r.rows.map((row) => [row.key, row.value]));
  const out = {} as Record<SwitchKey, boolean>;
  for (const key of Object.keys(SWITCHES) as SwitchKey[]) {
    const v = stored.get(key);
    out[key] = v === undefined ? SWITCHES[key].default : v === 'true';
  }
  return out;
}

export async function setSwitch(db: Db, key: SwitchKey, on: boolean, by: string): Promise<void> {
  await db.query(
    `insert into control (key, value, updated_by, updated_at) values ($1, $2, $3, now())
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [key, String(on), by]
  );
  await db.query('insert into events (type, payload) values ($1, $2)', [
    'switch_set',
    JSON.stringify({ key, on, by }),
  ]);
}
