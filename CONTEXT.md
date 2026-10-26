# CONTEXT — domain glossary

> The canonical meaning of every project term. Not a spec, no implementation detail.

**Lead** (ליד): a person who enquired, one row on the CRM board. Every Lead is a real person.

**Rep** (נציגה): the external sales rep of the pilot that began 2026-10-25. She calls the Leads, fills the card, books meetings into Sagi's calendar, and presses the two buttons. A person, not a system — nothing in V3 calls a Lead.
_Avoid_: agent, Dafna (Dafna was the AI caller, stopped).

**Card** (כרטסת): what the rep sees when she opens a Lead — the fields she fills and nothing else. On the board: the «נציגה» view.

**Welcome message** (הודעת ברוכים הבאים): the one WhatsApp every new Lead gets from the business line, in Sagi's words: who BringUp is, that a rep will call, the TheMarker article, and Sagi's booking link. After it, the Lead is «נשלחה הודעה ראשונה».
_Avoid_: first touch, choice message (Dafna's, with three buttons — not this).

**Attempt** (ניסיון): one call by the rep. Counted by her, on the card, 1–5.

**The three-calls message / the five-calls message**: the two WhatsApps the rep sends by a button when a Lead has not answered three, then five, calls. The second is the last message V3 sends an unanswered Lead; with it the Lead goes to Sagi («לבדיקת שגיא», closure reason «לא ענה»).
_Avoid_: nurture, follow-up sequence — there is no sequence; each is one press, one message.

**Needs-mapping meeting** (פגישת מיפוי צרכים): the first meeting with Sagi, booked on his existing cal.com event type.

**Demo meeting** (פגישת דמו): a later meeting on its own cal.com event type, booked through the card's demo link.

**Meeting reminder** (תזכורת לפגישה): one of two WhatsApps before a booked meeting, needs-mapping or demo — a day before (Saturday night instead of Shabbat) and an hour before, the second with the way into the room. Not sent for a meeting that was cancelled, booked too close to its time, or whose card a person has moved on.

**Booking link**: a cal.com link that names the Lead's card, so the meeting lands on the right row. A meeting booked without it is one the system cannot place.

**Business line** (הקו העסקי): BringUp's WhatsApp number, sent through ManyChat — the same number the earlier flows used, so its quality rating is shared with every message ever sent from it.
