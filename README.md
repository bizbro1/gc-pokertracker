# GC PokerTracker

A private poker session tracker for the Gentleman's Club. The host runs the table from desktop; players join via invite link or QR code from their phones and get a read-only view of their stack and P/L.

## Features

- **Session setup** — currency and chip rate (e.g. 1000 NOK = 20 000 chips), default buy-in, blinds, house notes
- **Host dashboard** — buy-ins, chip corrections, cash-outs, live P/L per player, bank reconciliation, seat assignment with a table map
- **Phone join** — players scan a QR code, enter their name, and follow the game live; they cannot touch game state
- **Live everywhere** — Supabase Realtime keeps the host, every phone, and the summary in sync
- **Final standings** — ranked P/L when the night is over
- **TV mode** — `/session/[id]/tv`: a chrome-free big-screen view with the clock, blinds, live stack rankings and a scannable join QR

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

Open the Supabase **SQL Editor** and run the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates the tables, locks down Row Level Security, and enables Realtime.

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
