// Stato condiviso dell'app + un piccolo sistema di eventi.
import { tx } from './i18n';

export type Mode = 'sky' | 'ship';

export interface Location {
  lat: number;
  lon: number;
  height: number;
  name: string;
  source: 'default' | 'gps' | 'manual';
}

export interface Settings {
  constellations: boolean;
  labels: boolean;
  milkyWay: boolean;
  ground: boolean;
  atmosphere: boolean;
  nightMode: boolean;
  /** Scala di Bortle 1 (cielo perfetto) – 9 (centro città). */
  bortle: number;
  /** true: il cielo mostra le stelle visibili davvero dalla tua zona. */
  realisticSky: boolean;
  /** Effetti relativistici fedeli (altrimenti attenuati per chiarezza). */
  realRelativity: boolean;
  tutorialDone: boolean;
  alerts: Record<string, boolean>;
  /** Qualità grafica: 'auto' (in base al dispositivo) o low/mid/high/ultra. */
  quality?: 'auto' | 'low' | 'mid' | 'high' | 'ultra';
  /** Riduci movimento (accessibilità). */
  reduceMotion?: boolean;
  /** Dimensione del testo: 1 = normale. */
  textScale?: number;
  /** Suoni ambientali ed effetti. */
  sound?: boolean;
  /** Musica ambientale (con il suono attivo). */
  music?: boolean;
  /** Tutorial delle missioni già visto. */
  missionTutorialDone?: boolean;
  /** Benvenuto e permessi già mostrati. */
  welcomeDone?: boolean;
  /** Apertura cinematografica già vista. */
  prologueDone?: boolean;
  /** Prima missione guidata: passo raggiunto (3 = completata). */
  firstTrip?: number;
  /** Vibrazioni leggere sui tocchi importanti. */
  haptics?: boolean;
}

type Listener = (...args: any[]) => void;

class Bus {
  private map = new Map<string, Set<Listener>>();
  on(ev: string, fn: Listener) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.map.get(ev)!.delete(fn);
  }
  emit(ev: string, ...args: any[]) {
    this.map.get(ev)?.forEach((fn) => fn(...args));
  }
}

export const bus = new Bus();

const SETTINGS_KEY = 'vastity.settings.v1';
const LOCATION_KEY = 'vastity.location.v1';

const defaultSettings: Settings = {
  constellations: true,
  labels: true,
  milkyWay: true,
  ground: true,
  atmosphere: true,
  nightMode: false,
  bortle: 4,
  realisticSky: false,
  realRelativity: false,
  tutorialDone: false,
  alerts: { iss: true, meteors: true, conjunctions: true, moon: true, eclipses: true, planets: true },
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch { /* storage non disponibile */ }
  return fallback;
}

export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignora */ }
}

export const state = {
  mode: 'sky' as Mode,
  /** Tempo simulato (ms epoch). */
  time: Date.now(),
  /** Moltiplicatore del tempo: 1 = tempo reale. */
  timeRate: 1,
  /** true quando il tempo segue l'orologio reale. */
  live: true,
  location: load<Location>(LOCATION_KEY, { lat: 41.9028, lon: 12.4964, height: 30, name: tx('Roma', 'Rome', 'Rome'), source: 'default' }),
  settings: load<Settings>(SETTINGS_KEY, defaultSettings),
  /** Luogo da cui si osserva il cielo (id di places.ts). */
  placeId: 'earth',
  gyro: false,
};

export function saveSettings() {
  save(SETTINGS_KEY, state.settings);
  bus.emit('settings');
}

export function setLocation(loc: Location) {
  state.location = loc;
  save(LOCATION_KEY, loc);
  bus.emit('location');
}

export function setTime(t: number, live = false) {
  state.time = t;
  state.live = live;
  if (live) state.timeRate = 1;
  bus.emit('time-jump');
}

export function tick(dtReal: number) {
  if (state.live) state.time = Date.now();
  else state.time += dtReal * 1000 * state.timeRate;
}

export function simDate() {
  return new Date(state.time);
}
