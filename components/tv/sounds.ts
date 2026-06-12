// TV sound effects — ElevenLabs-generated clips served statically from
// /public/sounds (generated once; no API calls at runtime).

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

/** Warm the cache so the first runout doesn't hitch on network fetches. */
export function preloadSounds() {
  for (const name of ["card-flip", "duel-sting", "duel-win", "level-up"]) {
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
