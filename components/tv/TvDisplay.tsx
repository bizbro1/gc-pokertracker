"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { blindElapsedMs, isBlindPaused, levelAt, nextLevel, planOf } from "@/lib/blindSchedule";
import { sessionTotals } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { deriveTvEvents, TvEvent } from "@/lib/tvEvents";
import { Duel, Player, Session, Tx } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PnL, StatusBadge } from "@/components/ui";
import { TvDuel } from "./TvDuel";
import {
  buildLeaderboard,
  TvActivity,
  TvChipRace,
  TvHandRankings,
  TvJoin,
  TvPLBoard,
  TvProgression,
  TvSchedule,
  TvStats,
} from "./TvScenes";

type TvSceneId =
  | "clock"
  | "chiprace"
  | "progression"
  | "pl"
  | "stats"
  | "activity"
  | "schedule"
  | "join"
  | "hands";

const SCENE_INTERVAL_MS = 2 * 60 * 1000;
const CLOCK_SNAP_BACK_MS = 60 * 1000;
const DUEL_SHOW_MS = 32 * 1000;

const SCENE_LABELS: Record<TvSceneId, string> = {
  clock: "Clock",
  chiprace: "Chip race",
  progression: "Progression",
  pl: "Profit / loss",
  stats: "Stats",
  activity: "Activity",
  schedule: "Blinds",
  join: "Join",
  hands: "Hands",
};

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Soft two-note chime for blind level changes (no audio files needed). */
function playLevelUpChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.9);
    });
  } catch {
    /* audio unavailable */
  }
}

