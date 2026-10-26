# INTEGRATIONS — facts about the external systems

> Check here before guessing at an API. Every id was read off the live system on the date given.

## monday — the CRM board

- **Board:** «CRM», id **1753447162**, workspace «מחלקת הטמעה סביבת עבודה». 1140 cards on 2026-10-25. The real board — there is no V3 test board.
- **The claude.ai monday connector is logged in as Sagi** (user 61770599). The API token in the shared `.env` (`MONDAY_API_TOKEN`) is Aleksei's user (111299087) — every write made with it is attributed to him.
- **The sales status column `status` is full: 40 labels, the monday maximum,** deactivated ones included. A new label means retiring one.

### V3's columns (created 2026-10-25)

| Column | id | Type | Values |
|---|---|---|---|
| תחום העסק | `color_mm8fjc8p` | status | רו"ח, עו"ד, מפעל ייצור, יבואן, רשות, עמותה, קבלן/יזם, אחר |
| מספר עובדים | `numeric_mm8ffgk2` | numbers | |
| מערכת קיימת | `dropdown_mm8fptqg` | dropdown, single choice | three labels — a dropdown because one label is 33 characters and a status label holds 30 |
| רמת עניין | `color_mm8fke1` | status | חם, פושר, קר |
| מי ישתתף בפגישה | `text_mm8f5ks0` | text | |
| מספר ניסיונות | `numeric_mm8fw6vr` | numbers | as Sagi asked |
| סיבת סגירה | `color_mm8fgkyt` | status | לא ענה (**label 17**), לא קהל יעד (3), אין תקציב (2), לא הזמן (0), יש פתרון אחר (4), לא השאיר פרטים / מספר שגוי (18), אחר (10) |
| סיכום שיחה - נציגה | `long_text_mm8fwy6s` | long text | the template is in the column description. «סיכום שיחה» `long_text_mm6js9kj` is Dafna's |
| 3 שיחות לא נענו | `button_mm8f8htw` | button | nothing behind it yet |
| 5 שיחות לא נענו | `button_mm8ffw41` | button | nothing behind it yet |
| לינק לפגישת דמו | `link_mm8fn2g5` | link | empty |

| טריגר נציגה | `color_mm8f5qtn` | status | «3 שיחות לא נענו» (label 0), «5 שיחות לא נענו» (label 2) — written by the buttons' automations only, cleared by V3 |
| תאריך פגישת דמו | `date_mm8frbxn` | date + time | written by V3 on a demo booking |

**The buttons' automations** (monday workflows, 2026-10-25): **1719626042** — «3 שיחות לא נענו» clicked → «טריגר נציגה» = «3 שיחות לא נענו»; **1719626048** — the same for 5. Neither reaches anything until the monday webhook on «טריגר נציגה» is registered (`scripts/monday-webhooks.ts`).

**View «נציגה»**, id **59740922**: name, phone, email, company, status, the eleven columns above, «מועד פעולה הבאה» `date_mkkgbp9t`, «לינק לפגישה» `link_mm0w28s`; newest first.

### Sales status labels — rebuilt by Ayala on 2026-10-26

The column was cut from 40 labels to 17 the morning of 2026-10-26. Read back the same day:

| id | label | V3 |
|---|---|---|
| 4 | חדש | a new Lead — welcomed (with an empty status, «יש ליצור קשר», «נשלחה הודעה ראשונה») |
| 8 | נשלחה הודעה ראשונה | written after the welcome (re-added by Ayala) |
| 2 | תיאום פגישה | |
| 15 | נקבעה פגישה | written on a needs-mapping booking |
| 156 | נקבעה פגישת דמו | written on a demo booking (was «פגישה 2 נקבעה») |
| 9 | לבדיקת שגיא | written after the five-calls button, and on a cancelled booking still marked booked (re-added by Ayala) |
| 1 · 3 · 6 · 10 · 102 | הצעת מחיר · אושר · הסתיים - לשמור על קשר · לא רלוונטי לעולם · פנייה חוזרת | |
| 5 | (empty label) | was «חדש» |
| 0 · 7 · 11 · 13 · 19 · 105 | deactivated | |

