# BringUp — customer journey V3

BringUp's lead process from 2026-10-25: **an external sales rep (נציגה) calls the Leads on the monday CRM and books meetings into Sagi's calendar.** The system around her does three things only:

1. **Welcomes every new Lead** with one WhatsApp from the business line — who BringUp is, that a rep will call, TheMarker article, and Sagi's booking link. The card moves to «נשלחה הודעה ראשונה».
2. **Gives the rep a clean card** on the CRM — the fields she fills, mostly from lists — and a view of her own.
3. **Two buttons for a Lead who does not answer,** pressed by the rep: after three unanswered calls, a WhatsApp with two articles and the booking link; after five, a last message with one more article, and the card goes to «לבדיקת שגיא» with closure reason «לא ענה».

Bookings come through cal.com: a needs-mapping meeting (the existing event type) and a **demo meeting** (a new, separate event type); each lands on the Lead's row and sets its status.

**Everything else that used to message Leads is switched off** — Dafna, the AI caller (`bringup123/dafna`, stopped 2026-10-25), the nurture and follow-up sequences.

Sagi's brief, verbatim: [`spec/sagi-brief-2026-10-25.md`](spec/sagi-brief-2026-10-25.md). Where things stand: [`STATUS.md`](STATUS.md).
