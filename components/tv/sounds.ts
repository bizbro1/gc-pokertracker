// TV sound effects — ElevenLabs-generated clips served statically from
// /public/sounds (generated once; no API calls at runtime).

import { TvEventKind } from "@/lib/tvEvents";

const cache: Record<string, HTMLAudioElement> = {};

function play(name: string, volume = 0.7) {
  try {
    let base = cache[name];
    if (!base) {
      base = new Audio(`/sounds/${name}.mp3`);
      base.preload = "auto";
      cache[name] = base;
    }
    // Clone so rapid repeats (card flips) can overlap
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.volume = volume;
    void node.play().catch(() => {
      /* autoplay blocked until first user gesture */
    });
  } catch {
    /* audio unavailable */
  }
}

/** Per-activity clip + volume — themed for the club. */
const EVENT_CLIPS: Partial<Record<TvEventKind, { clip: string; volume: number }>> = {
  join: { clip: "join", volume: 0.6 },
  buy_in: { clip: "chips", volume: 0.7 },
  rebuy: { clip: "chips", volume: 0.7 },
  stack: { clip: "chip-count", volume: 0.35 },
  bust: { clip: "bust", volume: 0.75 },
  cash_out: { clip: "cash-out", volume: 0.7 },
  double: { clip: "double-up", volume: 0.75 },
  half: { clip: "half-stack", volume: 0.65 },
  red: { clip: "in-the-red", volume: 0.65 },
  black: { clip: "back-in-black", volume: 0.65 },
  leader: { clip: "chip-lead", volume: 0.75 },
  duel_challenge: { clip: "gauntlet", volume: 0.8 },
  duel_declined: { clip: "declined", volume: 0.65 },
  // "duel" results have no toast — the runout carries its own sound
};

/** Themed clip for an activity toast (no-op for unmapped kinds). */
export function playEventSound(kind: TvEventKind) {
  const m = EVENT_CLIPS[kind];
  if (m) play(m.clip, m.volume);
}

const ALL_CLIPS = [
  "card-flip", "duel-sting", "duel-win", "level-up",
  "join", "chips", "chip-count", "bust", "cash-out", "double-up",
  "half-stack", "in-the-red", "back-in-black", "chip-lead", "gauntlet", "declined",
];

/** Warm the cache so the first plays don't hitch on network fetches. */
export function preloadSounds() {
  for (const name of ALL_CLIPS) {
    if (!cache[name]) {
      const a = new Audio(`/sounds/${name}.mp3`);
      a.preload = "auto";
      cache[name] = a;
    }
  }
}

/** Blind level increase. */
export function playLevelUpChime() {
  play("level-up", 0.8);
}

/** A board card turning over in the duel runout. */
export function playCardFlip() {
  play("card-flip", 0.8);
}

/** Duel runout opening — the standoff sting. */
export function playDuelSting() {
  play("duel-sting", 0.85);
}

/** The winner fanfare at the end of a duel. */
export function playDuelWin() {
  play("duel-win", 0.85);
}