export function TvDisplay({
  session,
  players,
  txs,
  duels = [],
  avatars,
  onExit,
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
  duels?: Duel[];
  avatars: Record<string, string>;
  /** present when rendered as an overlay; absent on the standalone /tv route */
  onExit?: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [toasts, setToasts] = useState<TvEvent[]>([]);
  const [duelShow, setDuelShow] = useState<{ duel: Duel; startedAt: number } | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const seenRef = useRef<Set<string> | null>(null);
  const shownDuelsRef = useRef<Set<string> | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  // Render tick — also gates everything time-dependent off the server render
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Keep the screen awake while TV mode is up
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const acquire = () => {
      navigator.wakeLock?.request("screen").then(
        (l) => { lock = l; },
        () => {}
      );
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  const plan = useMemo(() => planOf(session), [session]);
  const paused = isBlindPaused(session);
  const events = useMemo(
    () => deriveTvEvents(session, players, txs, duels),
    [session, players, txs, duels]
  );
  const totals = sessionTotals(session, players, txs);
  const leaderboard = buildLeaderboard(session, players, txs);

  const active = session.status === "active";
  const ended = session.status === "ended";
  const startMs = session.started_at ? new Date(session.started_at).getTime() : null;
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : null;
  // Wall-clock time at the table (Duration display)
  const elapsedMs =
    startMs === null || now === null ? 0 : Math.max(0, (ended && endMs ? endMs : now) - startMs);
  // Blind-clock time — freezes while paused
  const blindMs = now === null ? 0 : blindElapsedMs(session, now);
  const blindMin = Math.floor(blindMs / 60000);

  const current = plan ? levelAt(plan, blindMin) : null;
  const next = plan && current ? nextLevel(plan, current) : null;

  let remainingMs: number | null = null;
  let progress = 0;
  if (plan && current && next) {
    remainingMs = Math.max(0, next.startsAtMin * 60000 - blindMs);
    const len = (next.startsAtMin - current.startsAtMin) * 60000;
    progress = len > 0 ? Math.min(1, (blindMs - current.startsAtMin * 60000) / len) : 0;
  } else if (plan && current) {
    progress = 1;
  }

  // Scene list adapts to what there is to show
  const scenes = useMemo<TvSceneId[]>(() => {
    const s: TvSceneId[] = ["clock"];
    const hasPlayers = players.length > 0;
    if (hasPlayers && !ended) s.push("chiprace");
    if (txs.length >= 2) s.push("progression");
    if (hasPlayers) s.push("pl", "stats");
    if (events.length > 0) s.push("activity");
    if (plan && active) s.push("schedule");
    if (!ended) s.push("join");
    s.push("hands");
    return s;
  }, [players.length, txs.length, events.length, plan, active, ended]);

  // Auto-advance; depends on sceneIdx so a manual change restarts the timer
  useEffect(() => {
    if (scenes.length <= 1) return;
    const id = setInterval(() => setSceneIdx((i) => i + 1), SCENE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [scenes.length, sceneIdx]);

  // Level-up chime
  useEffect(() => {
    if (!plan || !active) return;
    const level = current?.level ?? null;
    if (level !== null && prevLevelRef.current !== null && level > prevLevelRef.current) {
      if (!mutedRef.current) playLevelUpChime();
    }
    if (level !== null) prevLevelRef.current = level;
  }, [current?.level, plan, active]);

  // Event toasts + voice — announce anything that arrives after first paint.
  // Duel results are NOT announced here: the runout show reveals the winner
  // itself, a toast would spoil it.
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(events.map((e) => e.id));
      return;
    }
    const seen = seenRef.current;
    const fresh = events.filter((e) => !seen.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.add(e.id));

    const announce = fresh.filter((e) => e.kind !== "duel");
    if (announce.length === 0) return;

    setToasts((t) => [...t, ...announce].slice(-3));
    announce.forEach((e) => {
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== e.id)),
        6000
      );
    });

    // Voice only — activity sound effects were more noise than fun
    if (!mutedRef.current && "speechSynthesis" in window) {
      try {
        for (const e of announce) {
          const u = new SpeechSynthesisUtterance(e.text);
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        }
      } catch {
        /* speech unavailable */
      }
    }
  }, [events]);

  // Duel runouts — queue settled duels that arrive while the TV is up and
  // play them one at a time
  useEffect(() => {
    const settled = duels.filter((d) => d.status === "settled" && d.deal);
    if (shownDuelsRef.current === null) {
      // First load: anything already settled has had its moment
      shownDuelsRef.current = new Set(settled.map((d) => d.id));
      return;
    }
    if (duelShow) return;
    const shown = shownDuelsRef.current;
    const next = settled
      .filter(
        (d) =>
          !shown.has(d.id) &&
          players.some((p) => p.id === d.challenger_id) &&
          players.some((p) => p.id === d.opponent_id)
      )
      .sort((a, b) => (a.settled_at ?? "").localeCompare(b.settled_at ?? ""))[0];
    if (next) {
      shown.add(next.id);
      setDuelShow({ duel: next, startedAt: Date.now() });
    }
  }, [duels, duelShow, players]);

  // End the runout after its window
  useEffect(() => {
    if (!duelShow || now === null) return;
    if (now - duelShow.startedAt >= DUEL_SHOW_MS) setDuelShow(null);
  }, [now, duelShow]);

  // A duel runout takes over the whole screen; otherwise snap back to the
  // clock when a level change is imminent
  const duelChallenger = duelShow
    ? players.find((p) => p.id === duelShow.duel.challenger_id)
    : undefined;
  const duelOpponent = duelShow
    ? players.find((p) => p.id === duelShow.duel.opponent_id)
    : undefined;
  const duelActive = !!duelShow && now !== null && !!duelChallenger && !!duelOpponent;
  const forceClock =
    active && !paused && remainingMs !== null && remainingMs <= CLOCK_SNAP_BACK_MS;
  const activeIdx = sceneIdx % scenes.length;
  const scene: TvSceneId = forceClock ? "clock" : (scenes[activeIdx] ?? "clock");

  const advanceScene = () => scenes.length > 1 && setSceneIdx((i) => i + 1);

  const handleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  if (now === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-display text-4xl brass-text">Gentleman&apos;s Club</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-10 py-6">
      <style>{`
        @keyframes tv-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes tv-toast { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
        .tv-scene-anim { animation: tv-fade .5s ease; }
        .tv-toast-anim { animation: tv-toast .35s ease; }
      `}</style>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="tv-toast-anim rounded-full border border-brass-dim/50 bg-espresso/95 px-7 py-3 text-xl text-cream shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExit ?? handleFullscreen}
          className="group flex cursor-pointer items-center gap-4"
          aria-label={onExit ? "Exit TV mode" : "Toggle fullscreen"}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brass-dim/60 font-display text-base text-brass transition group-hover:border-brass">
            GC
          </span>
          <span className="font-display text-3xl text-cream">{session.name}</span>
          <StatusBadge status={session.status} />
        </button>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">On the felt</p>
            <p className="font-display text-3xl tabular-nums text-brass-bright">
              {formatCash(totals.cashIn, session.currency_code)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="rounded-md px-3 py-2 text-2xl text-cream-dim transition hover:bg-white/5 hover:text-cream"
            aria-label={muted ? "Unmute announcements" : "Mute announcements"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="rounded-md px-3 py-2 text-2xl text-cream-dim transition hover:bg-white/5 hover:text-cream"
            aria-label="Toggle fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-10 py-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex flex-1 cursor-pointer items-center justify-center"
            onClick={duelActive ? undefined : advanceScene}
          >
            {duelActive ? (
              <div className="tv-scene-anim w-full" key={`duel-${duelShow!.duel.id}`}>
                <TvDuel
                  duel={duelShow!.duel}
                  challenger={duelChallenger!}
                  opponent={duelOpponent!}
                  avatars={avatars}
                  startedAt={duelShow!.startedAt}
                  now={now!}
                  muted={muted}
                />
              </div>
            ) : scene === "clock" ? (
              <div className="tv-scene-anim flex flex-col items-center text-center" key="clock">
                {current ? (
                  <>
                    <span className="text-base uppercase tracking-[0.4em] text-cream-dim">
                      Level {current.level}
                      {plan && <span className="text-cream-faint"> / {plan.levels.length}</span>}
                    </span>
                    <div className="mt-4 font-display text-[7rem] leading-none brass-text tabular-nums">
                      {formatChips(current.smallBlind)}
                      <span className="mx-4 text-cream-faint">/</span>
                      {formatChips(current.bigBlind)}
                    </div>
                    <div
                      className={cn(
                        "mt-8 font-display text-8xl tabular-nums",
                        paused
                          ? "text-cream-dim"
                          : forceClock
                            ? "animate-pulse text-loss"
                            : "text-cream"
                      )}
                    >
                      {paused
                        ? "PAUSED"
                        : remainingMs !== null
                          ? formatClock(remainingMs)
                          : "FINAL LEVEL"}
                    </div>
                    {next && (
                      <p className="mt-4 text-lg uppercase tracking-[0.25em] text-cream-dim">
                        Next: {formatChips(next.smallBlind)} / {formatChips(next.bigBlind)}
                      </p>
                    )}
                    <div className="mt-8 h-2 w-[36rem] max-w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brass-dim to-brass-bright transition-all duration-500"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-base uppercase tracking-[0.4em] text-cream-dim">
                      {ended ? "Final Pot" : "Cash Game"}
                    </span>
                    <div className="mt-4 font-display text-[7rem] leading-none brass-text tabular-nums">
                      {formatCash(totals.cashIn, session.currency_code)}
                    </div>
                    <div className="mt-8 font-display text-8xl tabular-nums text-cream">
                      {startMs ? formatClock(elapsedMs) : "—"}
                    </div>
                    <p className="mt-4 text-lg uppercase tracking-[0.25em] text-cream-dim">
                      Blinds {formatChips(session.small_blind)} / {formatChips(session.big_blind)}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="tv-scene-anim w-full" key={scene}>
                {scene === "chiprace" && (
                  <TvChipRace session={session} players={players} txs={txs} avatars={avatars} />
                )}
                {scene === "progression" && (
                  <TvProgression session={session} players={players} txs={txs} now={now} />
                )}
                {scene === "pl" && (
                  <TvPLBoard session={session} players={players} txs={txs} avatars={avatars} />
                )}
                {scene === "stats" && <TvStats session={session} players={players} txs={txs} />}
                {scene === "activity" && <TvActivity events={events} />}
                {scene === "schedule" && plan && (
                  <TvSchedule plan={plan} elapsedMin={blindMin} />
                )}
                {scene === "join" && <TvJoin joinCode={session.join_code} />}
                {scene === "hands" && <TvHandRankings />}
              </div>
            )}
          </div>

          {/* Scene dots */}
          {scenes.length > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              {scenes.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSceneIdx(i)}
                  aria-label={`Scene: ${SCENE_LABELS[s]}`}
                  title={SCENE_LABELS[s]}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition",
                    i === activeIdx && !forceClock
                      ? "scale-125 bg-brass"
                      : "bg-white/15 hover:bg-white/30"
                  )}
                />
              ))}
            </div>
          )}

          {/* Bottom strip */}
          <div className="flex items-center justify-center gap-14 border-t hairline pt-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">Duration</p>
              <p className="font-display text-2xl tabular-nums text-cream">
                {startMs ? formatClock(elapsedMs) : "—"}
              </p>
            </div>
            {next && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">Next blinds</p>
                <p className="font-display text-2xl tabular-nums text-cream">
                  {formatChips(next.smallBlind)} / {formatChips(next.bigBlind)}
                </p>
              </div>
            )}
            {!ended && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">Join code</p>
                <p className="font-display text-2xl tracking-[0.3em] text-brass">
                  {session.join_code}
                </p>
              </div>
            )}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">Players</p>
              <p className="font-display text-2xl tabular-nums text-cream">{players.length}</p>
            </div>
          </div>
        </div>

        {/* Leaderboard rail — only on the clock scene */}
        {scene === "clock" && leaderboard.length > 0 && (
          <aside className="tv-scene-anim w-96 shrink-0 self-center">
            <p className="mb-3 text-center text-xs uppercase tracking-[0.35em] text-cream-dim">
              {ended ? "Final standings" : "Leaderboard"}
            </p>
            <div className="space-y-1 rounded-xl border hairline bg-gradient-to-b from-espresso to-coal p-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              {leaderboard.slice(0, 10).map(({ player, stats }, i) => {
                const out = player.status === "cashed_out";
                return (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2",
                      i === 0 && !out && "bg-brass/10",
                      out && !ended && "opacity-50"
                    )}
                  >
                    <span className="w-5 text-center font-display text-xl text-cream-faint">
                      {i + 1}
                    </span>
                    <Avatar name={player.name} url={avatars[player.id]} className="h-9 w-9 shrink-0 text-xs" />
                    <span className="min-w-0 flex-1 truncate text-lg text-cream">{player.name}</span>
                    <span className="text-right">
                      {ended || out ? (
                        <PnL
                          value={stats.pnl}
                          currency={session.currency_code}
                          format={formatSignedCash}
                          className="text-lg"
                        />
                      ) : (
                        <span className="font-display text-xl tabular-nums text-cream">
                          {formatChips(stats.currentChips)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
