// The CRM board's column ids and the labels V3 writes. Read off the live
// board on 2026-10-25 (docs/INTEGRATIONS.md). Constants, not settings: they
// must match things that exist on the board, and a value that can drift from
// the board is worse than one that cannot.

export const COL = {
  phone: 'phone_mkqtk0hs',
  /** A text column, not an email column. */
  email: 'text_mkkg1f95',
  status: 'status',
  closeReason: 'color_mm8fgkyt',
  /** Written by the two buttons' automations; cleared by V3. */
  trigger: 'color_mm8f5qtn',
  meetingDate: 'date_mm0q3ske',
  /** The booking link before a meeting, the meeting link once there is one. */
  meetingLink: 'link_mm0w28s',
  meetingChangeLink: 'link_mm0wn4hy',
  demoDate: 'date_mm8frbxn',
  /** The same two lives for the demo: booking link, then meeting link. */
  demoLink: 'link_mm8fn2g5',
} as const;

/** Sales status labels, exactly as they are on the board. V3 never creates a
 *  label: the column is full at 40, and a typo must fail, not add one. */
export const STATUS = {
  firstMessageSent: 'נשלחה הודעה ראשונה',
  meetingBooked: 'נקבעה פגישה',
  demoBooked: 'הצגת דמו',
  sagiCheck: 'לבדיקת שגיא',
} as const;

/** The statuses the welcome may overwrite with «נשלחה הודעה ראשונה». Anything
 *  else on the card was put there by a person, or by a booking, and is theirs. */
export const WELCOME_OVERWRITES = ['', 'חדש', 'יש ליצור קשר'];

/** A card is a new Lead to welcome only while its status still says so
 *  (Ayala, 2026-10-26: «a new lead in status new lead»). A form leaves the
 *  status empty; the board stamps «יש ליצור קשר» on empty cards at noon; and
 *  until its intake is switched off, the dafna service writes «נשלחה הודעה
 *  ראשונה» within seconds of a card arriving — without sending anything while
 *  its kill switch is on. A card created by hand in any other status (an old
 *  customer, a deal) is not welcomed. */
export const WELCOME_STATUSES = [...WELCOME_OVERWRITES, 'נשלחה הודעה ראשונה'];

export const CLOSE_REASON_NO_ANSWER = 'לא ענה';

/** The trigger column's labels, and the message each one sends. */
export const TRIGGER_LABELS = {
  '3 שיחות לא נענו': 'no_answer_3',
  '5 שיחות לא נענו': 'no_answer_5',
} as const;
