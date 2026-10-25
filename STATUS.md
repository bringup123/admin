# STATUS — project state

> The source of truth for project state. Updated at the end of every working session (see AGENTS.md).

- **Current stage:** V3 starts — the switch-off is half done, the rep's card is on the board, nothing new sends yet.
- **Last updated:** 2026-10-25 — Sagi's brief arrived (`spec/sagi-brief-2026-10-25.md`); this repo was started the same day.

## Done on 2026-10-25

- **Dafna is stopped.** Her kill switch was pressed at about 14:55 UTC (`GET https://dafna-plum.vercel.app/kill`, answered `{"interactions":"paused"}`). The dafna service sends nothing and dials nobody — **including the confirmation and reminders of meetings already booked.** Recorded in the dafna repo too.
- **The rep's card on the CRM** (board 1753447162), additive only: eleven columns, two statuses, two buttons with nothing behind them, an empty demo-link column, and a view «נציגה». Ids in `docs/INTEGRATIONS.md`. No existing column or label renamed.
- **An inventory of everything that messages a Lead**, in `docs/INTEGRATIONS.md` → «What messages a Lead today».

## In progress

**T-001 — the switch-off.** The dafna service is off. Still on, or unknown: the ManyChat automations behind the tags «ליד חדש», «נקבעה פגישה», «יום לפני פגישה», «שעה לפני פגישה», `wave2_followup`, `wave2_enterprise`, and Bringi's follow-ups; the eleven board webhooks the dafna repo does not own; the board's «הסתיים - לשמור על קשר» → +3 months → «מעקב שליחת ווצאפ» loop into Make. **Needs Aleksei** — he built them and the API cannot say where the webhooks point.

## Next

1. Aleksei: identify and switch off the senders above (T-001).
2. Sagi's answers to the seven questions in `TASKS.md` → T-002.
3. The three Meta templates (T-003), then what sends them (T-004, architecture undecided — `docs/ARCHITECTURE.md`).
4. The demo event type on cal.com and the booking routing (T-005).
5. Screenshots for the rep's training (T-006).

## Blockers

- **The cal.com API key in the shared `.env` is expired** (`401 Your api key is expired`). A new one from Sagi's account is needed for T-005. If production's dafna deployment carries the same key, its slot lookups fail too.
- **Any cal.com booking on Sagi's account is taken by the dafna service as a needs-mapping meeting** — it does not read the event type. While the dafna service handles bookings, **no demo link goes out**: a demo booking would set «נקבעה פגישה» and, once the kill switch is lifted, send needs-mapping messages.
- **The dafna service's per-path switches could not be set from the cloud session** (no database access over TCP, no dashboard token). Lifting its kill switch before they are set brings every Dafna message back.
