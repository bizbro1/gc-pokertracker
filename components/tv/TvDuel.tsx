"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import { duelEquities } from "@/lib/duelEquity";
import { evaluate7, PlayingCard, rankLabel, RED_SUITS, SUIT_GLYPH } from "@/lib/poker";
import { formatChips } from "@/lib/format";
import { Duel, Player } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { playCardFlip, playDuelWin, playEventSound } from "./sounds";

/** Seconds into the show when board card i flips — one at a time. */
const REVEAL_AT = [5, 9, 13, 17, 21];

const STAGE_LABEL = [
  "Pre-flop",
  "First card",
  "Second card",
  "The Flop",
  "The Turn",
  "The River",
];

/** Red at low equity, green at high — hue 0 (red) → 120 (green). */
function pctColor(pct: number): string {
  return `hsl(${Math.round(pct * 1.2)}, 52%, 60%)`;
}

function BigCard({ card, faceDown }: { card?: PlayingCard; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-brass-dim/40 bg-gradient-to-b from-leather-light to-leather shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
        <span className="font-display text-2xl text-brass-dim/60">♠</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-28 w-20 flex-col items-center justify-center rounded-lg border border-black/20 bg-cream shadow-[0_6px_20px_rgba(0,0,0,0.5)]",
        RED_SUITS.has(card.suit) ? "text-[#a33b35]" : "text-ink"
      )}
    >
      <span className="text-3xl font-semibold leading-none tabular-nums">
        {rankLabel(card.rank)}
      </span>
      <span className="text-3xl leading-none">{SUIT_GLYPH[card.suit]}</span>
    </div>
  );
}

/**
 * The all-in runout: holes up, then the board one card at a time with a
 * fresh equity number after every card, winner crowned at the end. Pure
 * display — the result was decided server-side when the duel was accepted.
 */
export function TvDuel({
  duel,
  challenger,
  opponent,
  avatars,
  startedAt,
  now,
  muted,
}: {
  duel: Duel;
  challenger: Player;
  opponent: Player;
  avatars: Record<string, string>;
  startedAt: number;
  now: number;
  muted: boolean;
}) {
  const deal = duel.deal!;
  const t = (now - startedAt) / 1000;
  /** number of board cards revealed so far, 0..5 */
  const stage = REVEAL_AT.filter((s) => t >= s).length;
  const decided = stage === 5;

  const equities = useMemo(() => duelEquities(deal), [deal]);

  const challengerWins = duel.winner_id === challenger.id;
  const chop = duel.winner_id === null;
  const eq = decided
    ? chop
      ? { a: 50, b: 50 }
      : challengerWins
        ? { a: 100, b: 0 }
        : { a: 0, b: 100 }
    : equities[stage]!;

  const hands = useMemo(
    () => ({
      a: evaluate7([...deal.holes[0], ...deal.board]).name,
      b: evaluate7([...deal.holes[1], ...deal.board]).name,
    }),
    [deal]
  );

  // Stage soundtrack + winner announcement, once per stage
  const prevStage = useRef(-1);
  useEffect(() => {
    if (stage === prevStage.current) return;
    const first = prevStage.current === -1;
    prevStage.current = stage;
    if (muted) return;
    if (first && stage === 0) {
      playEventSound("duel_challenge");
      return;
    }
    playCardFlip(1);
    if (stage === 5) {
      setTimeout(() => playDuelWin(), 600);
      if ("speechSynthesis" in window) {
        try {
          const text = chop
            ? "The duel is chopped — the pot is split"
            : `${challengerWins ? challenger.name : opponent.name} wins the duel and takes ${formatChips(Number(duel.chip_amount))} chips`;
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 0.95;
          setTimeout(() => window.speechSynthesis.speak(u), 900);
        } catch {
          /* speech unavailable */
        }
      }
    }
  }, [stage, muted, chop, challengerWins, challenger.name, opponent.name, duel.chip_amount]);

  function Fighter({
    player,
    hole,
    pct,
    winner,
    hand,
  }: {
    player: Player;
    hole: PlayingCard[];
    pct: number;
    winner: boolean;
    hand: string;
  }) {
    return (
      <div
        className={cn(
          "flex w-72 flex-col items-center gap-4 rounded-2xl border px-6 py-6 transition-all duration-700",
          decided && winner
            ? "border-brass bg-brass/10 shadow-[0_0_60px_rgba(201,164,92,0.25)]"
            : decided && !chop
              ? "border-white/5 opacity-50"
              : "border-white/10"
        )}
      >
        <Avatar name={player.name} url={avatars[player.id]} className="h-20 w-20 text-2xl" />
        <p className="max-w-full truncate font-display text-3xl text-cream">{player.name}</p>
        <div className="flex gap-3">
          {hole.map((c, i) => (
            <BigCard key={i} card={c} />
          ))}
        </div>
        <p
          className="font-display text-6xl tabular-nums transition-colors duration-700"
          style={{ color: pctColor(pct) }}
        >
          {pct}%
        </p>
        {decided && (
          <p className={cn("text-center text-sm", winner ? "text-brass-bright" : "text-cream-dim")}>
            {hand}
          </p>
        )}
        {decided && winner && !chop && (
          <p className="text-xs uppercase tracking-[0.3em] text-brass-bright">Takes the pot</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.5em] text-brass">⚔ Poker Duel ⚔</p>
        <p className="mt-2 font-display text-4xl tabular-nums text-cream">
          {formatChips(Number(duel.chip_amount))} chips on the line
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-cream-dim">
          {decided && chop ? "Chopped — split pot" : STAGE_LABEL[stage]}
        </p>
      </div>

      <div className="flex items-center justify-center gap-12">
        <Fighter
          player={challenger}
          hole={deal.holes[0]}
          pct={eq.a}
          winner={challengerWins}
          hand={hands.a}
        />

        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-3">
            {deal.board.map((c, i) => (
              <BigCard key={i} card={c} faceDown={i >= stage} />
            ))}
          </div>
          {/* Equity bar — challenger's share, red to green with their fortunes */}
          <div className="h-3 w-[28rem] max-w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${eq.a}%`, backgroundColor: pctColor(eq.a) }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cream-faint">
            {challenger.name} {eq.a}% · {opponent.name} {eq.b}%
          </p>
        </div>

        <Fighter
          player={opponent}
          hole={deal.holes[1]}
          pct={eq.b}
          winner={!challengerWins && !chop}
          hand={hands.b}
        />
      </div>
    </div>
  );
}
