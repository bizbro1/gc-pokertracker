"use client";

import { useMemo, useTransition } from "react";
import { deleteTransaction } from "@/lib/actions";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  deriveTvEvents,
  EVENT_BG_TONES,
  EVENT_ICONS,
  EVENT_TONES,
  TvEvent,
  TvEventKind,
} from "@/lib/tvEvents";
import { Duel, Player, Session, Tx } from "@/lib/types";

function timeOf(at: string): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Events whose id IS a transaction id — these can be undone by deleting the row.
// Derived events (red/black/leader/join) disappear with their source.
const UNDOABLE: ReadonlySet<TvEventKind> = new Set([
  "buy_in",
  "rebuy",
  "stack",
  "bust",
  "double",
  "half",
  "cash_out",
]);

/** Running feed of everything that happens at the table, newest first. */
export function ActivityLog({
  session,
  players,
  txs,
  duels = [],
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
  duels?: Duel[];
}) {
  const [pending, startTransition] = useTransition();
  const events = useMemo(
    () => deriveTvEvents(session, players, txs, duels).reverse(),
    [session, players, txs, duels]
  );

  // Duel transfers are paired (+/−) — undoing one side would corrupt the books
  const duelTxIds = useMemo(
    () => new Set(txs.filter((t) => t.duel_id).map((t) => t.id)),
    [txs]
  );

  function undo(e: TvEvent) {
    if (!confirm(`Undo this entry?\n\n"${e.text}"`)) return;
    startTransition(async () => {
      await deleteTransaction(session.id, e.id);
    });
  }

  return (
    <Card>
      <CardHeader title="Table Talk" subtitle="Everything that happens at the table" />
      <ol className="max-h-[28rem] divide-y divide-white/5 overflow-y-auto">
        {events.map((e) => (
          <li
            key={e.id}
            className={cn("group flex items-center gap-3 px-5 py-2.5", EVENT_BG_TONES[e.kind])}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px]",
                EVENT_TONES[e.kind]
              )}
            >
              {EVENT_ICONS[e.kind]}
            </span>
            <span className="min-w-0 flex-1 text-sm text-cream">{e.text}</span>
            <span className="text-xs tabular-nums text-cream-faint" suppressHydrationWarning>
              {timeOf(e.at)}
            </span>
            {UNDOABLE.has(e.kind) && !duelTxIds.has(e.id) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => undo(e)}
                title="Undo this entry"
                aria-label="Undo this entry"
                className="cursor-pointer text-cream-faint opacity-0 transition hover:text-loss group-hover:opacity-100 disabled:opacity-40"
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {events.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-cream-dim">
            A quiet table so far.
          </li>
        )}
      </ol>
    </Card>
  );
}
