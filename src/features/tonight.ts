// Idea 1 — "Stasera vale la pena?": un punteggio della serata che unisce meteo reale,
// Luna, buio e inquinamento luminoso, e suggerisce cosa guardare e quando.
import { A, BODIES, eqjToHor, moonPhaseName, nightWindow, observer, sunAltitude, v3 } from '../astro/astro';
import { MESSIER_EXTRA, constellations, messier, messierName, radecToVec } from '../data/catalog';
import { ObjRef } from './objects';
import { IssPass, issPasses, loadISS } from './iss';
import { WeatherHour, effectiveCloud, getWeather, weatherAt } from './weather';
import { state } from '../state';
import { LOCALE, num, tx } from '../i18n';

const NA = () => tx('n.d.', 'n/a', 'n.d.');
function lightTravel(ly: number) {
  const v = ly >= 1e6 ? `${num(ly / 1e6, 1)} ${tx('milioni di anni', 'million years', 'millions d\'années')}` : `${num(Math.round(ly))} ${tx('anni', 'years', 'ans')}`;
  return tx(`la sua luce viaggia da ${v}`, `its light has travelled for ${v}`, `sa lumière voyage depuis ${v}`);
}

export interface HourScore { t: number; score: number; cloud: number | null; moonUp: boolean; sunAlt: number }
export interface Suggestion { ref: ObjRef; name: string; when: Date; alt: number; az: number; note: string; icon: string }

export interface Tonight {
  score: number;
  label: string;
  summary: string;
  weather: boolean;
  start: Date;
  end: Date;
  best: Date;
  hours: HourScore[];
  moon: { phase: string; illum: number; rise: Date | null; set: Date | null };
  suggestions: Suggestion[];
  iss: IssPass[];
  factors: { name: string; value: string; ok: boolean }[];
}

const SHOWPIECES = ['M31', 'M42', 'M45', 'M13', 'M44', 'M8', 'M57', 'M27', 'M51', 'M81', 'M22', 'M7', 'M6', 'M11', 'M35', 'M41', 'M3', 'M5', 'M92', 'M20', 'M17'];

export function scoreLabel(s: number) {
  if (s >= 80) return tx('Serata eccezionale', 'Exceptional night', 'Soirée exceptionnelle');
  if (s >= 62) return tx('Ottima serata', 'Great night', 'Excellente soirée');
  if (s >= 42) return tx('Serata discreta', 'Decent night', 'Soirée correcte');
  if (s >= 22) return tx('Serata mediocre', 'Mediocre night', 'Soirée médiocre');
  return tx('Meglio restare a casa', 'Better stay home', 'Mieux vaut rester chez soi');
}

function moonState(t: Date) {
  const obs = observer();
  const eq = A.Equator(A.Body.Moon, t, obs, true, true);
  const alt = A.Horizon(t, obs, eq.ra, eq.dec).altitude;
  const illum = A.Illumination(A.Body.Moon, t).phase_fraction;
  return { alt, illum };
}

export function hourScore(t: Date, w: WeatherHour | null) {
  const sunAlt = sunAltitude(t);
  const darkness = sunAlt <= -18 ? 1 : sunAlt <= -12 ? 0.8 : sunAlt <= -6 ? 0.45 : 0.05;
  const m = moonState(t);
  const moonPen = m.illum * Math.max(0, Math.min(1, (m.alt + 4) / 25));
  const moonF = 1 - 0.5 * moonPen;
  const b = state.settings.bortle;
  const pollF = 1 - (b - 1) * 0.045;
  let cloudF = 1, humF = 1, cloud: number | null = null;
  if (w) {
    cloud = effectiveCloud(w);
    cloudF = Math.pow(1 - cloud / 100, 1.4);
    humF = (w.humidity > 92 ? 0.8 : w.humidity > 82 ? 0.92 : 1) * (w.visibility < 8000 ? 0.75 : 1) * (1 - (w.precip / 100) * 0.6);
  }
  return { score: 100 * darkness * moonF * pollF * cloudF * humF, cloud, moonUp: m.alt > 0, sunAlt, moonPen };
}

