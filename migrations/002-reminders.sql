-- The two meeting reminders (Ayala, 2026-10-26): a day before and an hour
-- before every needs-mapping and demo meeting. Nothing is scheduled ahead:
-- the tick reads v3.bookings, so a cancelled booking is simply no longer
-- there and a moved one carries its new time. This table is the claim — one
-- row per booking, reminder and start time, written before anything is sent,
-- so two ticks never send the same reminder and a refusal is not retried.
create table v3.reminders (
  booking_uid text not null,
  kind text not null,                      -- reminder_day | reminder_hour
  start_at timestamptz not null,           -- the meeting time it reminded of
  monday_item_id text not null,
  status text not null default 'working',  -- working | sent | skipped
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (booking_uid, kind, start_at)
);
