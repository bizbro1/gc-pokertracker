import { Duel, Player, Session, Tx } from "./types";
import { chipsToCash } from "./derive";
import { formatCash, formatChips } from "./format";

export type TvEventKind =
  | "join"
  | "buy_in"
  | "rebuy"
  | "stack"
  | "bust"
  | "cash_out"
  | "double"
  | "half"
  | "red"
  | "black"
  | "leader"
  | "duel_challenge"
  | "duel_declined"
  | "duel";

export interface TvEvent {
  id: string;
  at: string;
  kind: TvEventKind;
  playerName: string;
  /** full sentence — used for the log, toasts and the voice clip */
  text: string;
}

/** Display glyph per event kind, shared by the dashboard log and TV scenes. */
export const EVENT_ICONS: Record<TvEventKind, string> = {
  join: "♠",
  buy_in: "♦",
  rebuy: "♦",
  stack: "♣",
  bust: "✕",
  cash_out: "♥",
  double: "×2",
  half: "½",
  red: "▼",
  black: "▲",
  leader: "♛",
  duel_challenge: "⚔",
  duel_declined: "⚔",
  duel: "⚔",
};

/** Tailwind tone classes per event kind (border + text on the icon chip). */
export const EVENT_TONES: Record<TvEventKind, string> = {
  join: "border-brass-dim/50 text-brass",
  buy_in: "border-brass-dim/50 text-brass",
  rebuy: "border-brass-dim/50 text-brass",
  stack: "border-cream-dim/40 text-cream-dim",
  bust: "border-loss/50 text-loss",
  cash_out: "border-win/50 text-win",
  double: "border-win/50 text-win",
  half: "border-loss/50 text-loss",
  red: "border-loss/50 text-loss",
  black: "border-win/50 text-win",
  leader: "border-brass/60 text-brass-bright",
  duel_challenge: "border-brass/60 text-brass-bright",
  duel_declined: "border-cream-dim/40 text-cream-dim",
  duel: "border-brass/60 text-brass-bright",
};

/** Row background per event kind — wins glow green, trouble glows red, money is brass. */
export const EVENT_BG_TONES: Record<TvEventKind, string> = {
  join: "bg-cream/5",
  buy_in: "bg-brass/10",
  rebuy: "bg-brass/10",
  stack: "",
  bust: "bg-loss/15",
  cash_out: "bg-win/10",
  double: "bg-win/10",
  half: "bg-loss/10",
  red: "bg-loss/10",
  black: "bg-win/10",
  leader: "bg-brass/15",
  duel_challenge: "bg-brass/15",
  duel_declined: "bg-cream/5",
  duel: "bg-brass/15",
};

interface PlayerTally {
  chips: number;
  boughtChips: number;
  buyInCash: number;
  cashOutCash: number;
  buyIns: number;
}

/**
 * Replays players and transactions chronologically into a feed of
 * human-readable session events. Besides the raw actions (joins, buy-ins,
 * rebuys, stack counts, busts, cash-outs) it derives milestones: doubling
 * up, dropping to half a stack, dipping into the red / climbing back into
 * the black, and chip-lead changes.
 *
 * Event ids are deterministic (derived from row ids), so re-deriving after
 * a realtime refresh yields stable ids — consumers can diff feeds to find
 * what's new.
 */
