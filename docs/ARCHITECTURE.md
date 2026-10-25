# ARCHITECTURE

> What runs where. V3 has no code yet; this page holds the shape and the decision still open.

## The parts

- **monday** — the CRM board is the system of record and the rep's workspace: her view, her columns, her two buttons. Status moves a person or a column value causes are monday automations.
- **ManyChat** — the business line's WhatsApp. Each V3 message is a Meta-approved template behind a ManyChat automation triggered by a tag.
- **cal.com** — Sagi's calendar: the needs-mapping event type and a new demo event type. A booking reaches the board by a webhook.
- **A service** — what monday cannot do alone: read a new card, set the ManyChat fields and tag for the right contact, record that a message went once and only once, and route a cal.com booking to its row and status by event type.

## Open decision — what sends V3's messages (T-004)

1. **A small service in this repo.** Owns V3 end to end, nothing of Dafna's in the path. Needs hosting, a database for the once-only record, and its own webhooks on the board and in cal.com — and the cal.com webhook is user-level, so the dafna service would have to stop receiving bookings.
2. **The dafna service, re-purposed.** Everything already exists there: ManyChat sending with guards, the once-only key, the button pattern (outreach), the cal.com listener. It needs a welcome path, two button routes and an event-type branch — and it stays the thing that is «stopped».
3. **monday + ManyChat only.** A monday automation sends a webhook straight to ManyChat. No service at all, but no once-only guarantee, no card id in the booking link, and nothing to route a demo booking.

Not decided. Put to the user with the trade-offs above.
