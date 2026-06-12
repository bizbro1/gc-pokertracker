// Synthesized event sounds for TV mode — pure WebAudio, no files.

import { TvEventKind } from "@/lib/tvEvents";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One enveloped oscillator note. */
function tone(
  ac: AudioContext,
  opts: {
    freq: number;
    at?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    slideTo?: number;
  }
) {
  const { freq, at = 0, dur = 0.25, type = "sine", gain = 0.22, slideTo } = opts;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Short filtered noise burst — chip clacks and shuffles. */
function click(ac: AudioContext, at: number, gain = 0.3, freq = 2400) {
  const t0 = ac.currentTime + at;
  const len = Math.ceil(ac.sampleRate * 0.04);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

/** Distinct audio signature per table event. */
export function playEventSound(kind: TvEventKind) {
  const ac = audio();
  if (!ac) return;
  switch (kind) {
    case "join": // soft two-note door chime
      tone(ac, { freq: 659, dur: 0.18, gain: 0.15 });
      tone(ac, { freq: 880, at: 0.14, dur: 0.3, gain: 0.15 });
      break;
    case "buy_in":
    case "rebuy": // chips clacking onto the felt
      click(ac, 0, 0.35);
      click(ac, 0.07, 0.3, 2000);
      click(ac, 0.13, 0.25, 2800);
      tone(ac, { freq: 220, at: 0.02, dur: 0.12, type: "triangle", gain: 0.12 });
      break;
    case "stack": // one quiet count click
      click(ac, 0, 0.18, 1800);
      break;
    case "cash_out": // register: two bright bells
      tone(ac, { freq: 880, dur: 0.12, type: "triangle", gain: 0.2 });
      tone(ac, { freq: 1318, at: 0.1, dur: 0.4, type: "triangle", gain: 0.2 });
      break;
    case "double": // rising major arpeggio
      tone(ac, { freq: 523, dur: 0.14 });
      tone(ac, { freq: 659, at: 0.11, dur: 0.14 });
      tone(ac, { freq: 784, at: 0.22, dur: 0.35 });
      break;
    case "half": // two falling notes
      tone(ac, { freq: 440, dur: 0.2, type: "triangle" });
      tone(ac, { freq: 330, at: 0.18, dur: 0.35, type: "triangle" });
      break;
    case "bust": // the sad slide
      tone(ac, { freq: 233, dur: 0.7, type: "sawtooth", gain: 0.12, slideTo: 98 });
      break;
    case "red": // low warning thud
      tone(ac, { freq: 165, dur: 0.35, type: "triangle", gain: 0.25, slideTo: 110 });
      break;
    case "black": // bright recovery ding
      tone(ac, { freq: 988, dur: 0.35, type: "triangle", gain: 0.2 });
      break;
    case "leader": // short fanfare
      tone(ac, { freq: 523, dur: 0.12, type: "square", gain: 0.08 });
      tone(ac, { freq: 659, at: 0.1, dur: 0.12, type: "square", gain: 0.08 });
      tone(ac, { freq: 784, at: 0.2, dur: 0.12, type: "square", gain: 0.08 });
      tone(ac, { freq: 1046, at: 0.3, dur: 0.45, type: "square", gain: 0.09 });
      break;
    case "duel_challenge": // dramatic dun-dun
      tone(ac, { freq: 110, dur: 0.35, type: "sawtooth", gain: 0.18 });
      tone(ac, { freq: 110, at: 0.4, dur: 0.6, type: "sawtooth", gain: 0.22 });
      break;
    case "duel_declined": // deflating womp
      tone(ac, { freq: 330, dur: 0.5, type: "sawtooth", gain: 0.1, slideTo: 165 });
      break;
    case "duel": // settled — handled by the runout, but keep a clash for the log
      click(ac, 0, 0.4, 3200);
      click(ac, 0.08, 0.35, 4000);
      tone(ac, { freq: 392, at: 0.12, dur: 0.4, type: "triangle", gain: 0.15 });
      break;
  }
}

/** Staggered card-flip clicks for the duel runout. */
export function playCardFlip(count = 1) {
  const ac = audio();
  if (!ac) return;
  for (let i = 0; i < count; i++) click(ac, i * 0.2, 0.32, 2200);
}

/** The big winner fanfare at the end of a duel. */
export function playDuelWin() {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 523, dur: 0.5, type: "triangle", gain: 0.14 });
  tone(ac, { freq: 659, dur: 0.5, type: "triangle", gain: 0.12 });
  tone(ac, { freq: 784, at: 0.15, dur: 0.5, type: "triangle", gain: 0.15 });
  tone(ac, { freq: 1046, at: 0.32, dur: 0.9, type: "triangle", gain: 0.18 });
}
