# TASKS — task queue

> Maintained **by hand** — there is no external sync.
> Agent: work to the contract in AGENTS.md — one task at a time, update state at every transition.

<!-- Task format:
### T-000: short title
- priority: high / normal / low · created: YYYY-MM-DD
- description: what needs doing and why.
- acceptance criteria: how we know it is done.
- steps:  ← optional
  - [ ] first step
-->

## In progress

### T-001: Switch off everything that messages a Lead
- priority: high · created: 2026-10-25
- description: Sagi, part 1: every automation that messages a Lead goes, nurture and follow-up included; checked with Aleksei. The inventory is in `docs/INTEGRATIONS.md`.
- acceptance criteria: for each sender in the inventory, either «off» with who switched it and when, or «kept» with Sagi's word; a new test card created on the board receives nothing but what V3 sends.
- steps:
  - [x] the dafna service — kill switch, 2026-10-25
  - [ ] the dafna service's per-path switches: `CHOICE_FLOW_ENABLED`, `LEAD_INTAKE_ENABLED`, `OUTREACH_SEND`, `GREETING_SEND` off; `PRE_CALL_NOTICE_MINUTES=0`; `MAX_CALLS_PER_DAY=0`; queued `choice_timeout` jobs cancelled (Aleksei, settings screen)
  - [ ] the eleven undocumented board webhooks — each named and, if it sends, removed (Aleksei)
  - [ ] the ManyChat automations behind the tags in the inventory, and Bringi's 10-minute and 1-hour follow-ups (Aleksei / console)
  - [ ] the board's «הסתיים - לשמור על קשר» → «מעקב שליחת ווצאפ» loop into Make
  - [ ] proof: a test card, created and watched for a day

### T-002: The rep's card on the CRM
- priority: high · created: 2026-10-25
- description: Sagi, parts 3 and 4: a clean card with list fields, six statuses.
- acceptance criteria: the «נציגה» view shows only her fields; every list holds Sagi's values; the six statuses exist; Sagi's open questions answered.
- steps:
  - [x] eleven columns, two new statuses, the view «נציגה» (2026-10-25)
  - [ ] Sagi's answers (below), and any change they cause
  - [ ] the call-summary template filled in on a new card (a monday automation, if Sagi wants it)
- questions put to Sagi:
  1. Keep the meeting confirmation and reminders? «No other message» would turn them off.
  2. Use the existing labels «נקבעה פגישה», «לא רלוונטי לעולם», «הצגת דמו» for his «פגישה נקבעה», «לא רלוונטי», «פגישת דמו»?
  3. The booking link as a button, not a URL in the text — the only way a booking finds its row.
  4. A Lead with no email — welcome them too?
  5. Should the buttons check that 3 / 5 attempts are recorded?
  6. «מספר ניסיונות» as a list 1–5 instead of a number?
  7. The rep's monday seat — a full member sees every column whatever her view shows.

## Waiting

### T-003: Three WhatsApp templates through Meta
- priority: high · created: 2026-10-25
- description: the welcome, the three-calls and the five-calls messages, in Sagi's words, from the business line. Each with a cal.com URL button whose tail carries the card id, so a booking lands on its row.
- acceptance criteria: approved by Meta; each seen on an allowlisted handset.

### T-004: What sends them
- priority: high · created: 2026-10-25 · **blocked on an architecture decision** (`docs/ARCHITECTURE.md`)
- description: the welcome on every new card (then «נשלחה הודעה ראשונה»); each button sends its message once; the five-calls button also writes «לבדיקת שגיא» and «סיבת סגירה» = «לא ענה».
- acceptance criteria: one message per card per kind, ever; a card with no phone says so on the card; nothing sends while its switch is off.

### T-005: The demo meeting
- priority: normal · created: 2026-10-25
- description: Sagi, part 6: a separate cal.com event type; the link in «לינק לפגישת דמו»; a booking lands on the Lead's row and sets the demo status.
- acceptance criteria: a test booking on the demo type moves the test card to the demo status and nothing else; a needs-mapping booking still behaves as before.
- blocked on: a fresh cal.com API key; the booking routing (the dafna service today takes every booking as needs-mapping).

### T-006: Screenshots for the rep's training
- priority: normal · created: 2026-10-25
- description: the board, the card, both buttons, the four lists — Leads' phones and emails blurred.
- acceptance criteria: sent to Sagi. Plan: shoot a test card with invented details, so nothing needs blurring.
