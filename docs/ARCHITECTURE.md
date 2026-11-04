# ARCHITECTURE

> What runs where. Decided 2026-10-25 (`docs/DECISIONS.md`): **V3 is a small service in this repo**, and it takes over cal.com's webhook from the dafna service.

## The parts

- **monday** — the CRM board (1753447162) is the system of record and the rep's workspace: her view «נציגה», her columns, her two buttons.
- **ManyChat** — the business line's WhatsApp. Each V3 message is a Meta-approved template behind a ManyChat automation triggered by a tag. The service sets the contact's fields, then adds the tag; adding the tag is the send.
- **cal.com** — Sagi's calendar: the needs-mapping event type (6812251) and a new demo event type. Each sends its bookings to the service.
- **The service** (`src/`) — TypeScript, Hono, on Vercel; Postgres in the shared Supabase database, **schema `v3` only** (the dafna project's tables are in `public`, the journey's in `journey`).

## Flows

### The welcome message

1. monday `create_item` webhook → `POST /webhooks/monday` → the card goes on `v3.welcome_queue`, due 90 seconds later. (A form or an automation fills the phone *after* creating the item; reading at once would find it empty.)
2. Vercel cron, every minute → `GET /internal/tick` → each due card is read again.
   - no valid phone yet and the card is under 30 minutes old → try again in 5 minutes; older → given up, with a note on the card.
   - a status that no longer says «new» (anything but empty, «חדש», «יש ליצור קשר», «נשלחה הודעה ראשונה») → not welcomed: a card made by hand for an old customer or a deal is not a new Lead.
   - otherwise → the guards, then the `welcome` message, once per card for ever. The message is the service finding or creating the ManyChat contact, writing `dafna_first_name` and `dafna_lead_id`, and adding `v3_welcome`; Ayala's ManyChat automation on that tag sends the template.
3. After the send: **the sales status is left as it is** — «חדש» until the rep moves it to «בניסיונות תפיסה» (Ayala, 2026-11-03); the card's empty «לינק לפגישה» and «לינק לפגישת דמו» cells get the card's own booking links.

### The rep's two buttons

monday has **no webhook for a button press** (proved in the dafna project) — a button can only run an automation. So:

1. «3 שיחות לא נענו» / «5 שיחות לא נענו» (button) → a monday automation writes the matching label into the status column «טריגר נציגה».
2. monday `change_specific_column_value` webhook on «טריגר נציגה» → `POST /webhooks/monday`.
3. The service reads the card. **An empty trigger cell is a stale press** (monday retries deliveries for minutes) and is ignored. Otherwise the cell is cleared at once, then the guards, then the message, once per card per button.
4. After the five-calls message: status «לבדיקת שגיא», «סיבת סגירה» = «לא ענה».
5. Whatever happened is written on the card as an update, in Hebrew, so the rep sees why a press did or did not send.

### The card's own booking links

«לינק לפגישה» and «לינק לפגישת דמו» carry the card's own cal.com links (`?dafna_lead=<id>`, name and email prefilled), written into **empty cells only** (`fillCardLinks`, `src/domain/welcome.ts`): after the welcome, on every press of either button (sent or not), and — for cards from before V3 — by `GET /api/fill-links?token=<admin>` (`&apply=1` to write, `&cursor=` for the next page, `&limit=` up to 50, `&closed=1` to include closed Leads; dry run by default). Closed Leads (`CLOSED_STATUSES`) are skipped.

### Bookings

cal.com webhook, **one per event type** (not user-level) → `POST /webhooks/calcom`, HMAC-signed.

| | needs-mapping | demo |
|---|---|---|
| created | status «נקבעה פגישה», «תאריך פגישת אפיון», meeting link in «לינק לפגישה», change link | status «נקבעה פגישת דמו», «תאריך פגישת דמו», meeting link in «לינק לפגישת דמו» |
| rescheduled | the date and links | the date and link |
| cancelled | date and links cleared, the booking link back in its cell, status «לבדיקת שגיא» **if still «נקבעה פגישה»** | the same for the demo columns, if still «נקבעה פגישת דמו» |

