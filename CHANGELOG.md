# Changelog

All material changes to the project, newest first.
Format follows [Keep a Changelog](https://keepachangelog.com/); written in business language, readable by a non-technical reader.
Categories: **Added** / **Changed** / **Fixed** / **Removed**.

## 2026-10-25 (evening) — The system behind the rep is written

### Added
- **The new system is written and tested, and sends nothing yet.** It does three things: welcomes every new Lead with one WhatsApp a minute and a half after the card appears, and moves the card to «נשלחה הודעה ראשונה»; sends the right WhatsApp when the rep presses one of her two buttons, and after five calls hands the Lead to Sagi; and puts each meeting booked in Sagi's calendar on the right card — a needs-mapping meeting and a demo now kept apart, which the old system could not do.
- **Every part of it starts switched off.** An emergency stop, a switch for each of the three messages, a «test numbers only» mode that stays on until someone opens it, a daily limit, and a rule that each message goes to each Lead once only. A page with all the switches, in Hebrew, for anyone with the link.
- **The rep's buttons now do something on the board:** pressing one marks the card, and the system (once it is connected) reads the mark, sends, and clears it. A press that cannot send says why on the card.
- **A date column for demo meetings,** and a page with the three WhatsApp messages ready to submit to WhatsApp for approval.

## 2026-10-25 — V3 starts

### Added
- **A home for the new lead process.** Sagi is moving the Leads to an external sales rep who calls them herself. His brief is kept here word for word, with the tasks it becomes and what stands in the way.
- **The rep's card on the CRM board.** New columns she fills, mostly by picking from a list: the business's field, number of employees, the system they have today, how interested they are, who will attend the meeting, how many attempts so far, why the Lead was closed, and a call summary with Sagi's fixed template. Two new statuses, «בניסיונות תפיסה» and «לחזור במועד», and a view called «נציגה» that shows her only those columns. Two buttons for a Lead who does not answer are on the board but do nothing yet — the messages behind them first need WhatsApp's approval — and there is an empty column for the demo-meeting link.
- **A list of everything that sends messages to Leads today**, so each one can be switched off by name.

### Changed
- **Dafna, the AI caller, is switched off.** Her emergency stop was pressed: she makes no calls and her system sends no WhatsApp, including, for now, the confirmation and reminders of meetings already booked. Some of the messages Leads receive come from older automations in ManyChat and on the board; those still need switching off by the person who built them.
