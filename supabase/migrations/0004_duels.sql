-- Poker Duel: a fun side-game. One player challenges another for a chip
-- amount; on accept the server deals two hole cards each plus a full board,
-- decides the winner, and the TV plays the runout with live equities.
--
-- deal: { "holes": [[{rank,suit},{rank,suit}],[...]], "board": [{rank,suit} x5] }
--       holes[0] belongs to the challenger, holes[1] to the opponent.
-- winner_id: null on a settled duel means a split (chopped) pot.

create table public.duels (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  challenger_id uuid not null references public.players(id) on delete cascade,
  opponent_id   uuid not null references public.players(id) on delete cascade,
  chip_amount   numeric not null check (chip_amount > 0),
  status        text not null default 'pending'
                check (status in ('pending','declined','cancelled','settled')),
  deal          jsonb,
  winner_id     uuid references public.players(id) on delete set null,
  created_at    timestamptz not null default now(),
  settled_at    timestamptz
);

create index duels_session_idx on public.duels(session_id);

-- Tie duel chip transfers to their duel so the activity feed can tell them
-- apart from ordinary chip counts.
alter table public.transactions
  add column if not exists duel_id uuid references public.duels(id) on delete set null;

-- Same security model as the rest: public read (drives Realtime), no write
-- policies — only the server mutates.
alter table public.duels enable row level security;
create policy "public read duels" on public.duels for select using (true);

alter publication supabase_realtime add table public.duels;
