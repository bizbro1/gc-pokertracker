"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  cardKey,
  compareScores,
  evaluate7,
  HandResult,
  PlayingCard,
  RANKS,
  rankLabel,
  RED_SUITS,
  SUIT_GLYPH,
  SUITS,
} from "@/lib/poker";
import { Button, Card, CardHeader } from "@/components/ui";

type Slot = { kind: "board"; i: number } | { kind: "hole"; p: number; i: number };

interface Seat {
  name: string;
  cards: (PlayingCard | null)[];
}

const emptySeat = (n: number): Seat => ({ name: `Player ${n}`, cards: [null, null] });

function CardFace({
  card,
  active,
  onClick,
  size = "md",
}: {
  card: PlayingCard | null;
  active?: boolean;
  onClick?: () => void;
  size?: "md" | "lg";
}) {
  const dims = size === "lg" ? "h-20 w-14 text-xl" : "h-16 w-11 text-lg";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border font-medium tabular-nums transition",
        dims,
        card
          ? cn("bg-cream border-black/20", RED_SUITS.has(card.suit) ? "text-[#a33b35]" : "text-ink")
          : "border-dashed border-brass-dim/50 text-cream-faint hover:border-brass",
        active && "ring-2 ring-brass"
      )}
    >
      {card ? (
        <>
          <span className="leading-none">{rankLabel(card.rank)}</span>
          <span className="leading-none">{SUIT_GLYPH[card.suit]}</span>
        </>
      ) : (
        <span className="text-2xl leading-none">+</span>
      )}
    </button>
  );
}

