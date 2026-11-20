// Vastity — punto di ingresso: crea il renderer, le due viste (Cielo e Navicella) e l'interfaccia.
import * as THREE from 'three';
import './style.css';
import { loadCatalogs } from './data/catalog';
import { Background } from './render/background';
import { SkyView } from './sky/SkyView';
import { ShipView, formatDuration, formatSpeed, speedToThrottle } from './space/ShipView';
import { V3, v3 } from './astro/astro';
import { bus, setTime, simDate, state, tick } from './state';
import { attachPointer } from './ui/pointer';
import { closeSheet, h, icon, iconButton, initSheet, initToasts, openSheet, sheetOpen, toast } from './ui/dom';
import { AppApi, initPanels, locate, openAlerts, openMissions, openSearch, openSettings, openTime, openTonight, openWorlds, refreshAlerts, showInfo } from './ui/panels';
import { ObjRef, refName, sameRef, search } from './features/objects';
import { activeMissions, ensureDailyMissions, flag, tryComplete } from './features/missions';
import { loadISS } from './features/iss';
import { AU_IN_KM, C_KMS } from './data/catalog';

const app = document.getElementById('app')!;
const loader = document.getElementById('loader');

async function main() {
  await loadCatalogs();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.className = 'gl';
  const video = h('video', { class: 'ar-video', playsinline: true, muted: true, autoplay: true }) as HTMLVideoElement;
  app.append(video, renderer.domElement);
  const overlay = h('div', { class: 'overlay' });
  const ui = h('div', { class: 'ui' });
  const fade = h('div', { class: 'fade' });
  const night = h('div', { class: 'night-filter' });
  app.append(overlay, ui, fade, night);
  initSheet(ui);
  initToasts(ui);

  const bg = new Background();
  const sky = new SkyView(bg, overlay);
  const ship = new ShipView(bg, overlay);
  sky.attach();
  ship.placeNear({ kind: 'body', id: 'earth' });
  ship.target = null; ship.arrived = null;

  // ------------------------------------------------------------------ API pannelli
  let arStream: MediaStream | null = null;
  const api: AppApi = {
    frame: () => sky.frame,
    centerSky: (r) => { if (state.mode !== 'sky') setMode('sky'); sky.centerOn(r); },
    selectSky: (r) => sky.select(r),
    flyTo: (r) => flyTo(r),
    teleport: (r) => { if (state.mode !== 'ship') setMode('ship'); ship.placeNear(r); },
    setPlace: (id) => sky.setPlace(id),
    setMode: (m) => setMode(m),
    share: () => share(),
    ar: () => sky.ar,
    setAR: async (on) => {
      if (on) {
        try {
          arStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          video.srcObject = arStream;
          await video.play().catch(() => {});
          sky.ar = true;
          renderer.setClearColor(0x000000, 0);
          document.body.classList.add('ar');
          if (!state.gyro) await sky.setGyro(true);
          if (state.mode !== 'sky') setMode('sky');
          return true;
        } catch { return false; }
      }
      arStream?.getTracks().forEach((t) => t.stop());
      arStream = null;
      sky.ar = false;
      renderer.setClearColor(0x000000, 1);
      document.body.classList.remove('ar');
      return true;
    },
  };
  initPanels(api);

  // ------------------------------------------------------------------ HUD
  const placeLbl = h('button', { class: 'place-lbl', onclick: () => openWorlds() });
  const brand = h('div', { class: 'brand' }, h('span', { class: 'brand-n' }, 'Vastity'), placeLbl);
  const modeBtn = iconButton('ship', 'Navicella', () => setMode(state.mode === 'sky' ? 'ship' : 'sky'), 'ibtn');
  const gyroBtn = iconButton('compass', 'Punta il telefono', async () => {
    const ok = await sky.setGyro(!state.gyro);
    if (!ok) toast('Sensori di orientamento non disponibili su questo dispositivo');
  });
  const top = h('div', { class: 'top' }, brand, h('div', { class: 'top-r' }, modeBtn, gyroBtn, iconButton('settings', 'Impostazioni', () => openSettings())));

  const timePill = h('button', { class: 'time-pill' }, h('span', { class: 'tp-dot' }), h('span', { class: 'tp-t' }));
  const dockSky = h('nav', { class: 'dock' },
    iconButton('tonight', 'Stasera', () => openTonight(), 'dbtn'),
    iconButton('missions', 'Missioni', () => openMissions(), 'dbtn'),
    iconButton('search', 'Cerca', () => openSearch(), 'dbtn main'),
    iconButton('worlds', 'Mondi', () => openWorlds(), 'dbtn'),
    iconButton('bell', 'Avvisi', () => openAlerts(), 'dbtn'),
  );
  const dockShip = h('nav', { class: 'dock ship' },
    iconButton('search', 'Vai a', () => openSearch((r) => { ship.goTo(r); toast(`Rotta verso ${refName(r)}`); }), 'dbtn main'),
    iconButton('place', 'Posiziona', () => openPlacePanel(), 'dbtn'),
    iconButton('stop', 'Ferma', () => ship.stop(), 'dbtn'),
    iconButton('sky', 'Atterra', () => setMode('sky'), 'dbtn'),
  );
  const bottom = h('div', { class: 'bottom' }, timePill, dockSky, dockShip);

  const reticle = h('div', { class: 'reticle' }, h('div', { class: 'ret-ring' }), h('div', { class: 'ret-name' }));
  const missionChip = h('button', { class: 'mission-chip', onclick: () => openMissions() });

  // telemetria della navicella
  const tSpeed = h('div', { class: 'tm-speed' });
  const tSub = h('div', { class: 'tm-sub' });
  const tTarget = h('div', { class: 'tm-target' });
  const telemetry = h('div', { class: 'telemetry' }, tSpeed, tSub, tTarget);
  const throttle = h('input', { type: 'range', min: '0', max: '1', step: '0.001', value: '0', class: 'throttle', 'aria-label': 'Manetta' }) as HTMLInputElement;
  const throttleMarks = h('div', { class: 'throttle-marks' }, h('span', { style: { bottom: '100%' } }, '10¹² c'), h('span', { style: { bottom: '55%' } }, 'luce'), h('span', { style: { bottom: '35%' } }, '0,1 c'), h('span', { style: { bottom: '2%' } }, '0'));
  const throttleWrap = h('div', { class: 'throttle-wrap' }, throttleMarks, throttle);
  let throttleActive = false;
  throttle.addEventListener('pointerdown', () => { throttleActive = true; });
  throttle.addEventListener('pointerup', () => { throttleActive = false; });
  throttle.addEventListener('input', () => ship.setThrottle(+throttle.value));

  ui.append(top, reticle, missionChip, telemetry, throttleWrap, bottom);

  // ------------------------------------------------------------------ modalità
  function setMode(m: 'sky' | 'ship', instant = false) {
    if (state.mode === m) return;
    const go = () => {
      if (m === 'ship') {
        // decollo: dalla tua posizione, guardando nella stessa direzione
        if (sky.place.id === 'earth' && sky.frame.observerHelioAU) {
          const up = sky.frame.rows[1] as V3;
          const pos = v3.add(v3.scale(sky.frame.observerHelioAU, AU_IN_KM), v3.scale(up, 400));
          const dir = sky.viewDirEqj();
          ship.placeAt(pos, v3.add(pos, v3.scale(dir, 1e6)), up);
          ship.target = null; ship.arrived = null;
        } else if (sky.place.exo) {
          const r = search(sky.place.exo.starName)[0];
          if (r) ship.placeNear(r.ref);
        } else if (sky.place.body) {
          ship.placeNear({ kind: 'body', id: sky.place.id });
        }
        if (state.gyro) sky.setGyro(false);
        if (sky.ar) api.setAR(false);
        sky.detach(); ship.attach();
      } else {
        ship.detach(); sky.attach();
        ship.stop();
      }
      state.mode = m;
      document.body.dataset.mode = m;
      closeSheet();
      updateHud();
      bus.emit('mode', m);
    };
    if (instant) return go();
    fade.classList.add('on');
    setTimeout(() => { go(); setTimeout(() => fade.classList.remove('on'), 60); }, 380);
  }

  function flyTo(r: ObjRef) {
    if (state.mode === 'sky') {
      setMode('ship');
      setTimeout(() => { ship.goTo(r); toast(`Rotta verso ${refName(r)}`); }, 700);
    } else {
      ship.goTo(r);
      toast(`Rotta verso ${refName(r)}`);
    }
  }

  function openPlacePanel() {
    const presets: [string, string, () => void][] = [
      ['Orbita terrestre', 'Terra', () => ship.placeNear({ kind: 'body', id: 'earth' })],
      ['Luna', '384.400 km', () => ship.placeNear({ kind: 'body', id: 'moon' })],
      ['Marte', 'Pianeta rosso', () => ship.placeNear({ kind: 'body', id: 'mars' })],
      ['Giove', 'Gigante gassoso', () => ship.placeNear({ kind: 'body', id: 'jupiter' })],
      ['Saturno', 'Anelli', () => ship.placeNear({ kind: 'body', id: 'saturn' })],
      ['Plutone', 'Fascia di Kuiper', () => ship.placeNear({ kind: 'body', id: 'pluto' })],
      ['Vicino al Sole', 'La nostra stella', () => ship.placeNear({ kind: 'body', id: 'sun' })],
      ['Proxima Centauri', '4,2 anni luce', () => byName('Proxima Centauri')],
      ['Sirio', '8,6 anni luce', () => byName('Sirio') || byName('Sirius')],
      ['Betelgeuse', 'Supergigante rossa', () => byName('Betelgeuse')],
      ['Pleiadi', '444 anni luce', () => ship.placeNear({ kind: 'messier', id: 'M45' })],
      ['Nebulosa di Orione', '1.344 anni luce', () => ship.placeNear({ kind: 'messier', id: 'M42' })],
      ['Sopra la Via Lattea', 'Vista dall\'esterno', () => ship.aboveGalaxy()],
      ['Andromeda', '2,5 milioni di anni luce', () => ship.placeNear({ kind: 'messier', id: 'M31' })],
    ];
    const grid = h('div', { class: 'worlds' }, ...presets.map(([n, s, f]) => h('button', { class: 'world', onclick: () => { closeSheet(); fade.classList.add('on'); setTimeout(() => { f(); fade.classList.remove('on'); }, 300); } }, h('div', { class: 'world-n' }, n), h('div', { class: 'world-s' }, s))));
    openSheet('place', 'Posiziona la navicella', h('div', {}, h('p', { class: 'muted' }, 'Teletrasportati ovunque, poi pilota liberamente: trascina per girare, usa la manetta a destra per accelerare (fino a e oltre la velocità della luce).'), grid), { wide: true });
  }
  function byName(n: string) {
    const r = search(n)[0];
    if (r && r.ref.kind === 'star') { ship.placeNear(r.ref); return true; }
    return false;
  }

  // ------------------------------------------------------------------ input
  attachPointer(renderer.domElement, () => (state.mode === 'sky' ? sky.handlers() : ship.handlers()));
  bus.on('select', (r: ObjRef | null) => { if (r && state.mode === 'sky') showInfo(r); });
  bus.on('ship-select', (r: ObjRef) => { ship.target = r; showInfo(r); });
  bus.on('arrived', (r: ObjRef) => {
    toast(`Arrivato: ${refName(r)}`);
    if (r.kind === 'star') flag('star');
    if (r.kind === 'messier' && r.id === 'M31') flag('andromeda');
  });
  bus.on('settings', () => { document.body.classList.toggle('night', state.settings.nightMode); });
  bus.on('place', () => updateHud());
  bus.on('location', () => { sky.setPlace(state.placeId); updateHud(); refreshAlerts(); });
  bus.on('gyro', () => gyroBtn.classList.toggle('on', state.gyro));
  bus.on('time-ui', () => updateHud());
  document.body.classList.toggle('night', state.settings.nightMode);
  document.body.dataset.mode = 'sky';

  // scorrimento del tempo trascinando la pillola
  {
    let x0 = 0, dragging = false, moved = false, prevRate = 1, prevLive = true;
    timePill.addEventListener('pointerdown', (e) => { x0 = e.clientX; dragging = true; moved = false; prevRate = state.timeRate; prevLive = state.live; timePill.setPointerCapture(e.pointerId); });
    timePill.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 6) moved = true;
      if (!moved) return;
      state.live = false;
      state.timeRate = Math.sign(dx) * Math.min(3e6, Math.pow(10, Math.abs(dx) / 32));
      timePill.classList.add('scrub');
    });
    timePill.addEventListener('pointerup', () => {
      dragging = false;
      timePill.classList.remove('scrub');
      if (!moved) return openTime();
      state.timeRate = prevLive ? 0 : prevRate;
      if (prevLive) state.timeRate = 0;
      updateHud();
    });
  }

  // auto-nascondi l'interfaccia per l'immersione totale
  let idleT = 0;
  const wake = () => { idleT = 0; document.body.classList.remove('idle'); };
  ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));

  // ------------------------------------------------------------------ HUD update
  function updateHud() {
    const d = simDate();
    const tt = timePill.querySelector('.tp-t')!;
    const sameDay = new Date().toDateString() === d.toDateString();
    tt.textContent = (sameDay ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: Math.abs(d.getFullYear() - new Date().getFullYear()) > 0 ? 'numeric' : undefined }) + ' · ') +
      d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) +
      (state.live ? '' : state.timeRate === 0 ? ' · pausa' : state.timeRate === 1 ? '' : ` · ${rateLabel(state.timeRate)}`);
    timePill.classList.toggle('live', state.live);
    placeLbl.textContent = state.mode === 'ship' ? 'Navicella' : sky.place.id === 'earth' ? state.location.name : `da ${sky.place.it}`;
    modeBtn.replaceChildren(icon(state.mode === 'sky' ? 'ship' : 'sky'), h('span', { class: 'ibtn-label' }, state.mode === 'sky' ? 'Navicella' : 'Cielo'));
    modeBtn.setAttribute('aria-label', state.mode === 'sky' ? 'Passa alla navicella' : 'Torna al cielo');
    const m = activeMissions()[0];
    missionChip.textContent = m && state.mode === 'sky' ? `◎ ${m.title}` : '';
    missionChip.style.display = m && state.mode === 'sky' ? '' : 'none';
  }
  function rateLabel(r: number) {
    const a = Math.abs(r), s = r < 0 ? '−' : '';
    if (a < 60) return `${s}${Math.round(a)}×`;
    if (a < 3600) return `${s}${Math.round(a / 60)} min/s`;
    if (a < 86400) return `${s}${Math.round(a / 3600)} ore/s`;
    return `${s}${Math.round(a / 86400)} giorni/s`;
  }

  function updateShipHud() {
    const t = ship.telemetry();
    tSpeed.textContent = formatSpeed(t.speed);
    const parts: string[] = [];
    if (t.beta > 0.05 && t.beta < 1) parts.push(`γ ${t.gamma.toFixed(t.gamma < 10 ? 2 : 0).replace('.', ',')} · a bordo il tempo scorre ${t.gamma.toFixed(1).replace('.', ',')}× più lento`);
    if (t.speed >= C_KMS * 0.99995) parts.push('Motore a curvatura');
    parts.push(t.nearest ? `${t.where} · vicino a ${t.nearest} (${t.nearestDist})` : t.where);
    tSub.textContent = parts.join(' · ');
    if (t.target) tTarget.textContent = `◎ ${t.target}${t.targetDist ? ' · ' + t.targetDist : ''}${t.eta ? ' · arrivo tra ' + t.eta : ''}${t.autopilot ? ' · pilota automatico' : ''}`;
    else if (t.speed > 1) tTarget.textContent = `Alla velocità attuale: Luna in ${formatDuration(384400 / t.speed)} · Proxima Centauri in ${formatDuration(4.0e13 / t.speed)}`;
    else tTarget.textContent = 'Trascina per orientarti · alza la manetta per partire';
    if (!throttleActive) throttle.value = String(speedToThrottle(t.speed));
    if (t.beta >= 0.99 && t.beta < 1) flag('light');
  }

  // ------------------------------------------------------------------ missioni
  let holdRef: ObjRef | null = null, holdT = 0, warnedLive = false;
  function checkMissions(dt: number) {
    const active = activeMissions();
    reticle.classList.toggle('on', state.mode === 'sky' && (active.length > 0 || state.gyro));
    if (state.mode !== 'sky') return;
    const hits = sky.centerHits(12);
    const name = reticle.querySelector('.ret-name') as HTMLElement;
    const tol = (r: ObjRef) => (r.kind === 'constellation' ? 12 : r.kind === 'iss' ? 5 : 2.5);
    const hit = hits.find((x) => active.some((m) => sameRef(m.ref, x.ref)) && x.sep < tol(x.ref));
    const closest = hits.find((x) => x.ref.kind !== 'constellation' && x.sep < 3) ?? hits.find((x) => x.sep < tol(x.ref));
    name.textContent = state.gyro && closest ? refName(closest.ref) : hit ? refName(hit.ref) : '';
    if (hit && sameRef(hit.ref, holdRef)) holdT += dt;
    else { holdRef = hit?.ref ?? null; holdT = 0; }
    reticle.style.setProperty('--hold', String(Math.min(1, holdT / 1.5)));
    reticle.classList.toggle('holding', !!hit);
    if (hit && holdT > 1.5) {
      holdT = 0;
      if (state.live && sky.place.id === 'earth') { tryComplete(hit.ref); updateHud(); }
      else if (!warnedLive) { warnedLive = true; toast('Per completare le missioni torna al tempo reale dalla Terra'); }
    }
  }

  // ------------------------------------------------------------------ condivisione (vista via link)
  function share() {
    const p = new URLSearchParams({
      az: sky.viewAz.toFixed(1), alt: sky.viewAlt.toFixed(1), t: String(Math.round(state.time / 60000) * 60000),
      lat: state.location.lat.toFixed(3), lon: state.location.lon.toFixed(3), place: state.placeId,
    });
    const url = `${location.origin}${location.pathname}#${p.toString()}`;
    if (navigator.share) navigator.share({ title: 'Vastity', text: 'Guarda questo cielo con me', url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast('Link copiato: chi lo apre vede lo stesso cielo'));
  }
  function readHash() {
    if (!location.hash) return;
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('place')) sky.setPlace(p.get('place')!);
    if (p.get('t')) setTime(+p.get('t')!);
    if (p.get('lat') && p.get('lon')) state.location = { ...state.location, lat: +p.get('lat')!, lon: +p.get('lon')!, name: 'Vista condivisa', source: 'manual' };
    if (p.get('az')) sky.setView(+p.get('az')!, +(p.get('alt') ?? 30), 60);
    state.timeRate = 0;
  }

  // ------------------------------------------------------------------ resize & loop
  function resize() {
    const w = window.innerWidth, hgt = window.innerHeight;
    renderer.setSize(w, hgt);
    sky.resize(w, hgt);
    ship.resize(w, hgt);
  }
  window.addEventListener('resize', resize);
  resize();
  if (state.location.source === 'default') locate(false);
  readHash();
  sky.setView(180, 25, 70);
  if (location.hash) readHash();
  updateHud();

  let last = performance.now();
  let hudT = 0;
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(dt);
    idleT += dt;
    if (idleT > 6 && !sheetOpen() && !throttleActive) document.body.classList.add('idle');
    if (state.mode === 'sky') { sky.update(dt); sky.updateOverlay(); sky.render(renderer); }
    else { ship.update(dt); ship.updateOverlay(); ship.render(renderer); }
    hudT += dt;
    if (hudT > 0.2) {
      checkMissions(hudT);
      hudT = 0;
      if (state.mode === 'ship') updateShipHud();
      if (!state.live || Math.floor(now / 1000) % 15 === 0) updateHud();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  loader?.classList.add('done');
  setTimeout(() => loader?.remove(), 900);

  // dati di rete in secondo piano
  loadISS().then(() => { ensureDailyMissions(); updateHud(); refreshAlerts(); }).catch(() => { ensureDailyMissions(); updateHud(); });
  bus.on('alerts', (ev: any[]) => {
    const today = ev.filter((e) => e.quality > 0 && e.date.getTime() - Date.now() < 12 * 3600e3 && e.date.getTime() > Date.now());
    if (today.length && !sessionStorage.getItem('vastity.greeted')) {
      sessionStorage.setItem('vastity.greeted', '1');
      toast(`Stanotte: ${today[0].title} alle ${today[0].date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, 'alert');
    }
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js').catch(() => {});
  (window as any).vastity = { sky, ship, state, setMode };
}

main().catch((e) => {
  console.error(e);
  if (loader) loader.textContent = 'Impossibile avviare Vastity: ' + (e?.message ?? e);
});
