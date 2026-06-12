"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelDuel, challengeDuel, respondToDuel } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { formatChips } from "@/lib/format";
import { Duel, Player } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Collapsible } from "@/components/Collapsible";
import { Button, Input, Select } from "@/components/ui";

/**
 * Poker Duel, from the player's phone: throw down a chip challenge, answer
 * one, and let the TV play the runout. Winner's chips move in the books.
 */
export function DuelPanel({
  sessionId,
  myId,
  players,
  duels,
  avatars,
}: {
  sessionId: string;
  myId: string;
  players: Player[];
  duels: Duel[];
  avatars: Record<string, string>;
}) {
  const opponents = players.filter((p) => p.id !== myId && p.status === "active");
  const [opponentId, setOpponentId] = useState("");
  const [amount, setAmount] = useState(500);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // Date.now() differs between server render and hydration — gate the
  // freshness-windowed result banner until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown";

  const open = duels.find(
    (d) => d.status === "pending" && (d.challenger_id === myId || d.opponent_id === myId)
  );
  // The TV runout takes ~32s — phones don't learn the result before the
  // river hits the screen
  const REVEAL_MS = 35_000;
  const mySettled = mounted
    ? [...duels]
        .filter(
          (d) =>
            d.status === "settled" &&
            d.settled_at &&
            (d.challenger_id === myId || d.opponent_id === myId) &&
            Date.now() - new Date(d.settled_at).getTime() < 3 * 60_000
        )
        .sort((a, b) => (b.settled_at ?? "").localeCompare(a.settled_at ?? ""))
        .at(0)
    : undefined;
  const settledAge = mySettled?.settled_at
    ? Date.now() - new Date(mySettled.settled_at).getTime()
    : null;
  const running = mySettled && settledAge !== null && settledAge < REVEAL_MS;
  const lastSettled = mySettled && settledAge !== null && settledAge >= REVEAL_MS ? mySettled : undefined;

  // Flip from "watch the TV" to the result (and unhide the chip transfer in
  // the stats) the moment the runout window passes
  const router = useRouter();
  useEffect(() => {
    if (!running || settledAge === null) return;
    const t = setTimeout(() => router.refresh(), REVEAL_MS - settledAge + 500);
    return () => clearTimeout(t);
  }, [running, settledAge, router]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
    });
  }

  return (
    // Remounts (key) when a challenge or runout appears, so it pops open
    <Collapsible
      key={open ? `open-${open.id}` : running ? "running" : "idle"}
      title="Poker Duel"
      subtitle="All-in runout on the big screen"
      defaultOpen={!!open || !!running}
      className="mt-6"
    >
      <div className="border-t hairline px-5 py-4">
        {open ? (
          open.opponent_id === myId ? (
            <div className="text-center">
              <div className="mb-3 flex items-center justify-center gap-3">
                <Avatar
                  name={nameOf(open.challenger_id)}
                  url={avatars[open.challenger_id]}
                  className="h-12 w-12"
                />
                <span className="font-display text-2xl text-brass">⚔</span>
                <Avatar name={nameOf(open.opponent_id)} url={avatars[open.opponent_id]} className="h-12 w-12" />
              </div>
              <p className="text-sm text-cream">
                <span className="font-medium">{nameOf(open.challenger_id)}</span> challenges you
              </p>
              <p className="mt-1 font-display text-3xl tabular-nums text-brass-bright">
                {formatChips(Number(open.chip_amount))} chips
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Button
                  size="md"
                  disabled={pending}
                  onClick={() => run(() => respondToDuel(sessionId, open.id, true))}
                >
                  Accept the duel
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  disabled={pending}
                  onClick={() => run(() => respondToDuel(sessionId, open.id, false))}
                >
                  Decline
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-cream-dim">
                Gauntlet thrown — waiting for{" "}
                <span className="text-cream">{nameOf(open.opponent_id)}</span> to answer your{" "}
                {formatChips(Number(open.chip_amount))}-chip challenge…
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                disabled={pending}
                onClick={() => run(() => cancelDuel(sessionId, open.id))}
              >
                Withdraw
              </Button>
            </div>
          )
        ) : running ? (
          <p className="py-4 text-center text-sm text-brass animate-pulse">
            ⚔ The cards are in the air — eyes on the TV
          </p>
        ) : (
          <>
            {lastSettled && (
              <p
                className={cn(
                  "mb-4 rounded-md border px-3 py-2 text-center text-sm",
                  lastSettled.winner_id === myId
                    ? "border-win/40 bg-win/10 text-win"
                    : lastSettled.winner_id === null
                      ? "border-cream-dim/30 text-cream-dim"
                      : "border-loss/40 bg-loss/10 text-loss"
                )}
              >
                {lastSettled.winner_id === myId
                  ? `You won the duel — ${formatChips(Number(lastSettled.chip_amount))} chips!`
                  : lastSettled.winner_id === null
                    ? "The duel was chopped — no chips moved"
                    : `You lost the duel — ${formatChips(Number(lastSettled.chip_amount))} chips`}
              </p>
            )}
            {opponents.length === 0 ? (
              <p className="text-center text-sm text-cream-dim">Nobody to duel yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                      Opponent
                    </p>
                    <Select value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
                      <option value="">Pick a victim…</option>
                      {opponents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                      Chips at stake
                    </p>
                    <Input
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={pending || !opponentId}
                  onClick={() => run(() => challengeDuel(sessionId, opponentId, amount))}
                >
                  ⚔ Throw the gauntlet
                </Button>
                <p className="text-center text-[10px] text-cream-faint">
                  Two cards each, five on the board, best hand takes the chips. Watch the TV.
                </p>
              </div>
            )}
          </>
        )}
        {error && <p className="mt-3 text-center text-xs text-loss">{error}</p>}
      </div>
    </Collapsible>
  );
}