Every booking and move is also copied onto the Lead's ManyChat contact, if there is one (`V3_Meeting_When`, `V3_Meeting_Type`, `V3_Meeting_Link`, `V3_Meet_Code`, `V3_Booking_Uid`) — nothing is sent. A booking finds its card by the hidden question `dafna_lead` (the card id, carried by every link V3 writes or sends), then by the attendee's email. Unmatched bookings are logged. No WhatsApp is sent at the moment of booking (cal.com's own email invitation goes regardless).

### A meeting changed by hand on the board (`src/domain/board-edits.ts`, 2026-11-04)

monday webhooks on «תאריך פגישת אפיון», «לינק לפגישה», «תאריך פגישת דמו» and «לינק לפגישת דמו» (`change_specific_column_value`, registered from the live service by `GET /api/monday-webhooks?token=<admin>&apply=1`). The card is re-read and compared with V3's booking for that meeting type:

- **the same** → an echo of V3's own write, ignored;
- **a new date and time** → the booking moves (the reminders follow; it counts as booked now, so a reminder whose moment passed is not sent late) and ManyChat's fields are rewritten;
- **the date cleared** → the booking is `cleared_by_hand`; no reminders;
- **a date with no time** → no reminders, and the card says to add a time;
- **a Meet link pasted** → the room the hour-before sends;
- **a future date on a card with no booking** (a meeting arranged by telephone) → a `manual-…` booking with reminders.

Each writes an update on the card, which also says that **cal.com and Sagi's calendar did not change** — V3 does not move the real meeting.

### Meeting reminders (`src/domain/reminders.ts`, 2026-10-26)

Two WhatsApps before every needs-mapping and demo meeting — **a day before** and **an hour before**, the second with a button into the Google Meet room. Nothing is scheduled ahead: every tick reads `v3.bookings` for meetings in the next 25 hours, so a cancelled booking is simply not there and a moved one carries its new time. `v3.reminders` is the claim, one row per booking, reminder and meeting time, written before anything is sent.

- **Due:** an hour before; a day before, **moved to Saturday 21:00 when it falls between Friday 15:00 and Saturday 21:00** (Ayala: «במוצאי שבת»). Jewish holidays are not known.
- **Not sent:** a meeting booked after the reminder's moment (`booked_late` — booked this morning for this afternoon gets the hour-before only); a tick that comes too late (a day-before within 2 hours of the meeting, an hour-before within 10 minutes); a card whose status is no longer «נקבעה פגישה» or «נקבעה פגישת דמו» (a person moved it on); an hour-before with no Meet link (a note on the card).
- **Like the welcome,** a reminder its switch held back is settled, not sent later; a ManyChat failure is tried again next tick.
- **The send:** the usual guards and contact; the fields `V3_Meeting_Type`, `V3_Meeting_When`, `V3_Meet_Code`, `V3_Booking_Uid`; then the tag `v3_reminder_day` / `v3_reminder_hour`. A note on the card says it went.

### A Lead's reply, back on the card (`src/domain/lead-replies.ts`, 2026-11-01)

The day-before reminder's two quick replies, «מאשר/ת הגעה» and «שינוי מועד», each run a ManyChat External Request to `POST /webhooks/manychat?token=…` with `{"leadId": <dafna_lead_id>, "event": "confirmed" | "reschedule_requested"}`. V3 puts an update on the card naming the next booked meeting; nothing is sent and no column changes. A real move or cancellation still arrives from cal.com. The token is derived from `CRON_SECRET` (no setting of its own); The whole URL is shown at the foot of the switch page (behind the admin token), and `scripts/manychat-callback-url.ts` prints it.

### A Lead who types a message (`src/domain/lead-text.ts`, 2026-11-02)

ManyChat's **Default Reply** (WhatsApp) — the flow that ran Dafna's choice menu until 2026-11-02 — posts `{"leadId", "event": "text", "text", "phone"}` to the same `POST /webhooks/manychat`. The words go onto the card as an update («הליד כתב בוואטסאפ: «…»»); a contact with no card id is kept as `lead_text_unmatched` with the number. The answer carries `ack: yes|no`, which ManyChat maps into `V3_Ack` and a Condition reads before sending the thank-you. **yes** only when the kill switch and `text_reply` are on, the number passes the cage, and this number was not thanked in the last 12 hours. ManyChat pastes fields into the body raw, so a body broken by the Lead's own quotation marks is read leniently.

## Safety rails

- **Kill switch** — `v3.control.interactions_enabled`, **off at first boot**. The bookmark `GET /kill?token=…` stops everything that reaches a Lead; the switch page `/switch?token=…` shows and sets every switch.
- **One switch per message** — `welcome`, `no_answer_3`, `no_answer_5`, `reminder_day`, `reminder_hour`, `text_reply`, all off by default, on the switch page.
- **The cage** — `allowlist_only`, on by default **even in production**: only `PHONE_ALLOWLIST` numbers are messaged until it is opened. Outside production the allowlist always applies, whatever the switch says.
- **Daily cap** — `MAX_MESSAGES_PER_DAY`; a bug hits a wall.
- **Once only** — every message has a dedupe key (`welcome:<item>`, `no_answer_3:<item>`, `no_answer_5:<item>`; a reminder `reminder_day:<booking uid>:<start>`, so a moved meeting is reminded again); a second attempt sends nothing.
- **Never renames or creates a board label.** Status writes name an existing label; a label that is not there is an error, not a new label (the status column is full at 40).
