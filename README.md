# GC PokerTracker

A private poker session tracker for the Gentleman's Club. The host runs the table from desktop; players join via invite link or QR code from their phones and get a read-only view of their stack and P/L.

## Features

- **Session setup** — currency and chip rate (e.g. 1000 NOK = 20 000 chips), default buy-in, blinds, house notes, and a blind structure calculator (players, starting blind, total chips, target length → escalating schedule)
- **Host dashboard** — buy-ins, chip corrections, cash-outs, live P/L per player, bank-check pill, live blind level + countdown with pause/resume, QR invite modal
- **Table Talk** — a live activity log of everything at the table: joins, buy-ins, rebuys, chip counts, busts, cash-outs, plus derived milestones (doubled up, half a stack, into the red / back in the black, chip-lead changes). Mistaken entries can be undone from the log.
- **TV mode** — fullscreen overlay (⛶ button) with a broadcast-style rotation: tournament clock, chip race, stack progression chart, P/L board, stats, activity feed, blind schedule, join QR and hand rankings. Snaps back to the clock before each level change; toasts + voice announce events.
- **Showdown** — `/showdown`: a 7-card Texas Hold'em evaluator; deal the board and each player's hole cards to settle who wins the pot
- **Settlement** — the summary computes the fewest payments that square the night
- **Phone join** — players scan a QR code, enter their name, and follow the game live; they cannot touch game state. Installable as a PWA (Add to Home Screen).
- **Live everywhere** — Supabase Realtime keeps the host, every phone, the TV and the summary in sync
- **Final standings** — ranked P/L when the night is over

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS v4)
- [Supabase](https://supabase.com) (Postgres + Realtime)
- Deployable on [Vercel](https://vercel.com)

## Getting started

### 1. Environment

Copy `.env.example` to `.env.local` and fill in your Supabase project values (Dashboard > Settings > API Keys):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

The secret key is only ever used server-side (Next.js server actions). Never expose it to the browser.

### 2. Database

Open the Supabase **SQL Editor** and run the migrations in order:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — tables, Row Level Security, Realtime
2. [`supabase/migrations/0002_blind_schedule.sql`](supabase/migrations/0002_blind_schedule.sql) — blind schedule as jsonb + blind-clock pause columns

Security model:

- **No write policies exist** — only the server (service-role key) can mutate data, so phones can never manipulate the game.
- The host's secret (`session_keys`) and player secrets (`player_keys`) live in tables with no read policies at all.
- `sessions`, `players`, and `transactions` are publicly readable, which is what powers Realtime updates.

### 3. Run

```
npm install
npm run dev
```

Open http://localhost:3000. To let phones join while developing, run `npm run dev -- -H 0.0.0.0` and have phones browse to `http://<your-LAN-IP>:3000` (same Wi-Fi).

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New Project** > import the repo. Next.js is auto-detected.
3. Add the three environment variables from `.env.local` under **Settings > Environment Variables**.
4. Deploy. The QR codes and invite links automatically use your production domain.

> Security note: if a secret key has ever been shared in chat or committed anywhere, rotate it in Supabase (Settings > API Keys) and update `.env.local` / Vercel env vars.

## Roadmap

- Host accounts via Supabase Auth
