// Stazione Spaziale Internazionale: TLE da CelesTrak (con riserve) e calcolo dei passaggi.
import * as satTypes from 'satellite.js';
import * as satImpl from '../vendor/satellite';
const sat = satImpl as unknown as typeof satTypes;
import * as A from 'astronomy-engine';
import { state } from '../state';

const KEY = 'vastity.iss.tle';
let satrec: satTypes.SatRec | null = null;
let loading: Promise<void> | null = null;

async function fetchTLE(): Promise<[string, string]> {
  try {
    const r = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE');
    const t = (await r.text()).trim().split(/\r?\n/);
    if (t.length >= 3 && t[1].startsWith('1 ')) return [t[1].trim(), t[2].trim()];
  } catch { /* riprova con un'altra fonte */ }
  const r = await fetch('https://tle.ivanstanojevic.me/api/tle/25544');
  const j = await r.json();
  return [j.line1, j.line2];
}

export function loadISS(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    let cached: { t: number; l1: string; l2: string } | null = null;
    try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* */ }
    if (cached) satrec = sat.twoline2satrec(cached.l1, cached.l2);
    if (!cached || Date.now() - cached.t > 86400e3) {
      try {
        const [l1, l2] = await fetchTLE();
        satrec = sat.twoline2satrec(l1, l2);
        localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), l1, l2 }));
      } catch { /* offline: usa la cache se c'è */ }
    }
  })();
  return loading;
}

export function issReady() { return satrec !== null; }

export interface IssLook { az: number; alt: number; rangeKm: number; sunlit: boolean; latDeg: number; lonDeg: number; heightKm: number; eci: [number, number, number] }

export function issLook(date: Date): IssLook | null {
  if (!satrec) return null;
  const pv = sat.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const p = pv.position as satTypes.EciVec3<number>;
  const gmst = sat.gstime(date);
  const ecf = sat.eciToEcf(p, gmst);
  const loc = state.location;
  const gd = { longitude: sat.degreesToRadians(loc.lon), latitude: sat.degreesToRadians(loc.lat), height: loc.height / 1000 };
  const la = sat.ecfToLookAngles(gd, ecf);
  const geo = sat.eciToGeodetic(p, gmst);
  const s = A.GeoVector(A.Body.Sun, date, false);
  const sl = Math.hypot(s.x, s.y, s.z);
  const su = [s.x / sl, s.y / sl, s.z / sl];
  const d = p.x * su[0] + p.y * su[1] + p.z * su[2];
  const perp = Math.hypot(p.x - d * su[0], p.y - d * su[1], p.z - d * su[2]);
  const sunlit = d > 0 || perp > 6371;
  return {
    az: sat.radiansToDegrees(la.azimuth), alt: sat.radiansToDegrees(la.elevation), rangeKm: la.rangeSat, sunlit,
    latDeg: sat.degreesLat(geo.latitude), lonDeg: sat.degreesLong(geo.longitude), heightKm: geo.height, eci: [p.x, p.y, p.z],
  };
}

export interface IssPass { start: Date; peak: Date; end: Date; maxAlt: number; startAz: number; endAz: number; visible: boolean }

export function issPasses(from: Date, days = 3): IssPass[] {
  if (!satrec) return [];
  const obs = new A.Observer(state.location.lat, state.location.lon, state.location.height);
  const passes: IssPass[] = [];
  let cur: IssPass | null = null;
  const step = 20e3;
  for (let t = from.getTime(); t < from.getTime() + days * 86400e3; t += step) {
    const d = new Date(t);
    const l = issLook(d);
    if (!l) break;
    if (l.alt > 10) {
      const sunEq = A.Equator(A.Body.Sun, d, obs, true, true);
      const sunAlt = A.Horizon(d, obs, sunEq.ra, sunEq.dec).altitude;
      const vis = l.sunlit && sunAlt < -6;
      if (!cur) cur = { start: d, peak: d, end: d, maxAlt: l.alt, startAz: l.az, endAz: l.az, visible: vis };
      cur.end = d; cur.endAz = l.az;
      if (l.alt > cur.maxAlt) { cur.maxAlt = l.alt; cur.peak = d; }
      cur.visible = cur.visible || vis;
    } else if (cur) {
      passes.push(cur);
      cur = null;
    }
  }
  if (cur) passes.push(cur);
  return passes;
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export function azName(az: number) { return DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8]; }
