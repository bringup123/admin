-- V3's own schema in the Supabase Postgres it shares with the dafna project
-- (`public`) and bringup-journey (`journey`). Every table is named in full.
-- monday is the system of record; the database keeps only the mechanics.
create schema if not exists v3;

-- Runtime switches: the kill switch and one switch per message, set from the
-- switch page. Seeded off (src/domain/switches.ts); a missing row is «off».
create table v3.control (
  key text primary key,
  value text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Every message V3 has sent or tried to send. The dedupe key makes a message
-- once-only for ever: a second attempt conflicts and sends nothing.
create table v3.messages (
  id bigserial primary key,
  monday_item_id text not null,
  kind text not null,
  dedupe_key text not null unique,
  phone text not null,
  status text not null default 'sending',  -- sending | sent | failed
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index messages_created_at on v3.messages (created_at);

-- New cards waiting for their welcome. A card is created before its phone is
-- filled, so the tick reads it again when it falls due.
create table v3.welcome_queue (
  monday_item_id text primary key,
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  attempts int not null default 0,
  status text not null default 'pending',  -- pending | done | gave_up | skipped
  outcome text,
  updated_at timestamptz not null default now()
);
create index welcome_queue_due on v3.welcome_queue (status, due_at);

-- cal.com bookings, one row per booking uid, so a reschedule or a
-- cancellation finds its card and its meeting type.
create table v3.bookings (
  uid text primary key,
  monday_item_id text not null,
  meeting text not null,                   -- needs_mapping | demo
  start_at timestamptz,
  status text not null default 'booked',   -- booked | cancelled
  meeting_url text,
  replaced_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_item on v3.bookings (monday_item_id);

-- What happened, for reading back. Every refusal writes one.
create table v3.events (
  id bigserial primary key,
  type text not null,
  monday_item_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index events_created_at on v3.events (created_at);

-- Every webhook body as it arrived, before anything was done with it.
create table v3.webhook_inbox (
  id bigserial primary key,
  source text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