**Gone:** «בניסיונות תפיסה», «לחזור במועד», «נורצ'ר», «הצגת דמו» and the dafna labels. **The dafna service writes its labels with `create_labels_if_missing`**, so while its intake runs it can put deleted labels back.

### Other columns worth knowing

«טלפון» `phone_mkqtk0hs` · «אימייל» `text_mkkg1f95` (text, not email) · «חברה» `text_mkkgh8dc` · «תאריך פגישת אפיון» `date_mm0q3ske` · «לינק לפגישה» `link_mm0w28s` (the dafna service writes the booking link and later the Meet link here) · «לינק לשינוי/ביטול פגישה» `link_mm0wn4hy` · «MCID» `text_mm00452k` (ManyChat contact id) · «טלפון» status `color_mm6mmerw` (Dafna's dial trigger, label «תתקשר») · «מעקב שליחת ווצאפ» `date_mkswczee` and «סטטוס שליחת ווצאפ במייק» `color_mkswgknc` (the Make nurture loop).

## What messages a Lead today (inventory, 2026-10-25)

### The dafna service — **stopped** (kill switch, 2026-10-25)

Every path below is off while the kill switch is on. The per-path switch is the one to set before it is ever lifted (settings screen, `https://dafna-plum.vercel.app/settings?token=<DASHBOARD_TOKEN>`).

| Path | Per-path switch |
|---|---|
| Choice message on a new Lead (3 buttons), writes «נשלחה הודעה ראשונה» | `CHOICE_FLOW_ENABLED`; `LEAD_INTAKE_ENABLED` |
| The 24-hour nudge + «נורצ'ר» | none — cancel queued `choice_timeout` jobs (`scripts/cancel-queued-work.ts`) |
| Pre-call notice | `PRE_CALL_NOTICE_MINUTES=0` |
| Dafna's calls (NLPearl), incl. a person flipping «טלפון» to «תתקשר» | `MAX_CALLS_PER_DAY=0`; `LEAD_INTAKE_ENABLED` |
| No-answer messages, callback confirmation, booking link | only `MANYCHAT_SEND_ENABLED` / the kill switch |
| Meeting confirmation and day-before reminder (any cal.com booking) | only `MANYCHAT_SEND_ENABLED` / the kill switch |
| Day-of reminders | `MEETING_DAY_MESSAGES` |
| Campaign button «שליחת קמפיין» | `OUTREACH_SEND` (was on, cage open, on 2026-09-10) |
| Contacts-board greeting | `GREETING_SEND` |

`MANYCHAT_SEND_ENABLED` (true in production) blocks *every* message of that service at once.

### ManyChat — on, unless someone switched it off

The ManyChat API reads tags and flows but **cannot switch an automation off**; that is console work.

- Tags whose automations are not the dafna service's: «ליד חדש» (80091349), «נקבעה פגישה» (82084739), «יום לפני פגישה» (82155037), «שעה לפני פגישה» (82899158), «פגישה בוטלה» (82253307), «רוצה שיחה» (82703842), «קביעת פגישה» (80204612), `wave2_followup` (98097077), `wave2_enterprise` (98097078), `smb_contact_1` (97772706).
- Flows: «בוט איסוף מידע מליד» (Bringi; a 10-minute video follow-up and a 1-hour «ראיתי שהתחלת תהליך ולא סיימת» nudge), «אישור קביעת פגישה», «שליחת תזכורת יום לפני הפגישה», «תזכורת שעה לפני פגישה», «שליחת הודעות ידנית», `wave2_followup`, `wave2_enterprise`, «אחרי וובינר 29.09.2026 תיאם פגישות», the webinar series, and an «Untitled» flow created 2026-10-25 13:38.
- **WhatsApp Default Reply** (`wa_default`) — the dafna service's typed-reply catch was wired into it on 2026-09-03.

### monday — the board's own automations and webhooks

13 webhooks on 2026-10-25, plus V3's two since 2026-10-26: **190950292** (`create_item` → the welcome) and **190950293** (`change_specific_column_value` on «טריגר נציגה» → the buttons), both to `https://bringup-v3.vercel.app/webhooks/monday?token=…`. The API does not return their URLs.

| Webhook | Fires on | Owner |
|---|---|---|
| 183793658 | any change of «סטטוס» | dafna (closure) |
| 184624299 | «טריגר קמפיין» = «שנה טובה» | dafna (campaign) |
| 182858546 | «טלפון» = «תתקשר» | almost certainly dafna (dial trigger) |
| 125529381, 153342135 (+121371584, inactive) | item created | one is likely dafna's intake; the other unknown |
| 121313953 (inactive) | any column change | unknown |
| 131964610 | «סטטוס שליחת ווצאפ במייק» = Done | the Make nurture loop |
| 153636640 | «סטטוס שליחת וואטסאפ עסק קטן» = בשליחה | unknown — «שלח וואטסאפ \| עסק קטן» |
| 156164705 | button «שליחת הודעת בדיקה ללקוח» | unknown |
| 157508715 | «סטטוס» = «נקבעה פגישה» | unknown — likely the ManyChat «נקבעה פגישה» confirmation |
| 157656773 | «תזכורות» = «יום לפני פגישה» | unknown — likely the ManyChat day-before reminder |
| 170359380 | «שליחת הודעה» = any | unknown |

Board automations that feed a sender: «הסתיים - לשמור על קשר» → «מעקב שליחת ווצאפ» = today + 3 months → on that date at 07:00 «סטטוס שליחת ווצאפ במייק» = Done → webhook 131964610 (Make) → back to «בהמתנה» and +3 months again. **A three-monthly WhatsApp to every closed Lead, for ever** — the likeliest «nurture sequence» in Sagi's brief.

The Make organisation reachable from the claude.ai connector («Haruv», eu1) is **not** the one behind these webhooks: none of its scenarios touch this board.

## Vercel

- Team `admin-23308494s-projects` (`team_6ME8IIFubWy8tTVbDFG66PS0`). V3's project **`bringup-v3`** (`prj_UTZMLTJGDEtKm9uzFKRhQKNpwBDY`), linked to `bringup123/admin`, Vercel Authentication off (the routes check their own tokens; monday and cal.com must reach them). **Production URL: https://bringup-v3.vercel.app** — production deploys from `claude/clever-goodall-bs7uzy`, the repo's only branch, until a `main` exists. On 2026-10-25 it built and answered 500 on `/health`, as it must with no `DATABASE_URL`. The dafna project is `prj_k3T4ljPOWzaZWZwO1WO6iubBYy14`.

### What Ayala switched off on 2026-10-26 (read back from the API)

Off: both other `create_item` webhooks (125529381, 153342135), the three-monthly nurture chain (131963099, 131964610, 131965763, 132435731), «שלח וואטסאפ | עסק קטן» (workflow 1717206992, webhook 153636640), «שליחת הודעת בדיקה ללקוח» (156164705), «נקבעה פגישה» (157508715), «שליחת הודעה» (170359380), and the dafna service's three (182858546 dial trigger, 183793658 closure, 184624299 campaign). **Still on:** the day-before reminder — workflow 1717270848 (date arrives on «תאריך פגישת אפיון» → «תזכורות» = «יום לפני פגישה») and its webhook 157656773 — waiting on Sagi's answer about reminders; and the internal ones (assign on creation, dates, the ads-board links, the webinar board, the campaign button's own workflow).

## cal.com

- Sagi's account (`sagi-goldberger-xnuzdu`). Two event types V3 reads:
  - **needs-mapping, 6812251** (`CALCOM_EVENT_TYPE_ID`) → «נקבעה פגישה», «תאריך פגישת אפיון», the meeting and change links.
  - **demo, 7638021** «פגישת דמו עם שגיא», 30 min, `https://cal.com/sagi-goldberger-xnuzdu/פגישת-דמו-עם-שגיא` (`CALCOM_DEMO_EVENT_TYPE_ID`, `DEMO_BOOKING_URL`; Sagi made it 2026-10-26) → «נקבעה פגישת דמו», «תאריך פגישת דמו», «לינק לפגישת דמו».
  - A booking on any other of Sagi's event types is ignored.
- **The hidden question `dafna_lead`** (text, hidden, optional) was added to 7638021 over the API on 2026-10-26; 6812251 already had it. The PATCH replaced the booking fields, and cal.com dropped the system field `attendeePhoneNumber`, which was hidden and optional there — nothing the booker saw changed.
- **Webhooks, per event type, since 2026-10-26** — both to `https://bringup-v3.vercel.app/webhooks/calcom`, on created / rescheduled / cancelled, signed with `CALCOM_WEBHOOK_SECRET`: **1b19cbe4-96bb-42b6-a965-14f51cacfb35** on 6812251, **1c5b1835-1b91-47a9-8bb4-2eb5147c1e75** on 7638021. `scripts/calcom-webhooks.ts --url … --apply` creates or refreshes them.
- **The dafna service's user-level webhook 1358828b-d7eb-4d91-9d24-b5dad6b7570f is switched off** (inactive, not deleted) at the same moment, 2026-10-26. It ignored `eventTypeId` and recorded every booking on Sagi's account as needs-mapping. Undo: `active: true` on that id — but then both services write the same card.
- **API key:** Sagi's new key, 2026-10-26, in the session's `.env` only (scripts, not the service). It passed through the chat — rotate it once V3 is proved. The key in the shared `.env` is expired.
- A booking finds its row by, in order: `metadata.itemId` (API bookings), the hidden booking question `dafna_lead` carrying the card id, then the attendee's email. Never by phone. A demo event type needs the same hidden question.

## ManyChat and Meta

- **V3's tags** (created 2026-10-25 over the API): `v3_welcome` **99906572**, `v3_no_answer_3` **99906573**, `v3_no_answer_5` **99906574**. No automation behind them yet — `docs/manychat-build-sheet.html`. Adding one to a contact sends nothing until its automation exists.
- **The reminders' tags and fields** (created over the API 2026-10-26, `scripts/manychat-reminder-fields.ts`): tags `v3_reminder_day` **99956955**, `v3_reminder_hour` **99956958**; text fields `V3_Meeting_Type` **15100098** («פגישת מיפוי הצרכים» / «פגישת הדמו»), `V3_Meeting_When` **15100099** («יום רביעי, 28.10 בשעה 11:00»), `V3_Meet_Code` **15100100** (`abc-defg-hij`, the Meet button's variable), `V3_Booking_Uid` **15100101** (the cal.com uid; `https://cal.com/booking/` + this is the change-or-cancel page), `V3_Meeting_Link` **15100234** (the whole Meet link). **Written on every booking and move** onto the Lead's contact if one exists (none is created for it), and again just before each reminder — the latest booking wins.
- **Fields V3 writes on every send:** `dafna_first_name` **14918920**, `dafna_lead_id` **14899233** (both the dafna project's; reused), **`V3_Name` 15098516** (the first name, for the templates' «היי {{1}}» — Ayala's field, 2026-10-26), and **`MOID` 14291950** — the card's link, `https://bringup-io.monday.com/boards/1753447162/views/23542451/pulses/<item id>` (Ayala, 2026-10-26). MOID was Bringi's and held a bare item id; anything of Bringi's still reading it as an id would now get a link.

- Account «BringUp», Pro. API base `https://api.manychat.com`, token `MANYCHAT_API_TOKEN`.
- Sending a template = set the contact's fields, add a tag; a ManyChat automation on that tag sends the Meta-approved template. A URL button can carry a variable tail; Meta only ever sees the ASCII base.
- Templates with a cal.com button whose tail is the card id already exist (the dafna `_id` twins, base `…?dafna_lead=`) — the pattern V3's three templates follow.
