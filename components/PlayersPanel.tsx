"use client";

import { useState, useTransition } from "react";
import { addBuyIn, adjustChips, assignSeat, cashOutPlayer, removePlayer } from "@/lib/actions";
import { PlayerStats } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { Player } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, Input, PnL, Select, StatusBadge } from "@/components/ui";

interface Row {
  player: Player;
  stats: PlayerStats;
}

interface Props {
  sessionId: string;
  currency: string;
  /** chips per 1 unit of cash */
  chipRatio: number;
  defaultBuyIn: number;
  rows: Row[];
  sessionEnded: boolean;
}

type Panel = "buyin" | "adjust" | "cashout" | null;

export function PlayersPanel({ sessionId, currency, chipRatio, defaultBuyIn, rows, sessionEnded }: Props) {
  const [open, setOpen] = useState<{ playerId: string; panel: Panel } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok && res.error) setError(res.error);
      else setOpen(null);
    });
  }

  function toggle(playerId: string, panel: Panel) {
    setError(null);
    setOpen((cur) =>
      cur && cur.playerId === playerId && cur.panel === panel ? null : { playerId, panel }
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="font-display text-2xl text-brass-dim">Empty chairs.</p>
        <p className="mt-2 text-sm text-cream-dim">
          Share the invite, or add a player by hand.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="border-b hairline bg-loss/10 px-5 py-2 text-xs text-loss">{error}</p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b hairline text-[10px] uppercase tracking-[0.18em] text-cream-dim">
            <th className="px-3 py-3 text-left w-14">Seat</th>
            <th className="px-3 py-3 text-left">Player</th>
            <th className="px-3 py-3 text-right">Buy-ins</th>
            <th className="px-3 py-3 text-right">Chips</th>
            <th className="px-3 py-3 text-right">Value</th>
            <th className="px-3 py-3 text-right">P / L</th>
            <th className="px-3 py-3 text-right w-44">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, stats }) => {
            const isOpen = open?.playerId === player.id ? open.panel : null;
            const cashedOut = player.status === "cashed_out";
            return (
              <PlayerRow
                key={player.id}
                player={player}
                stats={stats}
                currency={currency}
                chipRatio={chipRatio}
                defaultBuyIn={defaultBuyIn}
                openPanel={isOpen}
                cashedOut={cashedOut}
                sessionEnded={sessionEnded}
                pending={pending}
                onToggle={(panel) => toggle(player.id, panel)}
                onSeat={(seat) => run(() => assignSeat(sessionId, player.id, seat))}
                onBuyIn={(cash) => run(() => addBuyIn(sessionId, player.id, cash))}
                onAdjust={(delta) => run(() => adjustChips(sessionId, player.id, delta))}
                onCashOut={(chips) => run(() => cashOutPlayer(sessionId, player.id, chips))}
                onRemove={() => {
                  if (confirm(`Remove ${player.name} and all their transactions?`)) {
                    run(() => removePlayer(sessionId, player.id));
                  }
                }}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRow({
  player,
  stats,
  currency,
  chipRatio,
  defaultBuyIn,
  openPanel,
  cashedOut,
  sessionEnded,
  pending,
  onToggle,
  onSeat,
  onBuyIn,
  onAdjust,
  onCashOut,
  onRemove,
}: {
  player: Player;
  stats: PlayerStats;
  currency: string;
  chipRatio: number;
  defaultBuyIn: number;
  openPanel: Panel;
  cashedOut: boolean;
  sessionEnded: boolean;
  pending: boolean;
  onToggle: (panel: Panel) => void;
  onSeat: (seat: number | null) => void;
  onBuyIn: (cash: number) => void;
  onAdjust: (delta: number) => void;
  onCashOut: (chips: number) => void;
  onRemove: () => void;
}) {
  const [buyInAmount, setBuyInAmount] = useState(defaultBuyIn);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [cashOutChips, setCashOutChips] = useState(stats.currentChips);

  const disabled = sessionEnded || pending;

  return (
    <>
      <tr className={cn("border-b hairline/50 border-white/5", cashedOut && "opacity-50")}>
        <td className="px-3 py-3">
          <Select
            value={player.seat ?? ""}
            onChange={(e) => onSeat(e.target.value === "" ? null : Number(e.target.value))}
            disabled={disabled}
            className="h-8 w-14 px-2 text-xs"
            aria-label={`Seat for ${player.name}`}
          >
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </td>
        <td className="px-3 py-3">
          <span className="font-medium text-cream">{player.name}</span>
          {cashedOut && (
            <span className="ml-2 align-middle">
              <StatusBadge status="cashed_out" />
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          <span className="text-cream">{formatCash(stats.buyInCash, currency)}</span>
          <span className="ml-1 text-[10px] text-cream-faint">&times;{stats.buyInCount}</span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-cream">
          {formatChips(stats.currentChips)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-cream-dim">
          {formatCash(stats.currentValue, currency)}
        </td>
        <td className="px-3 py-3 text-right">
          <PnL value={stats.pnl} currency={currency} format={formatSignedCash} />
        </td>
        <td className="px-3 py-3">
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => onToggle("buyin")}>
              Buy-in
            </Button>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onToggle("adjust")}>
              Chips
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || cashedOut}
              onClick={() => {
                setCashOutChips(stats.currentChips);
                onToggle("cashout");
              }}
            >
              Cash out
            </Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={onRemove} aria-label={`Remove ${player.name}`}>
              &times;
            </Button>
          </div>
        </td>
      </tr>

      {openPanel && (
        <tr className="border-b hairline/50 border-white/5 bg-felt-deep/40">
          <td colSpan={7} className="px-5 py-4">
            {openPanel === "buyin" && (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                    Buy-in amount ({currency})
                  </p>
                  <Input
                    type="number"
                    min={1}
                    value={buyInAmount}
                    onChange={(e) => setBuyInAmount(Number(e.target.value))}
                    className="w-36"
                    autoFocus
                  />
                </div>
                <p className="pb-2.5 text-xs text-cream-dim tabular-nums">
                  = {formatChips(Math.round(buyInAmount * chipRatio))} chips
                </p>
                <Button size="md" disabled={pending || buyInAmount <= 0} onClick={() => onBuyIn(buyInAmount)}>
                  Confirm buy-in
                </Button>
              </div>
            )}

            {openPanel === "adjust" && (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                    Chip correction (+ / −)
                  </p>
                  <Input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    className="w-36"
                    autoFocus
                  />
                </div>
                <p className="pb-2.5 text-xs text-cream-dim tabular-nums">
                  {formatChips(stats.currentChips)} &rarr;{" "}
                  {formatChips(stats.currentChips + (adjustAmount || 0))} chips
                </p>
                <Button size="md" variant="outline" disabled={pending || !adjustAmount} onClick={() => onAdjust(adjustAmount)}>
                  Apply correction
                </Button>
              </div>
            )}

            {openPanel === "cashout" && (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                    Chips returned
                  </p>
                  <Input
                    type="number"
                    min={0}
                    value={cashOutChips}
                    onChange={(e) => setCashOutChips(Number(e.target.value))}
                    className="w-36"
                    autoFocus
                  />
                </div>
                <p className="pb-2.5 text-xs text-cream-dim tabular-nums">
                  pays {formatCash(cashOutChips / chipRatio, currency)}
                </p>
                <Button size="md" disabled={pending || cashOutChips < 0} onClick={() => onCashOut(cashOutChips)}>
                  Settle up
                </Button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