export function deriveTvEvents(
  session: Session,
  players: Player[],
  txs: Tx[],
  duels: Duel[] = []
): TvEvent[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const events: TvEvent[] = players.map((p) => ({
    id: `join-${p.id}`,
    at: p.created_at,
    kind: "join" as const,
    playerName: p.name,
    text: `${p.name} joined the table`,
  }));

  // Duel lifecycle — challenges, declines and settled runouts
  for (const d of duels) {
    const challenger = byId.get(d.challenger_id)?.name ?? "Someone";
    const opponent = byId.get(d.opponent_id)?.name ?? "someone";
    const chips = formatChips(Number(d.chip_amount));
    events.push({
      id: `duel-${d.id}-challenge`,
      at: d.created_at,
      kind: "duel_challenge",
      playerName: challenger,
      text: `${challenger} challenged ${opponent} to a duel — ${chips} chips on the line`,
    });
    if (d.status === "declined" && d.settled_at) {
      events.push({
        id: `duel-${d.id}-declined`,
        at: d.settled_at,
        kind: "duel_declined",
        playerName: opponent,
        text: `${opponent} declined the duel`,
      });
    } else if (d.status === "cancelled" && d.settled_at) {
      events.push({
        id: `duel-${d.id}-cancelled`,
        at: d.settled_at,
        kind: "duel_declined",
        playerName: challenger,
        text: `${challenger} withdrew the challenge`,
      });
    } else if (d.status === "settled" && d.settled_at) {
      const winner = d.winner_id ? byId.get(d.winner_id)?.name : null;
      const loser =
        d.winner_id === d.challenger_id ? opponent : challenger;
      events.push({
        id: `duel-${d.id}-result`,
        at: d.settled_at,
        kind: "duel",
        playerName: winner ?? challenger,
        text: winner
          ? `${winner} won the duel — ${chips} chips off ${loser}`
          : `${challenger} and ${opponent} chopped the duel`,
      });
    }
  }

  const tally = new Map<string, PlayerTally>();
  const get = (id: string): PlayerTally => {
    let t = tally.get(id);
    if (!t) {
      t = { chips: 0, boughtChips: 0, buyInCash: 0, cashOutCash: 0, buyIns: 0 };
      tally.set(id, t);
    }
    return t;
  };
  const pnlOf = (t: PlayerTally) =>
    t.cashOutCash + chipsToCash(session, t.chips) - t.buyInCash;

  let leaderId: string | null = null;
  const sorted = [...txs].sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const t of sorted) {
    const p = byId.get(t.player_id);
    if (!p) continue;
    const s = get(t.player_id);
    const prevChips = s.chips;
    const prevPnl = pnlOf(s);

    if (t.type === "buy_in") {
      s.buyIns++;
      s.chips += Number(t.chip_amount);
      s.boughtChips += Number(t.chip_amount);
      s.buyInCash += Number(t.cash_amount);
      const cash = formatCash(Number(t.cash_amount), session.currency_code);
      events.push({
        id: t.id,
        at: t.created_at,
        kind: s.buyIns > 1 ? "rebuy" : "buy_in",
        playerName: p.name,
        text:
          s.buyIns > 1
            ? `${p.name} rebought for ${cash} (buy-in #${s.buyIns})`
            : `${p.name} bought in for ${cash}`,
      });
    } else if (t.type === "adjustment") {
      s.chips += Number(t.chip_amount);

      // One event per stack count — the most interesting framing wins.
      // Duel transfers keep the tally and milestones but skip the generic
      // "counted" line (the duel event itself tells the story).
      if (s.chips <= 0) {
        events.push({
          id: t.id,
          at: t.created_at,
          kind: "bust",
          playerName: p.name,
          text: `${p.name} busted`,
        });
      } else if (s.boughtChips > 0 && prevChips < s.boughtChips * 2 && s.chips >= s.boughtChips * 2) {
        events.push({
          id: t.id,
          at: t.created_at,
          kind: "double",
          playerName: p.name,
          text: `${p.name} doubled up — ${formatChips(s.chips)} chips`,
        });
      } else if (s.boughtChips > 0 && prevChips > s.boughtChips / 2 && s.chips <= s.boughtChips / 2) {
        events.push({
          id: t.id,
          at: t.created_at,
          kind: "half",
          playerName: p.name,
          text: `${p.name} is down to half a stack — ${formatChips(s.chips)} chips`,
        });
      } else if (!t.duel_id) {
        events.push({
          id: t.id,
          at: t.created_at,
          kind: "stack",
          playerName: p.name,
          text: `${p.name} counted ${formatChips(s.chips)} chips`,
        });
      }

      // P/L zero-crossings ride along as their own events
      const pnl = pnlOf(s);
      if (prevPnl >= 0 && pnl < 0) {
        events.push({
          id: `${t.id}-red`,
          at: t.created_at,
          kind: "red",
          playerName: p.name,
          text: `${p.name} dips into the red`,
        });
      } else if (prevPnl < 0 && pnl >= 0) {
        events.push({
          id: `${t.id}-black`,
          at: t.created_at,
          kind: "black",
          playerName: p.name,
          text: `${p.name} climbs back into the black`,
        });
      }
    } else {
      s.chips -= Number(t.chip_amount);
      s.cashOutCash += Number(t.cash_amount);
      events.push({
        id: t.id,
        at: t.created_at,
        kind: "cash_out",
        playerName: p.name,
        text: `${p.name} cashed out for ${formatCash(Number(t.cash_amount), session.currency_code)}`,
      });
    }

    // Chip-lead changes (only once a lead actually changes hands)
    let bestId: string | null = null;
    let best = 0;
    for (const [pid, ps] of tally) {
      if (ps.chips > best) {
        best = ps.chips;
        bestId = pid;
      }
    }
    if (bestId && bestId !== leaderId) {
      const leader = byId.get(bestId);
      if (leaderId !== null && leader) {
        events.push({
          id: `${t.id}-leader`,
          at: t.created_at,
          kind: "leader",
          playerName: leader.name,
          text: `${leader.name} takes the chip lead`,
        });
      }
      leaderId = bestId;
    }
  }

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
