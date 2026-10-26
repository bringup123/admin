# STATUS — project state

> The source of truth for project state. Updated at the end of every working session (see AGENTS.md).

- **Current stage:** **V3 is live, inside the test cage.** The welcome (proved on Ayala's handset) and «3 שיחות לא נענו» are switched on; «5 שיחות לא נענו» is off until its template is approved. Both cal.com event types — needs-mapping and the new demo — report to V3, and the dafna service no longer hears cal.com. The cage (`allowlist_only`) is on: only allowlisted numbers receive anything.
- **Last updated:** 2026-10-26, afternoon.

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
- **Ayala built the ManyChat automation on `v3_welcome`;** the template was approved and **the welcome arrived on her handset** from test card 3308729347. The first try left the card's status unchanged — the label had been removed from the board, and the whole write failed; fixed so a missing label is dropped and the rest written, and a sent welcome never re-queues.
- **ManyChat fields:** every send writes the first name into `V3_Name` (what Ayala's V3 automations read) and the card's monday link into `MOID`.
- **The demo meeting on cal.com is wired (T-005).** Sagi made the event type (7638021, «פגישת דמו עם שגיא») and a fresh API key; the hidden question `dafna_lead` added to it; webhooks on both event types to V3; **the dafna service's account-wide cal.com webhook switched off.** Ids in `docs/INTEGRATIONS.md`.
- **«3 שיחות לא נענו» approved by Meta; its switch is on** (cage on). Not yet pressed.

## Superseded — kept for the record

**T-009, the deploy, waits on eight secrets in Vercel.** The session that wrote them may not hand credentials to the Vercel connector, so a person imports them: Vercel → `bringup-v3` → Settings → Environment Variables → import the session's `.env.vercel` (Production, Sensitive). Five of the eight were generated in that session and exist nowhere else — if the session is gone before they are imported, generate new ones (docs/SETUP.md). Then a redeploy (variables apply to new deployments only), `https://bringup-v3.vercel.app/health`, and the wiring (`docs/SETUP.md`, «Wiring»).

## Next, in order

1. **Press «3 שיחות לא נענו» on the test card** (Ayala) and read the message and the card's note; a second press must send nothing.
2. **Book from the test card** — a needs-mapping meeting and a demo (each link on the card), then reschedule and cancel each (T-011).
3. «5 שיחות לא נענו»: template and automation (Ayala), then its switch and the same press.
4. Aleksei: the dafna service's intake and queued work (T-001).
5. Screenshots (T-006); the cage opened (T-012, with Sagi's go).

## Blockers and risks

- **The dafna service is still writing to new cards while its kill switch is on.** Read off the board on 2026-10-26: card 3308222546, created 25.10 at 20:04 UTC — five hours after the kill switch — got «נשלחה הודעה ראשונה», «תתקשר» and a booking link from it (user 111299087), and 3307165902 was moved to «נורצ'ר» by its 24-hour nudge the same evening. The kill switch stops what it *sends*; its intake and its labels go on. Two consequences: the cards say a first message went when it did not, and **whatever it queued is parked, not cancelled — lifting its kill switch would send it.** Aleksei: `LEAD_INTAKE_ENABLED` off and the queued work cancelled (T-001). V3 tolerates the label: «נשלחה הודעה ראשונה» still counts as a new Lead.

- **Cards that existed before the welcome have no «לינק לפגישת דמו».** The welcome writes both booking links; older cards need a one-off fill if the rep is to send them a demo link from the card.
- **Sagi's new cal.com key passed through the chat.** Rotate it once V3 is proved.
- **Sagi's wording:** the three templates say «בכפתור כאן למטה» where his text had «[לינק]» — the link is a button. His approval is question 3.
