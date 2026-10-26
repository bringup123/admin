# SETUP

## Running it

```bash
npm install            # needs legacy-peer-deps (in .npmrc) — npm 10.9 trips over the tree otherwise
nice -n 19 npx vitest run
npx tsc --noEmit -p .
```

Every test boots its own PGlite database with the `v3` schema; nothing reaches a real system.

## The environment (`.env.example` has every name)

| Variable | Secret | Where it comes from |
|---|---|---|
| `DATABASE_URL` | yes | the shared Supabase, **session pooler, port 5432** (the transaction pooler is refused) — the dafna project's value |
| `MONDAY_API_TOKEN` | yes | the dafna project's (Aleksei's user) |
| `MANYCHAT_API_TOKEN` | yes | the dafna project's (account-scoped) |
| `MONDAY_WEBHOOK_SECRET` | yes | generated for V3; the `?token=` in the monday webhook URL |
| `CALCOM_WEBHOOK_SECRET` | yes | generated for V3; cal.com signs with it |
| `KILL_SWITCH_TOKEN` | yes | generated for V3; the `/kill?token=` bookmark |
| `ADMIN_TOKEN` | yes | generated for V3; the `/switch?token=` page |
| `CRON_SECRET` | yes | generated for V3; Vercel sends it to `/internal/tick` |
| `APP_ENV` | no | `production` on Vercel, nothing locally |
| `MONDAY_BOARD_ID` · `CALCOM_EVENT_TYPE_ID` · `BOOKING_URL` · `PHONE_ALLOWLIST` · `MAX_MESSAGES_PER_DAY` | no | set on Vercel 2026-10-25 |
| `CALCOM_DEMO_EVENT_TYPE_ID` · `DEMO_BOOKING_URL` | no | set on Vercel 2026-10-26: `7638021`, Sagi's demo page |
| `CALCOM_API_KEY` | yes | scripts only, not the service; Sagi's new key (2026-10-26) — the shared one is expired |

The five generated secrets were made on 2026-10-25 in a cloud session and exist only in that session's `.env` and in Vercel once imported. **Vercel is where they live.** A new session that needs them reads them in Vercel's dashboard (they are «sensitive», so only by re-entering them) — if lost, generate new ones, put them in Vercel, and re-register the webhooks that carry them.

## Deploying

- Vercel project `bringup-v3`, linked to this repo. A push to the production branch deploys. The first boot creates schema `v3` and its tables in the shared database (never `public`).
- The kill switch is **off** on a fresh database, and every message switch with it: a deployment sends nothing until someone opens `/switch?token=<ADMIN_TOKEN>`.
- Vercel cron calls `/internal/tick` every minute (`vercel.json`).

## Wiring, after the first deploy

```bash
set -a; source .env; set +a
npx tsx scripts/monday-webhooks.ts --url https://<deployment>            # dry run
npx tsx scripts/monday-webhooks.ts --url https://<deployment> --apply
npx tsx scripts/calcom-webhooks.ts --url https://<deployment>            # needs a live CALCOM_API_KEY
npx tsx scripts/calcom-webhooks.ts --url https://<deployment> --apply
npx tsx scripts/calcom-webhooks.ts --disable-account-wide <id> --apply   # the dafna service's
```

## Access a session needs

| What | How |
|---|---|
| monday CRM | the claude.ai monday connector (as Sagi), or `MONDAY_API_TOKEN` |
| ManyChat | `MANYCHAT_API_TOKEN` — reads and tags; cannot switch automations off |
| Vercel | the claude.ai Vercel connector, team `admin-23308494s-projects` |
| The dafna service | its kill switch is `/kill?token=` on `dafna-plum.vercel.app` |

A cloud session cannot open a Postgres connection (HTTPS only). **Never commit a `.env`.**