export default function ShowdownPage() {
  const [board, setBoard] = useState<(PlayingCard | null)[]>(Array(5).fill(null));
  const [seats, setSeats] = useState<Seat[]>([emptySeat(1), emptySeat(2)]);
  const [active, setActive] = useState<Slot | null>({ kind: "board", i: 0 });

  const used = new Set<string>();
  for (const c of board) if (c) used.add(cardKey(c));
  for (const s of seats) for (const c of s.cards) if (c) used.add(cardKey(c));

  function slotCard(slot: Slot): PlayingCard | null {
    return slot.kind === "board" ? board[slot.i]! : seats[slot.p]!.cards[slot.i]!;
  }

  function setSlot(slot: Slot, card: PlayingCard | null) {
    if (slot.kind === "board") {
      setBoard((b) => b.map((c, i) => (i === slot.i ? card : c)));
    } else {
      setSeats((ps) =>
        ps.map((s, p) =>
          p === slot.p ? { ...s, cards: s.cards.map((c, i) => (i === slot.i ? card : c)) } : s
        )
      );
    }
  }

  /** Next empty slot in dealing order: board first, then each player's holes. */
  function nextEmpty(after?: Slot): Slot | null {
    const all: Slot[] = [
      ...board.map((_, i) => ({ kind: "board", i }) as Slot),
      ...seats.flatMap((_, p) => [0, 1].map((i) => ({ kind: "hole", p, i }) as Slot)),
    ];
    const startIdx = after
      ? all.findIndex(
          (s) =>
            (s.kind === "board" && after.kind === "board" && s.i === after.i) ||
            (s.kind === "hole" && after.kind === "hole" && s.p === after.p && s.i === after.i)
        ) + 1
      : 0;
    for (let k = 0; k < all.length; k++) {
      const slot = all[(startIdx + k) % all.length]!;
      if (!slotCard(slot)) return slot;
    }
    return null;
  }

  function tapSlot(slot: Slot) {
    if (slotCard(slot)) {
      setSlot(slot, null);
      setActive(slot);
    } else {
      setActive(slot);
    }
  }

  function tapDeck(card: PlayingCard) {
    if (used.has(cardKey(card))) return;
    const target = active && !slotCard(active) ? active : nextEmpty();
    if (!target) return;
    setSlot(target, card);
    setActive(nextEmpty(target));
  }

  function reset() {
    setBoard(Array(5).fill(null));
    setSeats((ps) => ps.map((s) => ({ ...s, cards: [null, null] })));
    setActive({ kind: "board", i: 0 });
  }

  const boardFull = board.every(Boolean);
  const seatsReady = seats.every((s) => s.cards.every(Boolean));
  const complete = boardFull && seatsReady && seats.length >= 2;

  let results: (HandResult | null)[] = seats.map(() => null);
  let winners = new Set<number>();
  if (complete) {
    results = seats.map((s) => evaluate7([...(s.cards as PlayingCard[]), ...(board as PlayingCard[])]));
    let best: number[] | null = null;
    results.forEach((r) => {
      if (r && (!best || compareScores(r.score, best) > 0)) best = r.score;
    });
    winners = new Set(
      results.flatMap((r, i) => (r && best && compareScores(r.score, best) === 0 ? [i] : []))
    );
  }

  const isActive = (slot: Slot) =>
    !!active &&
    ((slot.kind === "board" && active.kind === "board" && slot.i === active.i) ||
      (slot.kind === "hole" &&
        active.kind === "hole" &&
        slot.p === active.p &&
        slot.i === active.i));

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cream-dim">Who takes the pot</p>
          <h1 className="mt-1 font-display text-4xl brass-text">Showdown</h1>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          Clear the felt
        </Button>
      </div>

      {/* Board */}
      <Card className="mt-6">
        <CardHeader title="The Board" subtitle="Community cards" />
        <div className="flex items-center gap-3 px-5 py-5">
          {board.map((c, i) => (
            <CardFace
              key={i}
              card={c}
              size="lg"
              active={isActive({ kind: "board", i })}
              onClick={() => tapSlot({ kind: "board", i })}
            />
          ))}
          <div className="ml-2 hidden text-[10px] uppercase tracking-[0.2em] text-cream-faint sm:block">
            <p>Flop · Flop · Flop</p>
            <p className="mt-1">Turn · River</p>
          </div>
        </div>
      </Card>

      {/* Players */}
      <Card className="mt-6">
        <CardHeader
          title="The Hands"
          subtitle="Two hole cards each"
          right={
            seats.length < 9 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSeats((ps) => [...ps, emptySeat(ps.length + 1)])}
              >
                + Add player
              </Button>
            ) : undefined
          }
        />
        <ul className="divide-y divide-white/5">
          {seats.map((seat, p) => {
            const r = results[p];
            const won = winners.has(p);
            return (
              <li
                key={p}
                className={cn("flex flex-wrap items-center gap-4 px-5 py-4", won && "bg-brass/10")}
              >
                <input
                  value={seat.name}
                  onChange={(e) =>
                    setSeats((ps) =>
                      ps.map((s, i) => (i === p ? { ...s, name: e.target.value } : s))
                    )
                  }
                  className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-cream outline-none transition focus:border-brass-dim/50"
                />
                <div className="flex gap-2">
                  {seat.cards.map((c, i) => (
                    <CardFace
                      key={i}
                      card={c}
                      active={isActive({ kind: "hole", p, i })}
                      onClick={() => tapSlot({ kind: "hole", p, i })}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  {r && (
                    <>
                      {won && (
                        <p className="text-[10px] uppercase tracking-[0.25em] text-brass-bright">
                          {winners.size > 1 ? "Splits the pot" : "Takes the pot"}
                        </p>
                      )}
                      <p className={cn("text-sm", won ? "text-brass-bright" : "text-cream-dim")}>
                        {r.name}
                      </p>
                    </>
                  )}
                </div>
                {seats.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSeats((ps) => ps.filter((_, i) => i !== p));
                      setActive(null);
                    }}
                    className="cursor-pointer text-cream-faint transition hover:text-loss"
                    aria-label={`Remove ${seat.name}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {!complete && (
          <p className="border-t hairline px-5 py-3 text-xs text-cream-dim">
            Tap a card below to deal it into the highlighted slot — board first, then each hand.
          </p>
        )}
      </Card>

      {/* Deck */}
      <Card className="mt-6">
        <CardHeader title="The Deck" subtitle="Tap to deal · tap a dealt card to take it back" />
        <div className="space-y-1.5 overflow-x-auto px-4 py-4">
          {SUITS.map((suit) => (
            <div key={suit} className="flex gap-1.5">
              {RANKS.map((rank) => {
                const taken = used.has(cardKey({ rank, suit }));
                return (
                  <button
                    key={rank}
                    type="button"
                    disabled={taken}
                    onClick={() => tapDeck({ rank, suit })}
                    className={cn(
                      "flex h-12 w-9 shrink-0 cursor-pointer flex-col items-center justify-center rounded border border-black/20 bg-cream text-sm font-medium tabular-nums transition hover:-translate-y-0.5",
                      RED_SUITS.has(suit) ? "text-[#a33b35]" : "text-ink",
                      taken && "cursor-default opacity-15 hover:translate-y-0"
                    )}
                  >
                    <span className="leading-none">{rankLabel(rank)}</span>
                    <span className="leading-none">{SUIT_GLYPH[suit]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
