# DECISIONS — decision log

Every material architectural or product decision is recorded here **the moment it is taken** (see AGENTS.md). Newest first.

---

## 2026-11-03 — The welcome leaves the status «חדש»

- **Decision:** after the welcome, the card's status is not changed. It stays «חדש»; the rep moves it to «בניסיונות תפיסה» by hand. (Ayala.) Overrides Sagi's brief, part 2 («אחרי השליחה הסטטוס מתעדכן ל"נשלחה הודעה ראשונה"») and follows his later word to her: «רק להכניס לידים לסטטוס חדש וזה הכל».
- **What still says the message went:** the update on the card («נשלחה הודעת ברוכים הבאים בוואטסאפ.»), the booking links in their cells, and the ManyChat contact.
- **Unchanged:** a card still on «נשלחה הודעה ראשונה» (from before) counts as new for the welcome, so nothing about old cards moves.

---

## 2026-11-02 — The cage is opened: V3 messages real Leads

- **Decision:** `allowlist_only` off (Ayala: «I want everything we built active, not only test numbers»). Live from then on: the welcome to every new Lead, the «3 שיחות לא נענו» button, and the thank-you to a Lead who types. Still off because their ManyChat half is not confirmed ready: `no_answer_5`, `reminder_day`, `reminder_hour`.
- **Against the contract:** T-012 asked for Sagi's go before the cage opened, and the thank-you is Ayala's wording, not Sagi's (safety rule 1). Ayala's call, recorded as hers.
- **Not sent retroactively:** the eleven Leads refused by the cage since 26.10 stay unsent — Ayala, «wait».
- **The wall that stays:** `MAX_MESSAGES_PER_DAY` = 100, once-only per message, the kill switch.

---

## 2026-11-02 — A typed message goes onto the card, and is thanked once

- **Decision:** what a Lead types in WhatsApp becomes an update on their card; they are answered «תודה על ההודעה, הצוות שלנו יצור איתך קשר בהקדם.» (Ayala's wording — not Sagi's; recorded as hers). Replaces Dafna's Default Reply flow, which still offered her menu and called the paused service.
- **Once in 12 hours per number,** decided by V3 and read by a ManyChat Condition — a Lead who writes three lines is thanked once. Behind its own switch `text_reply`, the kill switch and the cage, like every message; the update on the card does not wait for any switch, since it reaches no one.
- **Rejected:** ManyChat's own «once per 24 hours» on the Default Reply — it would also drop every later message before it reached the card.

---

## 2026-11-02 — The dafna service is paused on Vercel

