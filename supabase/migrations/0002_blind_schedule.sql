-- Blind schedule as first-class data (previously parsed out of notes text),
-- plus pause support for the blind clock.
--
-- blind_schedule: { "levelMin": 20, "levels": [{ "level": 1, "smallBlind": 25,
--                   "bigBlind": 50, "startsAtMin": 0 }, ...] } or null
-- blind_paused_at: set while the clock is paused, null while running
-- blind_paused_ms: accumulated paused time, subtracted from elapsed

alter table public.sessions
  add column if not exists blind_schedule jsonb,
  add column if not exists blind_paused_at timestamptz,
  add column if not exists blind_paused_ms bigint not null default 0;
