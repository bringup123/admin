# DECISIONS — decision log

Every material architectural or product decision is recorded here **the moment it is taken** (see AGENTS.md). Newest first.

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
