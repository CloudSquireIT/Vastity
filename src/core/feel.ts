// "Feel" dell'app: musica ambientale composta in tempo reale, effetti sonori e vibrazioni leggere.
// Tutto è sintetizzato con Web Audio (nessun file da scaricare, nessuna licenza): una progressione
// lenta di accordi in re lidio, campane rade sopra gli accordi, un riverbero ampio e una ventina di
// effetti accordati alla stessa armonia. Rispetta le impostazioni (suono, musica, vibrazioni) e
// le regole dei browser (l'audio parte solo dopo il primo tocco); si sospende con l'app in background.
import { state } from '../state';
import { native } from './native';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let revSend: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let amb: { drone: GainNode; air: GainNode; airFilter: BiquadFilterNode; padFilter: BiquadFilterNode } | null = null;
let mode: 'sky' | 'ship' = 'sky';
let warp = 0;
let schedTimer = 0;
let nextChordAt = 0;
let nextBellAt = 0;
let chordIdx = 0;
let pendingTick = 0;
let lastSfx = 0;

const soundOn = () => state.settings.sound !== false;
const musicOn = () => soundOn() && state.settings.music !== false;
const hapticsOn = () => state.settings.haptics !== false;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// progressione (note MIDI): Dmaj9 · Bm11 · Gmaj7♯11 · Aadd9 · Em9 · Gmaj9/D
const CHORDS: number[][] = [
  [38, 45, 52, 54, 61], [35, 42, 50, 57, 64], [31, 38, 47, 54, 61], [33, 40, 49, 52, 59], [28, 40, 47, 50, 54], [38, 43, 50, 54, 57],
];
// note "campana" per ogni accordo (pentatonica compatibile, due ottave sopra)
const BELLS: number[][] = [
  [74, 76, 78, 81, 85, 88], [71, 74, 76, 78, 81, 83], [74, 78, 79, 81, 85, 86], [73, 76, 78, 81, 83, 85], [71, 74, 76, 78, 79, 83], [74, 76, 79, 81, 83, 86],
];
const CHORD_S = 14;

function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

function ensureAudio() {
  if (ctx || !soundOn()) return;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.4;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp);
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 5.5, 2.6);
  const revOut = ctx.createGain();
  revOut.gain.value = 0.55;
  reverb.connect(revOut).connect(master);
  revSend = ctx.createGain();
  revSend.gain.value = 0.35;
  revSend.connect(reverb);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  const musicRev = ctx.createGain();
  musicRev.gain.value = 0.9;
  musicBus.connect(musicRev).connect(reverb);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(master);
  sfxBus.connect(revSend);

  // rumore rosa riutilizzabile (aria della navicella, fruscii)
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  // tappeto grave (sempre) + aria filtrata che sale con la velocità
  const drone = ctx.createGain();
  drone.gain.value = 0;
  drone.connect(master);
  for (const [f, g] of [[36.7, 0.5], [55, 0.32], [73.4, 0.12]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = g;
    o.connect(og).connect(drone); o.start();
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf; noise.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass'; airFilter.frequency.value = 400;
  const air = ctx.createGain(); air.gain.value = 0;
  noise.connect(airFilter).connect(air).connect(master);
  noise.start();
  // filtro comune dei pad, con un respiro lento
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 0.4;
  padFilter.connect(musicBus);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
  const lfoG = ctx.createGain(); lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(padFilter.frequency); lfo.start();
  amb = { drone, air, airFilter, padFilter };
  master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.5);
  nextChordAt = ctx.currentTime + 0.3;
  nextBellAt = ctx.currentTime + 4;
  chordIdx = Math.floor(Math.random() * CHORDS.length);
  applyAmbience();
  startScheduler();
}

// --------------------------------------------------------------------- musica
function padVoice(midi: number, t: number, dur: number, gain: number) {
  if (!ctx || !amb) return;
  const f = mtof(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 4.5);
  g.gain.setValueAtTime(gain, t + dur - 1);
  g.gain.linearRampToValueAtTime(0, t + dur + 5);
  const pan = ctx.createStereoPanner?.();
  if (pan) { pan.pan.value = (Math.random() * 2 - 1) * 0.55; g.connect(pan).connect(amb.padFilter); } else g.connect(amb.padFilter);
  for (const [type, det, k] of [['triangle', -6, 1], ['sawtooth', 7, 0.16], ['sine', 0, 0.6]] as const) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = det + (Math.random() - 0.5) * 4;
    const og = ctx.createGain(); og.gain.value = k;
    o.connect(og).connect(g);
    o.start(t); o.stop(t + dur + 5.2);
  }
}

