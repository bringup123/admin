# DECISIONS — decision log

Every material architectural or product decision is recorded here **the moment it is taken** (see AGENTS.md). Newest first.

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
