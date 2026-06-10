"use client";

import { useState, useTransition } from "react";
import { assignSeat } from "@/lib/actions";
import { Player } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

const SEATS = 10;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function SeatMap({
  sessionId,
  players,
  interactive,
}: {
  sessionId: string;
  players: Player[];
  interactive: boolean;
}) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bySeat = new Map<number, Player>();
  for (const p of players) if (p.seat) bySeat.set(p.seat, p);

  const occupant = selectedSeat ? bySeat.get(selectedSeat) : undefined;

  function assign(playerId: string | null) {
    if (!selectedSeat) return;
    setError(null);
    startTransition(async () => {
      const res = await assignSeat(
        sessionId,
        playerId ?? occupant!.id,
        playerId ? selectedSeat : null
      );
      if (!res.ok && res.error) setError(res.error);
      else setSelectedSeat(null);
    });
  }

  return (
    <div>
      <div className="relative mx-auto aspect-[16/11] w-full max-w-md select-none">
        {/* Table */}
        <div className="absolute inset-[12%] rounded-[50%] border-[6px] border-leather-light shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-0 rounded-[50%] felt-panel border border-felt-edge/70" />
          <div className="absolute inset-[12%] rounded-[50%] border border-brass-dim/25" />
          <p className="absolute inset-0 flex items-center justify-center font-display text-base tracking-[0.3em] text-brass-dim/50 uppercase">
            GC
          </p>
        </div>

        {/* Seats */}
        {Array.from({ length: SEATS }, (_, i) => {
          const seatNo = i + 1;
          const angle = Math.PI / 2 + (i / SEATS) * Math.PI * 2; // seat 1 at the bottom, clockwise
          const x = 50 + 44 * Math.cos(angle);
          const y = 50 + 42 * Math.sin(angle);
          const seated = bySeat.get(seatNo);
          const isSelected = selectedSeat === seatNo;
          return (
            <div
              key={seatNo}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <button
                type="button"
                disabled={!interactive || pending}
                onClick={() => {
                  setError(null);
                  setSelectedSeat((cur) => (cur === seatNo ? null : seatNo));
                }}
                className={cn(
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-[11px] tabular-nums transition",
                  interactive && "cursor-pointer hover:scale-110",
                  isSelected && "ring-2 ring-brass-bright ring-offset-2 ring-offset-ink",
                  seated
                    ? seated.status === "cashed_out"
                      ? "border-cream-faint/50 bg-coal text-cream-faint"
                      : "border-brass bg-gradient-to-b from-leather-light to-leather text-brass-bright font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                    : "border-white/10 bg-ink/60 text-cream-faint"
                )}
                title={seated ? `${seatNo}: ${seated.name}` : `Seat ${seatNo}`}
              >
                {seated ? initials(seated.name) : seatNo}
              </button>
              {seated && (
                <p className="mt-1 max-w-[64px] truncate text-[9px] uppercase tracking-wider text-cream-dim">
                  {seated.name}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Assignment panel */}
      {interactive && selectedSeat && (
        <div className="mt-3 rounded-md border hairline bg-ink/50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">
            Seat {selectedSeat}
            {occupant ? ` — ${occupant.name}` : " — empty"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {players
              .filter((p) => p.seat !== selectedSeat)
              .map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => assign(p.id)}
                >
                  {p.name}
                  {p.seat ? ` (${p.seat})` : ""}
                </Button>
              ))}
            {occupant && (
              <Button size="sm" variant="danger" disabled={pending} onClick={() => assign(null)}>
                Clear seat
              </Button>
            )}
            {players.length === 0 && (
              <p className="text-xs text-cream-faint">No players at the table yet.</p>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-loss">{error}</p>}
        </div>
      )}

      {interactive && !selectedSeat && (
        <p className="mt-3 text-center text-[11px] text-cream-faint">
          Tap a seat to assign a player.
        </p>
      )}
    </div>
  );
}