export async function computeTonight(now = new Date()): Promise<Tonight> {
  const [weather] = await Promise.all([getWeather(), loadISS().catch(() => undefined)]);
  const win = nightWindow(now);
  let start = win.dusk ?? win.sunset ?? new Date(now.getTime());
  let end = win.dawn ?? new Date(start.getTime() + 8 * 3600e3);
  if (end.getTime() - now.getTime() < 90 * 60e3) { // la notte è (quasi) finita: guarda alla prossima
    const next = nightWindow(new Date(now.getTime() + 12 * 3600e3));
    start = next.dusk ?? start; end = next.dawn ?? end;
  }
  const from = now > start ? now : start;
  const hours: HourScore[] = [];
  for (let t = from.getTime(); t <= end.getTime(); t += 1800e3) {
    const d = new Date(t);
    const s = hourScore(d, weatherAt(weather, t));
    hours.push({ t, score: s.score, cloud: s.cloud, moonUp: s.moonUp, sunAlt: s.sunAlt });
  }
  if (!hours.length) hours.push({ t: from.getTime(), score: 0, cloud: null, moonUp: false, sunAlt: 0 });
  const sorted = [...hours].sort((a, b) => b.score - a.score);
  const bestH = sorted[0];
  // il punteggio della serata pesa la ora migliore e la media delle 3 ore migliori
  const top = sorted.slice(0, Math.min(6, sorted.length));
  const score = Math.round(bestH.score * 0.5 + (top.reduce((s, h) => s + h.score, 0) / top.length) * 0.5);
  const best = new Date(bestH.t);

  // Luna
  const mph = A.MoonPhase(best);
  const ill = A.Illumination(A.Body.Moon, best).phase_fraction;
  const obs = observer();
  const safe = (f: () => A.AstroTime | null) => { try { return f()?.date ?? null; } catch { return null; } };
  const moon = {
    phase: moonPhaseName(mph), illum: ill,
    rise: safe(() => A.SearchRiseSet(A.Body.Moon, obs, +1, new Date(start.getTime() - 6 * 3600e3), 1.2)),
    set: safe(() => A.SearchRiseSet(A.Body.Moon, obs, -1, new Date(start.getTime() - 6 * 3600e3), 1.2)),
  };

  // cosa guardare
  const sugg: Suggestion[] = [];
  const sample = (dirAt: (t: Date) => [number, number, number]) => {
    let bestAlt = -90, bt = best, baz = 0;
    for (const h of hours) {
      if (h.score < bestH.score * 0.35 && hours.length > 2) continue;
      const d = new Date(h.t);
      const hz = eqjToHor(dirAt(d), d);
      if (hz.alt > bestAlt) { bestAlt = hz.alt; bt = d; baz = hz.az; }
    }
    return { alt: bestAlt, when: bt, az: baz };
  };
  for (const b of BODIES) {
    if (!b.body || b.id === 'sun' || b.id === 'earth' || b.id === 'pluto') continue;
    const r = sample((d) => { const e = A.Equator(b.body!, d, obs, false, true); return v3.norm([e.vec.x, e.vec.y, e.vec.z]); });
    if (r.alt < 8) continue;
    const mag = A.Illumination(b.body, r.when).mag;
    const note = b.id === 'moon' ? tx(`${moonPhaseName(mph)}, illuminata al ${Math.round(ill * 100)}%`, `${moonPhaseName(mph)}, ${Math.round(ill * 100)}% illuminated`, `${moonPhaseName(mph)}, éclairée à ${Math.round(ill * 100)} %`)
      : b.id === 'uranus' || b.id === 'neptune' ? tx('Serve un binocolo o un telescopio', 'Needs binoculars or a telescope', 'Il faut des jumelles ou un télescope')
      : b.id === 'jupiter' ? tx('Con un binocolo vedi le sue 4 lune più grandi', 'Binoculars show its 4 largest moons', 'Aux jumelles, on voit ses 4 plus grandes lunes')
      : b.id === 'saturn' ? tx('Con un piccolo telescopio vedi gli anelli', 'A small telescope shows the rings', 'Un petit télescope montre les anneaux')
      : b.id === 'venus' ? tx('L\'oggetto più luminoso dopo Sole e Luna', 'The brightest object after the Sun and Moon', 'L\'objet le plus brillant après le Soleil et la Lune')
      : b.id === 'mars' ? tx('Riconoscibile dal colore rosso-arancio', 'Easy to spot by its red-orange colour', 'Reconnaissable à sa couleur rouge orangé')
      : `${tx('Magnitudine', 'Magnitude', 'Magnitude')} ${num(mag, 1, 1)}`;
    sugg.push({ ref: { kind: 'body', id: b.id }, name: b.name, when: r.when, alt: r.alt, az: r.az, note, icon: b.id === 'moon' ? 'moon' : 'planet' });
  }
  const dso: Suggestion[] = [];
  for (const id of SHOWPIECES) {
    const m = messier.find((x) => x.id === id);
    if (!m) continue;
    const dir = radecToVec(m.ra, m.dec);
    const r = sample(() => dir);
    if (r.alt < 25) continue;
    const ly = MESSIER_EXTRA[m.id]?.ly;
    dso.push({ ref: { kind: 'messier', id }, name: messierName(m), when: r.when, alt: r.alt, az: r.az, note: `${m.id}${ly ? ' · ' + lightTravel(ly) : ''}`, icon: 'dso' });
  }
  dso.sort((a, b) => b.alt - a.alt);
  sugg.push(...dso.slice(0, 3));
  const cons = constellations.filter((c) => c.rank === 1).map((c) => {
    const hz = eqjToHor(radecToVec(c.c[0], c.c[1]), best);
    return { c, ...hz };
  }).filter((c) => c.alt > 35).sort((a, b) => b.alt - a.alt).slice(0, 2);
  for (const c of cons) sugg.push({ ref: { kind: 'constellation', id: c.c.id }, name: c.c.name, when: best, alt: c.alt, az: c.az, note: tx('Alta nel cielo, facile da riconoscere', 'High in the sky, easy to recognise', 'Haute dans le ciel, facile à reconnaître'), icon: 'cons' });

  const iss = issPasses(new Date(Math.max(now.getTime(), start.getTime() - 3600e3)), 1).filter((p) => p.visible && p.peak <= end && p.maxAlt > 15);

  const w = weatherAt(weather, best.getTime());
  const factors = [
    { name: tx('Nuvole', 'Clouds', 'Nuages'), value: w ? `${Math.round(effectiveCloud(w))}%` : NA(), ok: w ? effectiveCloud(w) < 35 : true },
    { name: tx('Luna', 'Moon', 'Lune'), value: `${Math.round(ill * 100)}%${bestH.moonUp ? ' · ' + tx('alta', 'up', 'levée') : ' · ' + tx('sotto l\'orizzonte', 'below the horizon', 'sous l\'horizon')}`, ok: !bestH.moonUp || ill < 0.35 },
    { name: tx('Buio', 'Darkness', 'Obscurité'), value: bestH.sunAlt <= -18 ? tx('notte piena', 'full night', 'nuit noire') : tx('crepuscolo', 'twilight', 'crépuscule'), ok: bestH.sunAlt <= -12 },
    { name: tx('Umidità', 'Humidity', 'Humidité'), value: w ? `${Math.round(w.humidity)}%` : NA(), ok: w ? w.humidity < 85 : true },
    { name: tx('Inquinamento luminoso', 'Light pollution', 'Pollution lumineuse'), value: `Bortle ${state.settings.bortle}`, ok: state.settings.bortle <= 4 },
  ];
  const fmtT = (d: Date) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  let summary: string;
  if (score < 22) summary = w && effectiveCloud(w) > 70 ? tx('Il cielo sarà coperto per gran parte della notte.', 'The sky will be overcast for most of the night.', 'Le ciel sera couvert une grande partie de la nuit.') : tx('Condizioni difficili: prova un\'altra sera.', 'Tough conditions: try another night.', 'Conditions difficiles : essayez un autre soir.');
  else summary = tx(`Il momento migliore è intorno alle ${fmtT(best)}`, `The best time is around ${fmtT(best)}`, `Le meilleur moment est vers ${fmtT(best)}`) + (moon.illum > 0.6 && bestH.moonUp ? tx(', ma la Luna illuminerà il cielo', ', but the Moon will brighten the sky', ', mais la Lune éclairera le ciel') : '') + '.';
  if (!weather) summary += ' ' + tx('(Meteo non disponibile: punteggio basato solo su Luna e buio.)', '(Weather unavailable: score based only on the Moon and darkness.)', '(Météo indisponible : score basé uniquement sur la Lune et l\'obscurité.)');

  return { score, label: scoreLabel(score), summary, weather: !!weather, start: from, end, best, hours, moon, suggestions: sugg, iss, factors };
}