- **Decision:** the whole dafna project paused (Ayala, after Sagi found new Leads in «נורצ'ר»). Its kill switch had stopped only what it *sent*: its intake still polled the board every few minutes, stamped new cards, and its one-day timeout moved them to «נורצ'ר». Seen live: `/internal/poll` → `runIntake` still running on 31.10.
- **What it costs:** nothing V3 needs — cal.com reports to V3 since 26.10. The dafna monday webhooks and ManyChat External Requests still pointing at it now get 503; they send nothing.
- **Undo:** Vercel → project `dafna` → Unpause (or the API's unpause). Unpausing restarts its intake and whatever jobs it had queued.

---

## 2026-11-01 — ManyChat reports a Lead's reply to V3, which notes it on the card

- **Decision:** the reminder's «confirm» and «change» replies come back to the card as updates (Ayala). Through V3, not a ManyChat → monday integration: V3 already knows the card and the next meeting, and every write to the board goes one way.
- **The URL's secret is derived from `CRON_SECRET`** (HMAC), so it needed no new setting on Vercel. Rotating `CRON_SECRET` changes it, and the URL in ManyChat must be pasted again.
- **No status is written:** «confirmed» says nothing the status does not; «change» may never become a change.

---

## 2026-10-26 — Two reminders before every meeting, timed by V3

- **Decision:** a day before and an hour before every needs-mapping and demo meeting; the hour-before carries a button into the Meet room. V3 times them, ManyChat sends them. A day-before that falls on Shabbat goes on Saturday at 21:00. The board's old day-before reminder (workflow 1717270848, webhook 157656773) is switched off once the new ones are proved — not before, so no booked Lead is left with none. (Ayala, four answers.)
- **Why V3 and not a ManyChat date trigger:** a ManyChat trigger on a date field does not hear a cancellation or a move, and one contact can hold a needs-mapping meeting and a demo at once. V3 already holds every booking with its state.
- **Shape:** nothing scheduled ahead — the tick reads the live bookings (docs/ARCHITECTURE.md). Once per booking *and* meeting time, so a meeting moved on the same uid is reminded of its new time.
- **Wording:** a draft in `docs/manychat-build-sheet.html`, **not to be submitted before Sagi approves it** (AGENTS.md, safety rule 1).
- **Rejected:** a reminder for a meeting booked inside the window (it was chosen minutes ago); Saturday daytime sending.

---

## 2026-10-26 — ManyChat's MOID holds the card's link

- **Decision:** every send writes the card's monday URL into the contact's `MOID` field. (Ayala.)
- **Why:** a person reading a contact in ManyChat reaches its card in one click.
- **What it overrides:** the dafna project kept out of `MOID` because it was Bringi's, and Bringi wrote a bare item id there. Bringi's flows are being switched off; any that still read `MOID` as an id will see a link.

---

## 2026-10-25 — V3 is a service in this repo, and cal.com's webhook moves here

- **Decision:** V3's messages and bookings are handled by a small service here (option 1 of the three), and the cal.com webhook is copied from the dafna service into it. (Ayala, «תעתיק את הוובהוק של קל קום לאדמין».)
- **Shape:** TypeScript + Hono on Vercel (the dafna project's proven shape); the shared Supabase Postgres, **schema `v3` alone**, pinned per connection as in `bringup-journey`; Vercel cron every minute.
- **cal.com webhooks per event type, not per user.** The dafna service's user-level webhook takes every booking on Sagi's account as a needs-mapping meeting. V3 subscribes on its two event types only, and **the dafna service's user-level webhook is switched off** at the same moment — otherwise both write the same card, and a demo booking is marked «נקבעה פגישה».
- **The buttons go through a trigger status column**, because monday has no webhook for a button press (proved in the dafna project, DECISIONS 2026-09-09). A label arriving over an empty cell is a stale retry and is ignored.
- **The welcome waits 90 seconds and re-reads the card,** because the item is created before its phone is filled.
- **The card id travels in the booking link as `?dafna_lead=<id>`,** reusing the hidden question already on Sagi's event type and ManyChat's `dafna_lead_id` field. In a template button the base ends in `?dafna_lead=` and the variable is the id alone — Meta percent-encodes the variable, so the `?` must be in the base (dafna DECISIONS 2026-09-03, ninth).
- **Rejected:** the dafna service re-purposed (it is the thing that was stopped; its intake, nudge and dial paths would all have to be proved off); monday + ManyChat alone (no once-only, no card id in the link, nothing to route a demo booking).

---

## 2026-10-25 — V3 lives in this repo

- **Decision:** customer journey V3 — the sales-rep process — is documented and built in `bringup123/admin`. The dafna repo records only that Dafna stopped. (Ayala, 2026-10-25.)
- **Why:** Dafna's repo describes a process that no longer runs, and `bringup-journey` holds Sagi's earlier, larger spec. V3 is neither.

---

## 2026-10-25 — Stop the dafna service by its kill switch

- **Decision:** the kill switch, now, rather than path by path. (Ayala.)
- **Why:** the per-path switches live in the dafna database, which the cloud session could not reach, and the dashboard token was not to hand. The kill switch takes effect at once and is undone with one call.
- **Cost, accepted for now:** the confirmation and reminders of meetings already booked stop too.

---

## 2026-10-25 — The rep's card: new columns, no renamed labels

- **Decision — new columns** rather than the half-matching old ones («כמה עובדים יש בעסק» is text, «סגמנט» has other labels, three closure-reason columns already disagree). (Ayala.)
- **Decision — no existing status label renamed.** Sagi's «פגישה נקבעה» / «תואמה פגישה», «לא רלוונטי», «פגישת דמו» map to the existing «נקבעה פגישה», «לא רלוונטי לעולם», «הצגת דמו», which the dafna service, ManyChat and a board webhook (status index 15) read. Put to Sagi.
- **Decision — «לחזור במועד» on label id 9.** The status column holds 40 labels and had 39. Id 9 was a deactivated duplicate «תיאום פגישה» with 0 cards and no automation or webhook referring to it. «בניסיונות תפיסה» took the last free id, 155.
- **«מערכת קיימת» is a single-choice dropdown,** because one of Sagi's labels is 33 characters and a status label holds 30.
- **«מספר ניסיונות» is a number, as Sagi wrote;** a list 1–5 is put to him.