function bell(midi: number, t: number, gain: number, dest: AudioNode | null = musicBus) {
  if (!ctx || !dest) return;
  const f = mtof(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
  const pan = ctx.createStereoPanner?.();
  if (pan) { pan.pan.value = (Math.random() * 2 - 1) * 0.7; g.connect(pan).connect(dest); } else g.connect(dest);
  // parziali inarmoniche di una campana di vetro
  for (const [r, k, dk] of [[1, 1, 1], [2.756, 0.32, 0.45], [5.404, 0.12, 0.25]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f * r;
    const og = ctx.createGain();
    og.gain.setValueAtTime(k, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 3.6 * dk);
    o.connect(og).connect(g);
    o.start(t); o.stop(t + 3.7);
  }
}

function startScheduler() {
  clearInterval(schedTimer);
  schedTimer = window.setInterval(() => {
    if (!ctx || ctx.state !== 'running' || !musicOn()) return;
    const now = ctx.currentTime;
    if (now + 0.5 >= nextChordAt) {
      chordIdx = (chordIdx + 1 + (Math.random() < 0.25 ? 1 : 0)) % CHORDS.length;
      const ch = CHORDS[chordIdx];
      ch.forEach((m, i) => padVoice(m + (mode === 'ship' && i > 2 ? 12 : 0), nextChordAt + i * 0.35, CHORD_S, i === 0 ? 0.05 : 0.032));
      nextChordAt += CHORD_S;
    }
    if (now + 0.5 >= nextBellAt) {
      const notes = BELLS[chordIdx];
      const m = notes[Math.floor(Math.random() * notes.length)];
      bell(m, nextBellAt, mode === 'ship' ? 0.03 : 0.022);
      // a volte una seconda nota, come un'eco melodica
      if (Math.random() < 0.35) bell(notes[Math.floor(Math.random() * notes.length)], nextBellAt + 0.45 + Math.random() * 0.4, 0.016);
      nextBellAt += (mode === 'ship' ? 2.6 : 3.8) + Math.random() * 5;
    }
  }, 250);
}

function applyAmbience() {
  if (!ctx || !amb || !musicBus) return;
  const t = ctx.currentTime;
  const on = soundOn() && document.visibilityState === 'visible';
  const droneG = !on ? 0 : mode === 'ship' ? 0.045 + 0.03 * warp : 0.02;
  const airG = !on ? 0 : mode === 'ship' ? 0.03 + 0.16 * warp : 0.012;
  amb.drone.gain.setTargetAtTime(droneG, t, 0.8);
  amb.air.gain.setTargetAtTime(airG, t, 0.5);
  amb.airFilter.frequency.setTargetAtTime(mode === 'ship' ? 300 + 2600 * warp : 260, t, 0.4);
  amb.padFilter.frequency.setTargetAtTime(mode === 'ship' ? 1300 + 900 * warp : 850, t, 1.2);
  musicBus.gain.setTargetAtTime(on && musicOn() ? (mode === 'ship' ? 0.95 : 0.8) : 0, t, 1.2);
}

// --------------------------------------------------------------------- effetti
function sfxReady() { return !!(ctx && sfxBus && soundOn() && ctx.state === 'running'); }
function mark() { lastSfx = performance.now(); clearTimeout(pendingTick); }

function tone(f: number, dur: number, gain: number, o: { type?: OscillatorType; to?: number; at?: number; attack?: number; rev?: boolean } = {}) {
  if (!sfxReady()) return;
  const c = ctx!;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o.rev === false ? master! : sfxBus!);
  osc.start(t); osc.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, o: { type?: BiquadFilterType; f0: number; f1: number; q?: number; at?: number; attack?: number; shape?: 'swell' | 'hit' }) {
  if (!sfxReady() || !noiseBuf) return;
  const c = ctx!;
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const fl = c.createBiquadFilter();
  fl.type = o.type ?? 'bandpass'; fl.Q.value = o.q ?? 1.2;
  fl.frequency.setValueAtTime(o.f0, t);
  fl.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  if (o.shape === 'hit') { g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  else { g.gain.linearRampToValueAtTime(gain, t + (o.attack ?? dur * 0.6)); g.gain.linearRampToValueAtTime(0, t + dur); }
  src.connect(fl).connect(g).connect(sfxBus!);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

/** Note dell'accordo in corso (gli effetti "musicali" restano intonati con la musica). */
const chordBells = () => BELLS[chordIdx];

export const feel = {
  /** Da chiamare al primo gesto dell'utente. */
  unlock() { ensureAudio(); ctx?.resume?.(); },
  setMode(m: 'sky' | 'ship') { mode = m; applyAmbience(); },
  /** 0 = fermo, 1 = velocità della luce e oltre. */
  setWarp(w: number) {
    const nw = Math.max(0, Math.min(1, w));
    if (Math.abs(nw - warp) < 0.02) return;
    warp = nw;
    applyAmbience();
  },
  refresh() {
    if (!soundOn() && master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    else if (soundOn()) { ensureAudio(); if (master && ctx) master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5); }
    applyAmbience();
  },
  /** Tic dei pulsanti: suona solo se il pulsante non ha già un suono suo. */
  tick() {
    clearTimeout(pendingTick);
    const t0 = performance.now();
    pendingTick = window.setTimeout(() => { if (lastSfx < t0) tone(2100, 0.035, 0.012, { rev: false }); }, 40);
  },
  select() { mark(); const b = chordBells(); tone(mtof(b[2]), 0.25, 0.028); tone(mtof(b[4]), 0.4, 0.022, { at: 0.06 }); haptic('light'); },
  open() { mark(); noise(0.32, 0.035, { f0: 300, f1: 1800, q: 0.9 }); tone(mtof(chordBells()[1]), 0.3, 0.012, { at: 0.08 }); },
  close() { mark(); noise(0.24, 0.025, { f0: 1600, f1: 280, q: 0.9 }); },
  toggle(on: boolean) { mark(); tone(on ? 760 : 1140, 0.09, 0.022, { to: on ? 1140 : 760, rev: false }); haptic('light'); },
  arrive() {
    mark();
    const b = chordBells();
    [0, 2, 4].forEach((k, i) => bell(b[k] - 12, ctx ? ctx.currentTime + i * 0.12 : 0, 0.05, sfxBus));
    noise(1.4, 0.03, { type: 'lowpass', f0: 2400, f1: 200, q: 0.5, shape: 'hit' });
    haptic('success');
  },
  success() {
    mark();
    const b = chordBells();
    b.slice(0, 5).forEach((m, i) => tone(mtof(m), 0.7, 0.03, { type: 'triangle', at: i * 0.07 }));
    if (ctx) bell(b[5] + 12, ctx.currentTime + 0.4, 0.03, sfxBus);
    haptic('success');
  },
  step() { mark(); const b = chordBells(); tone(mtof(b[1]), 0.45, 0.03, { type: 'triangle' }); tone(mtof(b[3]), 0.6, 0.03, { type: 'triangle', at: 0.11 }); haptic('success'); },
  /** Superamento della velocità della luce: colpo grave e risucchio. */
  warpIn() {
    mark();
    tone(110, 1.4, 0.09, { to: 38 });
    noise(0.9, 0.06, { f0: 400, f1: 5200, q: 0.7, attack: 0.7 });
    haptic('medium');
  },
  warpOut() { mark(); noise(1.1, 0.045, { f0: 4200, f1: 300, q: 0.7, attack: 0.15 }); tone(70, 0.9, 0.05, { to: 110 }); },
  /** Decollo dalla Terra: rombo che sale. */
  launch() {
    mark();
    noise(6.5, 0.09, { type: 'lowpass', f0: 90, f1: 900, q: 0.6, attack: 2.2 });
    tone(42, 6, 0.06, { to: 70, attack: 1.5 });
    haptic('medium');
  },
  /** Cambio di modalità (cielo ↔ navicella). */
  whoosh() { mark(); noise(0.6, 0.05, { f0: 280, f1: 2600, q: 1.1, attack: 0.35 }); },
  /** Ingresso in atmosfera alla fine dell'apertura. */
  entry() { mark(); noise(1.3, 0.07, { type: 'lowpass', f0: 5000, f1: 160, q: 0.4, attack: 0.25 }); },
  /** Stella cadente che appare / presa. */
  sparkle() { tone(3400, 0.9, 0.009, { to: 1500, attack: 0.05 }); },
  catchStar() { mark(); const b = chordBells(); [5, 3, 4].forEach((k, i) => { if (ctx) bell(b[k] + 12, ctx.currentTime + i * 0.09, 0.03, sfxBus); }); haptic('success'); },
  timeStep(dir: number) { mark(); tone(dir > 0 ? 1320 : dir < 0 ? 990 : 1180, 0.06, 0.02, { to: dir > 0 ? 1760 : dir < 0 ? 740 : 1180, rev: false }); },
  error() { mark(); tone(233, 0.12, 0.035, { type: 'triangle' }); tone(196, 0.18, 0.035, { type: 'triangle', at: 0.13 }); haptic('medium'); },
};

export function haptic(kind: 'light' | 'medium' | 'success') {
  if (!hapticsOn()) return;
  if (native.haptic(kind)) return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  nav.vibrate?.(kind === 'light' ? 8 : kind === 'medium' ? 18 : [10, 40, 18]);
}

/** Riduci movimento: preferenza del sistema o scelta nelle impostazioni. */
export function reducedMotion() {
  return state.settings.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// in background l'audio si ferma del tutto (batteria); al ritorno riprende
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.visibilityState === 'hidden') ctx.suspend?.();
  else if (soundOn()) ctx.resume?.();
  applyAmbience();
});
