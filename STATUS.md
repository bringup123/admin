# STATUS — project state

> The source of truth for project state. Updated at the end of every working session (see AGENTS.md).

- **Current stage:** **V3 is live and wired to monday, with every switch off.** https://bringup-v3.vercel.app/health answers `ok`, schema `v3` exists, the tick and the switch page answer. A new card is queued and, while `welcome` is off, skipped for good; a button press writes «the switch is off» on the card. Nothing reaches a Lead.
- **Last updated:** 2026-10-26, morning.

## Done on 2026-10-25

- **Dafna is stopped** — her kill switch, about 14:55 UTC. Recorded in the dafna repo too.
- **The rep's card on the CRM**: eleven columns, two statuses, the view «נציגה» (ids in `docs/INTEGRATIONS.md`).
- **The board's half of the buttons**: status column «טריגר נציגה» (`color_mm8f5qtn`), date column «תאריך פגישת דמו» (`date_mm8frbxn`), and two monday automations (1719626042, 1719626048) — each button writes its label. Nothing listens to that column yet, so a press does nothing.
- **The service** (`src/`, `docs/ARCHITECTURE.md`): the welcome queue and its minutely tick, the two buttons, cal.com bookings of both event types (copied from the dafna service, now telling needs-mapping from demo), the switch page, the kill switch, the cage, the daily cap, once-only. Every switch starts off.
- **ManyChat**: tags `v3_welcome`, `v3_no_answer_3`, `v3_no_answer_5` created. No automation behind them.
- **The build sheet** for the three Meta templates and their automations: `docs/manychat-build-sheet.html` (Hebrew).
- **Vercel**: project `bringup-v3`, linked to this repo; its six non-secret variables set.
- **An inventory of everything that messages a Lead** — `docs/INTEGRATIONS.md`.

## 2026-10-26

- **The secrets are in Vercel** (Ayala). They went in as «encrypted» for Production *and Preview*, not «sensitive»; a preview deployment would therefore reach the real board and database. There is only one branch, so no preview runs today — but before a second branch exists, either mark them Sensitive/Production-only or turn previews off.
- **Redeployed; live.** `/health` → `{"ok":true,"appEnv":"production",…}` with every switch off.
- **monday webhooks registered:** 190950292 (`create_item`), 190950293 («טריגר נציגה»). The script's `create_item` call is fixed — monday refuses any config on that event, even `{}`.
- **The shared credentials were exposed** in plain text for a few minutes in Vercel and in the session transcript: the Supabase password, the monday token, the ManyChat token. Rotate them once V3 is proved (they are the dafna project's too).
- **Ayala built the ManyChat automation on `v3_welcome`.** Whether its template is approved is not yet known.

## Superseded — kept for the record

**T-009, the deploy, waits on eight secrets in Vercel.** The session that wrote them may not hand credentials to the Vercel connector, so a person imports them: Vercel → `bringup-v3` → Settings → Environment Variables → import the session's `.env.vercel` (Production, Sensitive). Five of the eight were generated in that session and exist nowhere else — if the session is gone before they are imported, generate new ones (docs/SETUP.md). Then a redeploy (variables apply to new deployments only), `https://bringup-v3.vercel.app/health`, and the wiring (`docs/SETUP.md`, «Wiring»).

## Next, in order (TASKS.md, «The whole road»)

1. The secrets into Vercel; deploy; `/health` answers and the `v3` tables exist.
2. monday webhooks registered (`scripts/monday-webhooks.ts`).
3. The three templates to Meta and their automations (`docs/manychat-build-sheet.html`).
4. cal.com: a fresh API key and the demo event type with the hidden question `dafna_lead` (Sagi); then the per-type webhooks and the dafna account-wide one off (`scripts/calcom-webhooks.ts`).
5. Aleksei: everything else that messages a Lead switched off (T-001).
6. The proof on a test card (T-011), screenshots (T-006), switch on (T-012).

## Blockers and risks

- **The dafna service is still writing to new cards while its kill switch is on.** Read off the board on 2026-10-26: card 3308222546, created 25.10 at 20:04 UTC — five hours after the kill switch — got «נשלחה הודעה ראשונה», «תתקשר» and a booking link from it (user 111299087), and 3307165902 was moved to «נורצ'ר» by its 24-hour nudge the same evening. The kill switch stops what it *sends*; its intake and its labels go on. Two consequences: the cards say a first message went when it did not, and **whatever it queued is parked, not cancelled — lifting its kill switch would send it.** Aleksei: `LEAD_INTAKE_ENABLED` off and the queued work cancelled (T-001). V3 tolerates the label: «נשלחה הודעה ראשונה» still counts as a new Lead.

- **The cal.com API key in the shared `.env` is expired.** Needed for the webhooks and the demo event type.
- **Writing «נקבעה פגישה» may set off an old confirmation message.** Webhook 157508715 fires on that label and is not the dafna service's — very likely the ManyChat «אישור קביעת פגישה» flow via Make. V3 writes that label on every needs-mapping booking. It must be identified and switched off (T-001) before V3's cal.com webhooks go on — and it fires today already, whenever anyone sets the label by hand.
- **Any cal.com booking is still recorded by the dafna service as needs-mapping** (account-wide webhook, no event-type check). No demo link goes out until that webhook is off.
- **Sagi's wording:** the three templates say «בכפתור כאן למטה» where his text had «[לינק]» — the link is a button. His approval is question 3.
