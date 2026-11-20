// "Feel" dell'app: suoni ambientali procedurali (Web Audio, nessun file), vibrazioni leggere
// e preferenze di movimento. Tutto rispetta le impostazioni dell'utente e le regole dei browser
// (l'audio parte solo dopo il primo tocco).
import { state } from '../state';
import { native } from './native';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let amb: { drone: GainNode; air: GainNode; airFilter: BiquadFilterNode; lfo: OscillatorNode } | null = null;
let mode: 'sky' | 'ship' = 'sky';
let warp = 0;

const soundOn = () => state.settings.sound !== false;
const hapticsOn = () => state.settings.haptics !== false;

function ensureAudio() {
  if (ctx || !soundOn()) return;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  // tappeto sonoro: due note gravi leggermente stonate + "aria" (rumore filtrato)
  const drone = ctx.createGain();
  drone.gain.value = 0;
  drone.connect(master);
  for (const [f, g] of [[55, 0.5], [82.4, 0.3], [110.3, 0.12]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const og = ctx.createGain();
    og.gain.value = g;
    o.connect(og).connect(drone);
    o.start();
  }
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.15;
  lfo.connect(lfoG).connect(drone.gain);
  lfo.start();
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.value = 400;
  const air = ctx.createGain();
  air.gain.value = 0;
  noise.connect(airFilter).connect(air).connect(master);
  noise.start();
  amb = { drone, air, airFilter, lfo };
  master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.5);
  applyAmbience();
}

function applyAmbience() {
  if (!ctx || !amb) return;
  const t = ctx.currentTime;
  const on = soundOn() && document.visibilityState === 'visible';
  // in navicella il tappeto è più presente e l'aria sale con la velocità; nel cielo è appena percettibile
  const droneG = !on ? 0 : mode === 'ship' ? 0.05 + 0.03 * warp : 0.018;
  const airG = !on ? 0 : mode === 'ship' ? 0.012 + 0.07 * warp : 0.008;
  amb.drone.gain.setTargetAtTime(droneG, t, 0.8);
  amb.air.gain.setTargetAtTime(airG, t, 0.5);
  amb.airFilter.frequency.setTargetAtTime(mode === 'ship' ? 300 + 2600 * warp : 260, t, 0.4);
}

function blip(freqs: number[], dur: number, gain: number, type: OscillatorType = 'sine') {
  if (!ctx || !master || !soundOn()) return;
  const t = ctx.currentTime;
  freqs.forEach((f, i) => {
    const o = ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t + i * 0.06);
    o.frequency.exponentialRampToValueAtTime(f * 0.92, t + i * 0.06 + dur);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, t + i * 0.06);
    g.gain.linearRampToValueAtTime(gain, t + i * 0.06 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + dur);
    o.connect(g).connect(master!);
    o.start(t + i * 0.06);
    o.stop(t + i * 0.06 + dur + 0.05);
  });
}

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
  tick() { blip([1250], 0.05, 0.025); },
  select() { blip([880, 1320], 0.12, 0.03); haptic('light'); },
  arrive() { blip([523, 784, 1046], 0.6, 0.045); haptic('success'); },
  success() { blip([659, 988, 1319], 0.5, 0.05, 'triangle'); haptic('success'); },
  warpIn() { haptic('medium'); },
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

document.addEventListener('visibilitychange', () => applyAmbience());
