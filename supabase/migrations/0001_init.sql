-- GC PokerTracker — initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  status              text not null default 'setup' check (status in ('setup','active','ended')),
  currency_code       text not null default 'NOK',
  -- chip rate: cash_per_rate in currency equals chips_per_rate in chips
  -- e.g. 1000 NOK = 20000 chips
  cash_per_rate       numeric not null check (cash_per_rate > 0),
  chips_per_rate      numeric not null check (chips_per_rate > 0),
  default_buy_in_cash numeric not null check (default_buy_in_cash > 0),
  small_blind         numeric not null default 0,
  big_blind           numeric not null default 0,
  notes               text not null default '',
  join_code           text not null unique,
  started_at          timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz not null default now()
);

-- Host secret kept in a separate table so the sessions table can be
-- publicly readable (for Realtime) without ever leaking the host key.
create table public.session_keys (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  host_key   text not null
);

create table public.players (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name       text not null,
  seat       int check (seat between 1 and 10),
  role       text not null default 'player' check (role in ('host','player')),
  status     text not null default 'active' check (status in ('active','cashed_out')),
  created_at timestamptz not null default now(),
  unique (session_id, seat)
);

-- Player secret, same separation as session_keys.
create table public.player_keys (
  player_id  uuid primary key references public.players(id) on delete cascade,
  player_key text not null
);

create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  type        text not null check (type in ('buy_in','cash_out','adjustment')),
  cash_amount numeric not null default 0,
  chip_amount numeric not null default 0,
  created_at  timestamptz not null default now()
);

create index players_session_idx on public.players(session_id);
create index transactions_session_idx on public.transactions(session_id);
create index transactions_player_idx on public.transactions(player_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Writes: NO policies anywhere -> only the service-role key (used by Next.js
-- server actions) can mutate anything. Phones can never touch game state.
-- Reads: sessions/players/transactions are publicly readable (needed for
-- Realtime). The *_keys tables have no policies at all, so secrets are
-- unreadable from the client.
-- ---------------------------------------------------------------------------

alter table public.sessions     enable row level security;
alter table public.session_keys enable row level security;
alter table public.players      enable row level security;
alter table public.player_keys  enable row level security;
alter table public.transactions enable row level security;

create policy "public read sessions"     on public.sessions     for select using (true);
create policy "public read players"      on public.players      for select using (true);
create policy "public read transactions" on public.transactions for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.sessions, public.players, public.transactions;
