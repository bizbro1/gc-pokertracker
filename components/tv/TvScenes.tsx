"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Avatar } from "@/components/Avatar";
import { PnL } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BlindPlan, levelAt } from "@/lib/blindSchedule";
import { playerStats, PlayerStats, sessionTotals } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { EVENT_BG_TONES, EVENT_ICONS, EVENT_TONES, TvEvent } from "@/lib/tvEvents";
import { Player, Session, Tx } from "@/lib/types";

/** Per-player line/bar colors, assigned by join order. */
export const PLAYER_COLORS = [
  "#e8cd92", "#82c193", "#d1736a", "#7da7d9", "#b08bc9",
  "#d9a87d", "#8fc9c0", "#c9c97d", "#cf8fb0", "#a9a9a9",
];

export interface Ranked {
  player: Player;
  stats: PlayerStats;
}

export function buildLeaderboard(session: Session, players: Player[], txs: Tx[]): Ranked[] {
  const ended = session.status === "ended";
  return players
    .map((p) => ({ player: p, stats: playerStats(session, p, txs) }))
    .sort((a, b) => {
      if (ended) return b.stats.pnl - a.stats.pnl;
      const aOut = a.player.status === "cashed_out" ? 1 : 0;
      const bOut = b.player.status === "cashed_out" ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return aOut ? b.stats.pnl - a.stats.pnl : b.stats.currentChips - a.stats.currentChips;
    });
}

function SceneTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="font-display text-5xl brass-text">{title}</h2>
      {subtitle && (
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-cream-dim">{subtitle}</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- chip race */

export function TvChipRace({
  session,
  players,
  txs,
  avatars,
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
  avatars: Record<string, string>;
}) {
  const ranked = buildLeaderboard(session, players, txs).filter(
    (r) => r.player.status === "active"
  );
  const max = Math.max(1, ...ranked.map((r) => r.stats.currentChips));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SceneTitle title="The Chip Race" subtitle="Who rules the felt" />
      <div className="space-y-5">
        {ranked.map(({ player, stats }, i) => (
          <div key={player.id} className="flex items-center gap-5">
            <Avatar
              name={player.name}
              url={avatars[player.id]}
              className="h-14 w-14 shrink-0 text-lg"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-4">
                <span className="truncate text-2xl text-cream">{player.name}</span>
                <span className="font-display text-3xl tabular-nums text-brass-bright">
                  {formatChips(stats.currentChips)}
                </span>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.max(2, (stats.currentChips / max) * 100)}%`,
                    background: `linear-gradient(90deg, ${PLAYER_COLORS[i % PLAYER_COLORS.length]}55, ${PLAYER_COLORS[i % PLAYER_COLORS.length]})`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        {ranked.length === 0 && (
          <p className="py-16 text-center text-xl text-cream-dim">Nobody on the felt yet.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- progression */

interface SeriesPoint {
  t: number;
  chips: number;
}

function buildSeries(players: Player[], txs: Tx[], now: number) {
  const sorted = [...txs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const series = new Map<string, SeriesPoint[]>();
  const chips = new Map<string, number>();

  for (const t of sorted) {
    const cur = chips.get(t.player_id) ?? 0;
    const next =
      t.type === "buy_in"
        ? cur + Number(t.chip_amount)
        : t.type === "adjustment"
          ? cur + Number(t.chip_amount)
          : cur - Number(t.chip_amount);
    chips.set(t.player_id, next);
    const pts = series.get(t.player_id) ?? [];
    pts.push({ t: new Date(t.created_at).getTime(), chips: next });
    series.set(t.player_id, pts);
  }

  // Extend every live line to "now" so the chart reads to the right edge
  for (const p of players) {
    const pts = series.get(p.id);
    if (pts && pts.length > 0 && p.status === "active") {
      pts.push({ t: now, chips: pts[pts.length - 1]!.chips });
    }
  }
  return series;
}

export function TvProgression({
  session,
  players,
  txs,
  now,
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
  now: number;
}) {
  void session;
  const series = buildSeries(players, txs, now);
  const all = [...series.values()].flat();
  if (all.length < 2) {
    return <p className="py-24 text-center text-xl text-cream-dim">Not enough history yet.</p>;
  }

  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(now, ...all.map((p) => p.t));
  const yMax = Math.max(...all.map((p) => p.chips)) * 1.08 || 1;

  const W = 1100;
  const H = 460;
  const PAD = { l: 90, r: 200, t: 16, b: 44 };
  const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (c: number) => H - PAD.b - (c / yMax) * (H - PAD.t - PAD.b);

  // Step path: hold chips flat until the next data point
  const path = (pts: SeriesPoint[]) =>
    pts
      .map((p, i) => {
        if (i === 0) return `M ${x(p.t)} ${y(p.chips)}`;
        return `L ${x(p.t)} ${y(pts[i - 1]!.chips)} L ${x(p.t)} ${y(p.chips)}`;
      })
      .join(" ");

  const yTicks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const hours = Math.max(1, Math.ceil((t1 - t0) / 3_600_000));
  const xTicks = Array.from({ length: hours + 1 }, (_, i) => t0 + i * 3_600_000).filter(
    (t) => t <= t1
  );

  const lines = players
    .map((p, i) => ({ player: p, pts: series.get(p.id) ?? [], color: PLAYER_COLORS[i % PLAYER_COLORS.length]! }))
    .filter((l) => l.pts.length > 1);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <SceneTitle title="Stack Progression" subtitle="The night so far" />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)}
              stroke="rgba(236,227,208,0.08)" strokeWidth="1"
            />
            <text x={PAD.l - 12} y={y(v) + 5} textAnchor="end" fontSize="16"
              fill="var(--color-cream-dim)" className="tabular-nums">
              {formatChips(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={t} x={x(t)} y={H - 14} textAnchor="middle" fontSize="15"
            fill="var(--color-cream-faint)">
            {i === 0 ? "start" : `+${i}h`}
          </text>
        ))}
        {lines.map(({ player, pts, color }) => (
          <g key={player.id}>
            <path d={path(pts)} fill="none" stroke={color} strokeWidth="3.5"
              strokeLinejoin="round" opacity={player.status === "active" ? 1 : 0.35} />
            <circle cx={x(pts[pts.length - 1]!.t)} cy={y(pts[pts.length - 1]!.chips)} r="6" fill={color} />
            <text x={x(pts[pts.length - 1]!.t) + 14} y={y(pts[pts.length - 1]!.chips) + 6}
              fontSize="19" fill={color}>
              {player.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- p/l board */

export function TvPLBoard({
  session,
  players,
  txs,
  avatars,
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
  avatars: Record<string, string>;
}) {
  const ranked = players
    .map((p) => ({ player: p, stats: playerStats(session, p, txs) }))
    .sort((a, b) => b.stats.pnl - a.stats.pnl);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <SceneTitle title="Up & Down" subtitle="Profit and loss, live" />
      <div className="space-y-3">
        {ranked.map(({ player, stats }) => {
          const frac =
            Math.max(...ranked.map((r) => Math.abs(r.stats.pnl)), 1) || 1;
          return (
            <div key={player.id} className="flex items-center gap-5">
              <Avatar name={player.name} url={avatars[player.id]} className="h-12 w-12 shrink-0" />
              <span className="w-56 truncate text-2xl text-cream">{player.name}</span>
              <div className="relative h-8 flex-1">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                <div
                  className={cn(
                    "absolute inset-y-1 rounded transition-all duration-1000",
                    stats.pnl >= 0 ? "left-1/2 bg-win/70" : "right-1/2 bg-loss/70"
                  )}
                  style={{ width: `${(Math.abs(stats.pnl) / frac) * 48}%` }}
                />
              </div>
              <PnL
                value={stats.pnl}
                currency={session.currency_code}
                format={formatSignedCash}
                className="w-44 text-right font-display text-3xl"
              />
            </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="py-16 text-center text-xl text-cream-dim">Nobody at the table yet.</p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- stats */

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border hairline bg-gradient-to-b from-espresso to-coal px-8 py-10 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      <p className="text-xs uppercase tracking-[0.3em] text-cream-dim">{label}</p>
      <p className="mt-4 font-display text-5xl tabular-nums text-brass-bright">{value}</p>
      {detail && <p className="mt-2 text-base text-cream-dim">{detail}</p>}
    </div>
  );
}

export function TvStats({
  session,
  players,
  txs,
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
}) {
  const ranked = buildLeaderboard(session, players, txs);
  const totals = sessionTotals(session, players, txs);
  const live = ranked.filter((r) => r.player.status === "active");
  const leader = live[0] ?? ranked[0];
  const rebuyKing = [...ranked].sort((a, b) => b.stats.buyInCount - a.stats.buyInCount)[0];
  const avgStack = live.length
    ? Math.round(live.reduce((s, r) => s + r.stats.currentChips, 0) / live.length)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <SceneTitle title="Tonight's Stats" />
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <StatCard
          label="Chip leader"
          value={leader ? leader.player.name : "—"}
          detail={leader ? `${formatChips(leader.stats.currentChips)} chips` : undefined}
        />
        <StatCard label="On the felt" value={formatCash(totals.cashIn, session.currency_code)} />
        <StatCard
          label="Players left"
          value={`${live.length}`}
          detail={`of ${players.length} seated`}
        />
        <StatCard
          label="Rebuy king"
          value={rebuyKing && rebuyKing.stats.buyInCount > 1 ? rebuyKing.player.name : "—"}
          detail={
            rebuyKing && rebuyKing.stats.buyInCount > 1
              ? `${rebuyKing.stats.buyInCount} buy-ins`
              : "no rebuys yet"
          }
        />
        <StatCard label="Average stack" value={formatChips(avgStack)} />
        <StatCard label="Chips in play" value={formatChips(totals.chipsInPlay)} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- activity */

export function TvActivity({ events }: { events: TvEvent[] }) {
  const recent = [...events].reverse().slice(0, 12);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <SceneTitle title="Live Activity" subtitle="Around the table" />
      <ol className="space-y-1">
        {recent.map((e) => (
          <li
            key={e.id}
            className={cn(
              "flex items-center gap-5 rounded-lg px-4 py-3",
              EVENT_BG_TONES[e.kind]
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg",
                EVENT_TONES[e.kind]
              )}
            >
              {EVENT_ICONS[e.kind]}
            </span>
            <span className="flex-1 text-xl text-cream">{e.text}</span>
            <span className="text-base tabular-nums text-cream-faint">
              {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
        {recent.length === 0 && (
          <p className="py-16 text-center text-xl text-cream-dim">A quiet night so far.</p>
        )}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------------- schedule */

export function TvSchedule({ plan, elapsedMin }: { plan: BlindPlan; elapsedMin: number }) {
  const current = levelAt(plan, elapsedMin);
  // Window of up to 9 levels centered on the current one
  const idx = Math.max(0, plan.levels.findIndex((l) => l.level === current?.level));
  const start = Math.max(0, Math.min(idx - 3, plan.levels.length - 9));
  const visible = plan.levels.slice(start, start + 9);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SceneTitle title="Blind Schedule" subtitle={`${plan.levelMin} minute levels`} />
      <table className="w-full text-xl tabular-nums">
        <thead>
          <tr className="text-sm uppercase tracking-[0.25em] text-cream-dim">
            <th className="px-4 py-2 text-left font-normal">Level</th>
            <th className="px-4 py-2 text-left font-normal">From</th>
            <th className="px-4 py-2 text-right font-normal">Blinds</th>
            <th className="w-44 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {visible.map((l) => {
            const here = l.level === current?.level;
            return (
              <tr
                key={l.level}
                className={cn(
                  "border-t border-white/5",
                  here && "bg-brass/10",
                  !here && l.startsAtMin < (current?.startsAtMin ?? 0) && "opacity-40"
                )}
              >
                <td className="px-4 py-3 text-cream-dim">L{l.level}</td>
                <td className="px-4 py-3 text-cream-dim">
                  {Math.floor(l.startsAtMin / 60)}:{String(l.startsAtMin % 60).padStart(2, "0")}
                </td>
                <td className={cn("px-4 py-3 text-right", here ? "text-brass-bright" : "text-cream")}>
                  {formatChips(l.smallBlind)} / {formatChips(l.bigBlind)}
                </td>
                <td className="px-4 py-3 text-left text-base uppercase tracking-[0.2em] text-brass">
                  {here && "● You are here"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------- join */

export function TvJoin({ joinCode }: { joinCode: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/join/${joinCode}`);
  }, [joinCode]);

  return (
    <div className="flex flex-col items-center">
      <SceneTitle title="Take a Seat" subtitle="Scan to join from your phone" />
      <div className="rounded-xl border border-brass-dim/40 bg-cream p-6 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
        {url ? (
          <QRCodeSVG value={url} size={340} bgColor="#ece3d0" fgColor="#0b0907" />
        ) : (
          <div className="h-[340px] w-[340px]" />
        )}
      </div>
      <p className="mt-8 font-display text-7xl tracking-[0.35em] text-brass">{joinCode}</p>
      <p className="mt-3 text-lg text-cream-dim">{url.replace(/^https?:\/\//, "")}</p>
    </div>
  );
}

/* ------------------------------------------------------------ hand rankings */

const HANDS: { name: string; cards: string; note: string }[] = [
  { name: "Royal Flush", cards: "A♠ K♠ Q♠ J♠ 10♠", note: "The nuts" },
  { name: "Straight Flush", cards: "9♥ 8♥ 7♥ 6♥ 5♥", note: "Five in a row, one suit" },
  { name: "Four of a Kind", cards: "Q♣ Q♦ Q♥ Q♠ 4♦", note: "Quads" },
  { name: "Full House", cards: "J♣ J♦ J♠ 8♥ 8♣", note: "Trips + a pair" },
  { name: "Flush", cards: "A♦ J♦ 8♦ 6♦ 2♦", note: "Five of one suit" },
  { name: "Straight", cards: "10♣ 9♦ 8♠ 7♥ 6♣", note: "Five in a row" },
  { name: "Three of a Kind", cards: "7♠ 7♥ 7♦ K♣ 2♠", note: "Trips" },
  { name: "Two Pair", cards: "A♣ A♥ 9♠ 9♦ 5♣", note: "" },
  { name: "One Pair", cards: "10♥ 10♦ A♠ 7♣ 3♥", note: "" },
  { name: "High Card", cards: "A♠ Q♦ 9♣ 6♥ 3♠", note: "Best of nothing" },
];

function CardRun({ cards }: { cards: string }) {
  return (
    <span className="flex gap-1.5">
      {cards.split(" ").map((c, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex min-w-11 items-center justify-center rounded-md border border-black/20 bg-cream px-1.5 py-1 font-medium tabular-nums",
            /[♥♦]/.test(c) ? "text-[#a33b35]" : "text-ink"
          )}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

export function TvHandRankings() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <SceneTitle title="Hand Rankings" subtitle="Strongest to weakest" />
      <ol className="space-y-2">
        {HANDS.map((h, i) => (
          <li key={h.name} className="flex items-center gap-6 border-b border-white/5 pb-2 last:border-0">
            <span className="w-8 text-right font-display text-2xl text-cream-faint">{i + 1}</span>
            <span className="w-56 text-xl text-cream">{h.name}</span>
            <CardRun cards={h.cards} />
            <span className="flex-1 text-right text-base text-cream-dim">{h.note}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
