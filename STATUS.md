# STATUS — project state

> The source of truth for project state. Updated at the end of every working session (see AGENTS.md).

- **Current stage:** the V3 service is written and tested (47 tests) and has a Vercel project; **it is not deployed yet** — its secrets have to be put into Vercel by a person. Nothing V3 does reaches a Lead.
- **Last updated:** 2026-10-25, evening.

## Done on 2026-10-25

- **Dafna is stopped** — her kill switch, about 14:55 UTC. Recorded in the dafna repo too.
- **The rep's card on the CRM**: eleven columns, two statuses, the view «נציגה» (ids in `docs/INTEGRATIONS.md`).
- **The board's half of the buttons**: status column «טריגר נציגה» (`color_mm8f5qtn`), date column «תאריך פגישת דמו» (`date_mm8frbxn`), and two monday automations (1719626042, 1719626048) — each button writes its label. Nothing listens to that column yet, so a press does nothing.
- **The service** (`src/`, `docs/ARCHITECTURE.md`): the welcome queue and its minutely tick, the two buttons, cal.com bookings of both event types (copied from the dafna service, now telling needs-mapping from demo), the switch page, the kill switch, the cage, the daily cap, once-only. Every switch starts off.
- **ManyChat**: tags `v3_welcome`, `v3_no_answer_3`, `v3_no_answer_5` created. No automation behind them.
- **The build sheet** for the three Meta templates and their automations: `docs/manychat-build-sheet.html` (Hebrew).
- **Vercel**: project `bringup-v3`, linked to this repo; its six non-secret variables set.
- **An inventory of everything that messages a Lead** — `docs/INTEGRATIONS.md`.

## Stopped here — the next step is a person's

**T-009, the deploy, waits on eight secrets in Vercel.** The session that wrote them may not hand credentials to the Vercel connector, so a person imports them: Vercel → `bringup-v3` → Settings → Environment Variables → import the session's `.env.vercel` (Production, Sensitive). Five of the eight were generated in that session and exist nowhere else — if the session is gone before they are imported, generate new ones (docs/SETUP.md). Then a deploy, `/health`, and the wiring (`docs/SETUP.md`, «Wiring»).

## Next, in order (TASKS.md, «The whole road»)

1. The secrets into Vercel; deploy; `/health` answers and the `v3` tables exist.
2. monday webhooks registered (`scripts/monday-webhooks.ts`).
3. The three templates to Meta and their automations (`docs/manychat-build-sheet.html`).
4. cal.com: a fresh API key and the demo event type with the hidden question `dafna_lead` (Sagi); then the per-type webhooks and the dafna account-wide one off (`scripts/calcom-webhooks.ts`).
5. Aleksei: everything else that messages a Lead switched off (T-001).
6. The proof on a test card (T-011), screenshots (T-006), switch on (T-012).

## Blockers and risks

- **The cal.com API key in the shared `.env` is expired.** Needed for the webhooks and the demo event type.
- **Writing «נקבעה פגישה» may set off an old confirmation message.** Webhook 157508715 fires on that label and is not the dafna service's — very likely the ManyChat «אישור קביעת פגישה» flow via Make. V3 writes that label on every needs-mapping booking. It must be identified and switched off (T-001) before V3's cal.com webhooks go on — and it fires today already, whenever anyone sets the label by hand.
- **Any cal.com booking is still recorded by the dafna service as needs-mapping** (account-wide webhook, no event-type check). No demo link goes out until that webhook is off.
- **Sagi's wording:** the three templates say «בכפתור כאן למטה» where his text had «[לינק]» — the link is a button. His approval is question 3.
