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

## The whole road, in order

Who does each step: **C** = Claude in a session, **A** = Aleksei, **S** = Sagi, **Y** = Ayala.

1. T-007 — the service: code and tests (C)
2. T-008 — the board's half: a trigger column, two automations, a demo-date column (C)
3. T-003 — three templates submitted to Meta, three ManyChat automations (Y/A, from the build sheet)
4. T-009 — deploy: a Vercel project, its environment, the database schema (C, with Y's go)
5. T-005 — cal.com: a fresh API key and the demo event type (S); webhooks per event type, dafna's user-level webhook off (C)
6. T-010 — monday webhooks registered (C)
7. T-001 — everything else that messages a Lead switched off (A)
8. T-011 — the proof on a test card, an allowlisted handset (C + Y)
9. T-006 — screenshots (Y)
10. T-012 — switch on, one message at a time, cage last (Y, with S's go)

T-002 (Sagi's answers) runs alongside; an answer may change a step.

## In progress

### T-007: The service — welcome, buttons, bookings ✓ code and tests 2026-10-25 (47 tests); proved live under T-011
- priority: high · created: 2026-10-25
- description: the service in `docs/ARCHITECTURE.md`: monday and cal.com webhooks, the welcome queue and its tick, the two buttons, the bookings of both event types, the switch page, the guards.
- acceptance criteria: tests prove each flow and each guard — the kill switch, each message's switch, the cage, the daily cap, once-only, a stale press, a status a person set left alone, a demo booking kept apart from a needs-mapping one; typecheck clean.

### T-001: Switch off everything that messages a Lead
- priority: high · created: 2026-10-25
- description: Sagi, part 1. The inventory is in `docs/INTEGRATIONS.md`.
- acceptance criteria: for each sender, «off» with who and when, or «kept» with Sagi's word; a test card created on the board receives nothing but what V3 sends.
- steps:
  - [x] the dafna service — kill switch, 2026-10-25
  - [ ] the dafna service's per-path switches (A, settings screen): `CHOICE_FLOW_ENABLED`, `LEAD_INTAKE_ENABLED`, `OUTREACH_SEND`, `GREETING_SEND` off; `PRE_CALL_NOTICE_MINUTES=0`; `MAX_CALLS_PER_DAY=0`; queued `choice_timeout` cancelled
  - [ ] the dafna service's cal.com webhook (user-level) off — at the moment V3's go on (T-005)
  - [ ] the eleven undocumented board webhooks named and, if they send, removed (A) — **first 157508715 (status = «נקבעה פגישה»), which V3 will set off on every booking**
  - [ ] the ManyChat automations behind «ליד חדש», «נקבעה פגישה», «יום לפני פגישה», «שעה לפני פגישה», `wave2_*`, and Bringi's follow-ups (A)
  - [ ] the board's «הסתיים - לשמור על קשר» → «מעקב שליחת ווצאפ» loop into Make (A)

### T-002: The rep's card and Sagi's answers
- priority: high · created: 2026-10-25
- steps:
  - [x] eleven columns, two statuses, the view «נציגה» (2026-10-25)
  - [ ] Sagi's answers, and any change they cause
- questions put to Sagi:
  1. Keep the meeting confirmation and reminders? «No other message» turns them off; until he answers, V3 sends none (cal.com's email invitation still goes).
  2. Use the existing «נקבעה פגישה», «לא רלוונטי לעולם», «הצגת דמו» for his «פגישה נקבעה», «לא רלוונטי», «פגישת דמו»?
  3. The booking link as a button, not a URL in the text — the only way a booking finds its row.
  4. A Lead with no email — V3 welcomes them anyway. Right?
  5. Should the buttons check that 3 / 5 attempts are recorded? V3 sends on any press.
  6. «מספר ניסיונות» as a list 1–5?
  7. The rep's monday seat — a full member sees every column whatever her view shows.
  8. The welcome goes at any hour, the moment the Lead arrives, like Dafna's first message did. Right?

## Waiting

### T-008: The board's half ✓ 2026-10-25
- priority: high · created: 2026-10-25
- steps:
  - [x] status column «טריגר נציגה» (`color_mm8f5qtn`) with «3 שיחות לא נענו», «5 שיחות לא נענו»
  - [x] two automations: each button writes its label (1719626042, 1719626048)
  - [x] date column «תאריך פגישת דמו» (`date_mm8frbxn`)

### T-003: Three templates through Meta, three ManyChat automations
- priority: high · created: 2026-10-25
- description: from `docs/manychat-build-sheet.html`. The three tags exist (2026-10-25).
- acceptance criteria: approved; each automation fires on its tag and sends its template.

### T-009: Deploy
- priority: high · created: 2026-10-25
- steps:
  - [x] a Vercel project on the BringUp team, linked to this repo (`bringup-v3`)
  - [x] its six non-secret variables
  - [ ] **the eight secrets — a person imports `.env.vercel` (docs/SETUP.md)**
  - [ ] the `v3` schema created by the first boot; `/health` answers

### T-005: The demo meeting on cal.com
- priority: high · created: 2026-10-25
- steps:
  - [ ] a fresh API key on Sagi's account (S) — the shared one is expired
  - [ ] the demo event type, with the hidden question `dafna_lead` (S, or C with the key)
  - [ ] webhooks on both event types → V3; the user-level one → off (C)

### T-010: monday webhooks
- priority: high · created: 2026-10-25
- steps:
  - [ ] `create_item` → V3
  - [ ] `change_specific_column_value` on «טריגר נציגה» → V3

### T-011: The proof
- priority: high · created: 2026-10-25
- acceptance criteria: on a test card carrying an allowlisted handset: the welcome arrives and the status moves; each button sends once and a second press sends nothing; a needs-mapping booking and a demo booking each land on the card with their own status; a cancellation of each puts the card back.

### T-006: Screenshots for the rep's training
- priority: normal · created: 2026-10-25
- description: the board, the card, both buttons, the four lists — on the test card, so nothing needs blurring.

### T-012: Switch on
- priority: high · created: 2026-10-25
- steps:
  - [ ] the kill switch on, the cage on — only allowlisted numbers
  - [ ] `welcome` on; watched on the next real Lead with the cage open
  - [ ] `no_answer_3`, `no_answer_5` on
  - [ ] Sagi told
