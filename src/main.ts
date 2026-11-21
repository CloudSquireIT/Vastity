// Vastity — punto di ingresso: crea il renderer, le due viste (Cielo e Navicella) e l'interfaccia.
import * as THREE from 'three';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { loadCatalogs } from './data/catalog';
import { Background } from './render/background';
import { SkyView } from './sky/SkyView';
import { ShipView, formatDuration, formatSpeed, speedToThrottle } from './space/ShipView';
import { V3, v3 } from './astro/astro';
import { bus, setTime, simDate, state, tick } from './state';
import { attachPointer } from './ui/pointer';
import { closeSheet, h, icon, iconButton, initSheet, initToasts, openSheet, sheetOpen, toast } from './ui/dom';
import { AppApi, applyAccessibility, initPanels, openJournal, locate, openAlerts, openMissions, openSearch, openSettings, openTime, openTonight, openWorlds, refreshAlerts, showInfo } from './ui/panels';
import { ObjRef, refName, sameRef, search } from './features/objects';
import { activeMissions, ensureDailyMissions, flag, tryComplete } from './features/missions';
import { loadISS } from './features/iss';
import { AU_IN_KM, C_KMS, setLoadProgress, stars } from './data/catalog';
import { AdaptiveResolution } from './core/quality';
import { feel, reducedMotion } from './core/feel';
import { initDiagnostics } from './core/diagnostics';
import { initTextures } from './core/textures';
import { startTutorial } from './ui/tutorial';
import { LOCALE, num, tx } from './i18n';

const app = document.getElementById('app')!;


function findHip(hip: string) {
  for (let i = 0; i < stars.count; i++) {
    const ni = stars.name[i];
    if (ni >= 0 && stars.names[ni][2] === hip) return i;
  }
  return -1;
}
const routeTo = (r: ObjRef) => tx(`Rotta verso ${refName(r)}`, `Course set for ${refName(r)}`, `Cap sur ${refName(r)}`);
const LYS = tx('anni luce', 'light years', 'années-lumière');
const loader = document.getElementById('loader');
const loaderEl = document.getElementById('loader');

async function main() {
  // schermata iniziale: barra di avanzamento reale del caricamento dei cataloghi
  // il disco di stelle attorno al buco nero si "accende" mentre i cataloghi arrivano
  setLoadProgress((p) => { loaderEl?.style.setProperty('--p', String(Math.min(1, p / 0.86))); });
  const ring = document.querySelector('.mini-bh .p') as SVGCircleElement | null;
  setLoadProgress((p) => { if (ring) ring.style.strokeDashoffset = String(100 - Math.min(100, (p / 0.86) * 100)); });
  await loadCatalogs();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  const adaptive = new AdaptiveResolution(renderer);
  initDiagnostics(renderer.domElement);
  applyAccessibility();
  initTextures(renderer);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.className = 'gl';
  const video = h('video', { class: 'ar-video', playsinline: true, muted: true, autoplay: true }) as HTMLVideoElement;
  app.append(video, renderer.domElement);
  const overlay = h('div', { class: 'overlay' });
  const ui = h('div', { class: 'ui' });
  const fade = h('div', { class: 'fade' });
  const night = h('div', { class: 'night-filter' });
  const flash = h('div', { class: 'warp-flash' });
  app.append(overlay, ui, flash, fade, night);
  // Vastity è pensata in orizzontale: invito a ruotare il telefono (si può continuare in verticale)
  const rotate = h('div', { class: 'rotate-hint', role: 'dialog' },
    h('span', { class: 'ico', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>' }),
    h('b', {}, tx('Ruota il telefono', 'Rotate your phone', 'Tournez votre téléphone')),
    h('p', {}, tx('Vastity dà il meglio in orizzontale.', 'Vastity looks its best in landscape.', 'Vastity est plus belle à l\'horizontale.')),
    h('button', { class: 'btn', onclick: () => { document.body.classList.add('portrait-ok'); try { sessionStorage.setItem('vastity.portrait', '1'); } catch { /* */ } } }, tx('Continua in verticale', 'Continue in portrait', 'Continuer en vertical')));
  try { if (sessionStorage.getItem('vastity.portrait')) document.body.classList.add('portrait-ok'); } catch { /* */ }
  app.append(rotate);
  const lockLandscape = () => { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); };
  document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) lockLandscape(); });
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
    tutorial: () => { closeSheet(); setTimeout(() => startTutorial(ui), 350); },
    ar: () => sky.ar,
    gl: () => renderer.getContext() as WebGL2RenderingContext,
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
  const searchBtn = iconButton('search', tx('Cerca', 'Search', 'Chercher'), () => (state.mode === 'ship' ? openSearch((r) => { ship.goTo(r); toast(routeTo(r)); }) : openSearch()), 'ibtn lens');
  const gyroBtn = iconButton('compass', tx('Punta il telefono', 'Point your phone', 'Pointez votre téléphone'), async () => {
    const ok = await sky.setGyro(!state.gyro);
    if (!ok) toast(tx('Sensori di orientamento non disponibili su questo dispositivo', 'Orientation sensors are not available on this device', 'Capteurs d\'orientation indisponibles sur cet appareil'));
  });
  const top = h('div', { class: 'top' }, brand, h('div', { class: 'top-r' }, searchBtn, iconButton('journal', tx('Diario', 'Log', 'Journal'), () => openJournal(), 'ibtn journal-btn'), gyroBtn, iconButton('settings', tx('Impostazioni', 'Settings', 'Réglages'), () => openSettings())));

  // controlli del tempo: ora (tocco = presente, pressione lunga = macchina del tempo), indietro, pausa, avanti
  const timePill = h('button', { class: 'time-pill', 'aria-label': tx('Torna al presente · tieni premuto per la macchina del tempo', 'Back to now · press and hold for the time machine', 'Revenir au présent · maintenez pour la machine à remonter le temps') }, h('span', { class: 'tp-dot' }), h('span', { class: 'tp-t' }));
  const TIME_STEPS = [60, 600, 3600, 21600, 86400];
  let timeLevel = 0;
  let resumeRate = 1;
  const stepTime = (dir: 1 | -1) => {
    const same = !state.live && Math.sign(state.timeRate) === dir && Math.abs(state.timeRate) > 1;
    timeLevel = same ? Math.min(TIME_STEPS.length, timeLevel + 1) : 1;
    state.live = false;
    state.timeRate = dir * TIME_STEPS[timeLevel - 1];
    updateHud();
  };
  const togglePause = () => {
    if (!state.live && state.timeRate === 0) { state.timeRate = resumeRate || 1; }
    else { resumeRate = state.live ? 1 : state.timeRate; state.live = false; state.timeRate = 0; }
    updateHud();
  };
  const tBack = iconButton('rewind', tx('Indietro nel tempo', 'Back in time', 'Reculer dans le temps'), () => stepTime(-1), 'tbtn');
  const tPause = iconButton('pause', tx('Pausa', 'Pause', 'Pause'), () => togglePause(), 'tbtn');
  const tFwd = iconButton('ffwd', tx('Avanti nel tempo', 'Forward in time', 'Avancer dans le temps'), () => stepTime(1), 'tbtn');
  const timeCtl = h('div', { class: 'time-ctl' }, h('div', { class: 'time-btns' }, tBack, tPause, tFwd), timePill);
  const dockSky = h('nav', { class: 'dock' },
    iconButton('tonight', tx('Stasera', 'Tonight', 'Ce soir'), () => openTonight(), 'dbtn'),
    iconButton('missions', tx('Missioni', 'Missions', 'Missions'), () => openMissions(), 'dbtn'),
    iconButton('ship', tx('Navicella', 'Spaceship', 'Vaisseau'), () => setMode('ship'), 'dbtn accent'),
    iconButton('worlds', tx('Mondi', 'Worlds', 'Mondes'), () => openWorlds(), 'dbtn'),
    iconButton('bell', tx('Avvisi', 'Alerts', 'Alertes'), () => openAlerts(), 'dbtn'),
  );
  const dockShip = h('nav', { class: 'dock ship' },
    iconButton('search', tx('Vai a', 'Go to', 'Aller à'), () => openSearch((r) => { ship.goTo(r); toast(routeTo(r)); }), 'dbtn accent'),
    iconButton('place', tx('Posiziona', 'Place', 'Placer'), () => openPlacePanel(), 'dbtn'),
    iconButton('stop', tx('Ferma', 'Stop', 'Stop'), () => ship.stop(), 'dbtn'),
    iconButton('sky', tx('Atterra', 'Land', 'Atterrir'), () => setMode('sky'), 'dbtn'),
  );
  const bottom = h('div', { class: 'bottom' }, dockSky, dockShip);
  // il pulsante del pannello aperto appare "attivo"; nessuno è evidenziato di default
  const dockIds: [HTMLElement, string][] = [
    [dockSky.children[0] as HTMLElement, 'tonight'], [dockSky.children[1] as HTMLElement, 'missions'],
    [dockSky.children[3] as HTMLElement, 'worlds'], [dockSky.children[4] as HTMLElement, 'alerts'],
    [dockShip.children[0] as HTMLElement, 'search'], [dockShip.children[1] as HTMLElement, 'place'],
  ];
  bus.on('sheet', (id: string | null) => { for (const [el, s] of dockIds) el.classList.toggle('on', id === s); });

  // nascondi/mostra l'interfaccia (in entrambe le modalità)
  const hideBtn = iconButton('eyeOff', tx('Nascondi interfaccia', 'Hide interface', 'Masquer l\'interface'), () => {
    const hidden = document.body.classList.toggle('ui-hidden');
    hideBtn.replaceChildren(icon(hidden ? 'eye' : 'eyeOff'));
    hideBtn.setAttribute('aria-label', hidden ? tx('Mostra interfaccia', 'Show interface', 'Afficher l\'interface') : tx('Nascondi interfaccia', 'Hide interface', 'Masquer l\'interface'));
    if (hidden) closeSheet();
  }, 'ibtn hide-ui');

  const reticle = h('div', { class: 'reticle' }, h('div', { class: 'ret-ring' }), h('div', { class: 'ret-name' }));
  const missionChip = h('button', { class: 'mission-chip', onclick: () => openMissions() });
  // slider dello zoom (in basso a destra nel cielo, in basso a sinistra in navicella)
  const zoomRange = h('input', { type: 'range', min: '0', max: '1', step: '0.001', value: '0', class: 'zoom-range', 'aria-label': tx('Zoom', 'Zoom', 'Zoom') }) as HTMLInputElement;
  const zoomLbl = h('span', { class: 'zoom-lbl' }, '×1');
  const zView = () => (state.mode === 'sky' ? sky : ship);
  let zoomDrag = false;
  const nudgeZoom = (dz: number) => { zView().zoom = Math.max(0, Math.min(1, zView().zoom + dz)); };
  zoomRange.addEventListener('pointerdown', () => { zoomDrag = true; });
  zoomRange.addEventListener('pointerup', () => { zoomDrag = false; });
  zoomRange.addEventListener('input', () => { zView().zoom = +zoomRange.value; });
  const zoomCtl = h('div', { class: 'zoom-ctl' },
    zoomLbl,
    iconButton('plus', tx('Ingrandisci', 'Zoom in', 'Zoomer'), () => nudgeZoom(0.08), 'tbtn'),
    h('div', { class: 'zoom-track' }, zoomRange),
    iconButton('minus', tx('Riduci', 'Zoom out', 'Dézoomer'), () => nudgeZoom(-0.08), 'tbtn'));
  const zoomPill = zoomCtl;

  // telemetria della navicella
  const tSpeed = h('div', { class: 'tm-speed' });
  const tSub = h('div', { class: 'tm-sub' });
  const tTarget = h('div', { class: 'tm-target' });
  const telemetry = h('div', { class: 'telemetry' }, tSpeed, tTarget, tSub);
  const throttle = h('input', { type: 'range', min: '0', max: '1', step: '0.001', value: '0', class: 'throttle', 'aria-label': tx('Manetta', 'Throttle', 'Manette des gaz') }) as HTMLInputElement;
  const throttleMarks = h('div', { class: 'throttle-marks' }, h('span', { style: { bottom: '100%' } }, '10¹² c'), h('span', { style: { bottom: '55%' } }, tx('luce', 'light', 'lumière')), h('span', { style: { bottom: '35%' } }, `${num(0.1, 1, 1)} c`), h('span', { style: { bottom: '2%' } }, '0'));
  const throttleWrap = h('div', { class: 'throttle-wrap' }, throttleMarks, throttle);
  let throttleActive = false;
  throttle.addEventListener('pointerdown', () => { throttleActive = true; });
  throttle.addEventListener('pointerup', () => { throttleActive = false; });
  throttle.addEventListener('input', () => ship.setThrottle(+throttle.value));

  ui.append(top, reticle, missionChip, zoomPill, telemetry, throttleWrap, bottom, timeCtl, hideBtn);

  // ------------------------------------------------------------------ modalità
  function setMode(m: 'sky' | 'ship', instant = false) {
    if (state.mode === m) return;
    const go = () => {
      if (m === 'ship') {
        // decollo: dalla tua posizione, guardando nella stessa direzione
        if (sky.place.id === 'earth' && sky.frame.observerHelioAU) {
          const up = sky.frame.rows[1] as V3;
          const surface = v3.scale(sky.frame.observerHelioAU, AU_IN_KM);
          // guarda verso l'orizzonte nella direzione in cui stavi guardando, poi decolla
          let dir = sky.viewDirEqj();
          dir = v3.norm(v3.sub(dir, v3.scale(up, v3.dot(dir, up) - 0.12)));
          ship.launchFrom(surface, dir, up);
        } else if (sky.place.exo) {
          const i = sky.place.exo.hip ? findHip(sky.place.exo.hip) : -1;
          const r = i >= 0 ? { ref: { kind: 'star', index: i } as ObjRef } : search(sky.place.exo.starName)[0];
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
      feel.setMode(m);
      closeSheet();
      updateHud();
      bus.emit('mode', m);
    };
    if (instant) return go();
    // transizione: la vista "si tuffa" (zoom + sfocatura) in un velo blu notte, poi riemerge nella nuova modalità
    document.body.classList.add('mode-out', m === 'ship' ? 'to-ship' : 'to-sky');
    fade.classList.add('on');
    setTimeout(() => {
      go();
      document.body.classList.remove('mode-out');
      document.body.classList.add('mode-in');
      setTimeout(() => fade.classList.remove('on'), 60);
      setTimeout(() => document.body.classList.remove('mode-in', 'to-ship', 'to-sky'), 700);
    }, 420);
  }

  function flyTo(r: ObjRef) {
    if (state.mode === 'sky') {
      setMode('ship');
      setTimeout(() => { ship.goTo(r); toast(routeTo(r)); }, 700);
    } else {
      ship.goTo(r);
      toast(routeTo(r));
    }
  }

  function openPlacePanel() {
    const presets: [string, string, () => void][] = [
      [tx('Orbita terrestre', 'Earth orbit', 'Orbite terrestre'), tx('Terra', 'Earth', 'Terre'), () => ship.placeNear({ kind: 'body', id: 'earth' })],
      [tx('Luna', 'Moon', 'Lune'), `${num(384400)} km`, () => ship.placeNear({ kind: 'body', id: 'moon' })],
      [tx('Marte', 'Mars', 'Mars'), tx('Pianeta rosso', 'The red planet', 'La planète rouge'), () => ship.placeNear({ kind: 'body', id: 'mars' })],
      [tx('Giove', 'Jupiter', 'Jupiter'), tx('Gigante gassoso', 'Gas giant', 'Géante gazeuse'), () => ship.placeNear({ kind: 'body', id: 'jupiter' })],
      [tx('Saturno', 'Saturn', 'Saturne'), tx('Anelli', 'Rings', 'Anneaux'), () => ship.placeNear({ kind: 'body', id: 'saturn' })],
      [tx('Plutone', 'Pluto', 'Pluton'), tx('Fascia di Kuiper', 'Kuiper belt', 'Ceinture de Kuiper'), () => ship.placeNear({ kind: 'body', id: 'pluto' })],
      [tx('Vicino al Sole', 'Near the Sun', 'Près du Soleil'), tx('La nostra stella', 'Our star', 'Notre étoile'), () => ship.placeNear({ kind: 'body', id: 'sun' })],
      [tx('Proxima Centauri', 'Proxima Centauri', 'Proxima du Centaure'), `${num(4.2, 1, 1)} ${LYS}`, () => byHip('70890')],
      [tx('Sirio', 'Sirius', 'Sirius'), `${num(8.6, 1, 1)} ${LYS}`, () => byHip('32349')],
      [tx('Betelgeuse', 'Betelgeuse', 'Bételgeuse'), tx('Supergigante rossa', 'Red supergiant', 'Supergéante rouge'), () => byHip('27989')],
      [tx('Pleiadi', 'Pleiades', 'Pléiades'), `444 ${LYS}`, () => ship.placeNear({ kind: 'messier', id: 'M45' })],
      [tx('Nebulosa di Orione', 'Orion Nebula', 'Nébuleuse d\'Orion'), `${num(1344)} ${LYS}`, () => ship.placeNear({ kind: 'messier', id: 'M42' })],
      [tx('Via Lattea', 'Milky Way', 'Voie lactée'), tx('Vista dall\'esterno', 'Seen from outside', 'Vue de l\'extérieur'), () => ship.placeNear({ kind: 'deep', id: 'milkyway' })],
      ['Sagittarius A*', tx('Buco nero al centro galattico', 'Black hole at the galactic centre', 'Trou noir au centre galactique'), () => ship.placeNear({ kind: 'deep', id: 'sgra' })],
      ['Omega Centauri', tx('Ammasso globulare', 'Globular cluster', 'Amas globulaire'), () => ship.placeNear({ kind: 'deep', id: 'omegacen' })],
      [tx('Pulsar del Granchio', 'Crab Pulsar', 'Pulsar du Crabe'), tx('Stella di neutroni', 'Neutron star', 'Étoile à neutrons'), () => ship.placeNear({ kind: 'deep', id: 'crabpsr' })],
      [tx('Andromeda', 'Andromeda', 'Andromède'), tx(`${num(2.5, 1, 1)} milioni di anni luce`, `${num(2.5, 1, 1)} million light years`, `${num(2.5, 1, 1)} millions d'années-lumière`), () => ship.placeNear({ kind: 'deep', id: 'm31g' })],
      [tx('Galassia Sombrero', 'Sombrero Galaxy', 'Galaxie du Sombrero'), tx('31 milioni di anni luce', '31 million light years', '31 millions d\'années-lumière'), () => ship.placeNear({ kind: 'deep', id: 'm104g' })],
      ['M87*', tx('Il primo buco nero fotografato', 'The first black hole imaged', 'Le premier trou noir photographié'), () => ship.placeNear({ kind: 'deep', id: 'm87bh' })],
      ['TON 618', tx('Quasar a 10 miliardi di anni luce', 'Quasar 10 billion light years away', 'Quasar à 10 milliards d\'années-lumière'), () => ship.placeNear({ kind: 'deep', id: 'ton618' })],
    ];
    const grid = h('div', { class: 'worlds' }, ...presets.map(([n, s, f]) => h('button', { class: 'world', onclick: () => { closeSheet(); fade.classList.add('on'); setTimeout(() => { f(); fade.classList.remove('on'); }, 300); } }, h('div', { class: 'world-n' }, n), h('div', { class: 'world-s' }, s))));
    openSheet('place', tx('Posiziona la navicella', 'Place the spaceship', 'Placer le vaisseau'), h('div', {}, h('p', { class: 'muted' }, tx('Teletrasportati ovunque, poi pilota liberamente: trascina per girare, usa la manetta a destra per accelerare (fino a e oltre la velocità della luce).', 'Teleport anywhere, then fly freely: drag to turn and use the throttle on the right to accelerate (up to and beyond the speed of light).', 'Téléportez-vous n\'importe où, puis pilotez librement : glissez pour tourner, utilisez la manette à droite pour accélérer (jusqu\'à la vitesse de la lumière et au-delà).')), grid), { wide: true });
  }
  function byHip(hip: string) {
    const i = findHip(hip);
    if (i >= 0) ship.placeNear({ kind: 'star', index: i });
    return i >= 0;
  }

  // ------------------------------------------------------------------ input
  attachPointer(renderer.domElement, () => (state.mode === 'sky' ? sky.handlers() : ship.handlers()));
  bus.on('select', (r: ObjRef | null) => { if (r && state.mode === 'sky') { feel.select(); showInfo(r); } });
  bus.on('ship-select', (r: ObjRef) => { ship.target = r; feel.select(); showInfo(r); });
  bus.on('flash', () => { if (reducedMotion()) return; flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); });
  // suoni e vibrazioni: l'audio si sblocca al primo tocco; un "tic" discreto sui pulsanti
  window.addEventListener('pointerdown', () => feel.unlock(), { once: true, capture: true });
  document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) feel.tick(); }, { capture: true });
  // regolatore di prestazioni: se il dispositivo fatica, si spengono gli effetti più costosi
  adaptive.onStruggle = () => {
    bg.lite = true;
    toast(tx('Ho alleggerito alcuni effetti per mantenere la fluidità (Impostazioni → Grafica)', 'I lightened some effects to keep things smooth (Settings → Graphics)', 'J\'ai allégé certains effets pour rester fluide (Réglages → Graphismes)'));
  };
  bus.on('arrived', (r: ObjRef) => {
    feel.arrive();
    toast(`${tx('Arrivato', 'Arrived', 'Arrivé')}: ${refName(r)}`);
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

  // ora: tocco = presente; pressione lunga = macchina del tempo; trascinamento = scorrimento rapido
  {
    let x0 = 0, dragging = false, moved = false, prevRate = 1, prevLive = true, longT = 0, longDone = false;
    timePill.addEventListener('pointerdown', (e) => {
      x0 = e.clientX; dragging = true; moved = false; longDone = false; prevRate = state.timeRate; prevLive = state.live;
      timePill.setPointerCapture(e.pointerId);
      clearTimeout(longT);
      longT = window.setTimeout(() => { if (!moved && dragging) { longDone = true; timePill.classList.remove('press'); openTime(); } }, 520);
      timePill.classList.add('press');
    });
    timePill.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 8) moved = true;
      if (!moved) return;
      clearTimeout(longT);
      timePill.classList.remove('press');
      state.live = false;
      state.timeRate = Math.sign(dx) * Math.min(3e6, Math.pow(10, Math.abs(dx) / 32));
      timePill.classList.add('scrub');
    });
    const end = () => {
      clearTimeout(longT);
      timePill.classList.remove('press', 'scrub');
      if (!dragging) return;
      dragging = false;
      if (longDone) return;
      if (!moved) {
        setTime(Date.now(), true);
        timeLevel = 0;
        toast(tx('Di nuovo nel presente', 'Back to the present', 'Retour au présent'));
        updateHud();
        return;
      }
      state.timeRate = prevLive ? 0 : prevRate;
      updateHud();
    };
    timePill.addEventListener('pointerup', end);
    timePill.addEventListener('pointercancel', end);
    timePill.addEventListener('contextmenu', (e) => e.preventDefault());
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
    tt.textContent = (sameDay ? '' : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: Math.abs(d.getFullYear() - new Date().getFullYear()) > 0 ? 'numeric' : undefined }) + ' · ') +
      d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) +
      (state.live ? '' : state.timeRate === 0 ? ' · ' + tx('pausa', 'paused', 'pause') : state.timeRate === 1 ? '' : ` · ${rateLabel(state.timeRate)}`);
    timePill.classList.toggle('live', state.live);
    const paused = !state.live && state.timeRate === 0;
    tPause.replaceChildren(icon(paused ? 'play' : 'pause'));
    tPause.setAttribute('aria-label', paused ? tx('Riprendi', 'Resume', 'Reprendre') : tx('Pausa', 'Pause', 'Pause'));
    tPause.classList.toggle('on', paused);
    const fast = !state.live && Math.abs(state.timeRate) > 1;
    tFwd.classList.toggle('on', fast && state.timeRate > 0);
    tBack.classList.toggle('on', fast && state.timeRate < 0);
    tFwd.dataset.lv = fast && state.timeRate > 0 && timeLevel ? `×${timeLevel}` : '';
    tBack.dataset.lv = fast && state.timeRate < 0 && timeLevel ? `×${timeLevel}` : '';
    placeLbl.textContent = state.mode === 'ship' ? tx('Navicella', 'Spaceship', 'Vaisseau') : sky.place.id === 'earth' ? state.location.name : `${tx('da', 'from', 'depuis')} ${sky.place.name}`;

    const m = activeMissions()[0];
    missionChip.textContent = m && state.mode === 'sky' ? `◎ ${m.title}` : '';
    missionChip.style.display = m && state.mode === 'sky' ? '' : 'none';
  }
  function rateLabel(r: number) {
    const a = Math.abs(r), s = r < 0 ? '−' : '';
    if (a < 60) return `${s}${Math.round(a)}×`;
    if (a < 3600) return `${s}${Math.round(a / 60)} min/s`;
    if (a < 86400) return `${s}${Math.round(a / 3600)} ${tx('ore', 'h', 'h')}/s`;
    return `${s}${Math.round(a / 86400)} ${tx('giorni', 'days', 'jours')}/s`;
  }

  function updateShipHud() {
    const t = ship.telemetry();
    feel.setWarp(Math.max(0, Math.min(1, (Math.log10(Math.max(1, t.speed)) - 3) / 7)));
    tSpeed.textContent = formatSpeed(t.speed);
    const parts: string[] = [];
    if (t.beta > 0.4 && t.beta < 1) { const g = num(t.gamma, t.gamma < 10 ? 2 : 0), g1 = num(t.gamma, 1, 1); parts.push(`γ ${g} · ` + tx(`a bordo il tempo scorre ${g1}× più lento`, `time on board runs ${g1}× slower`, `à bord, le temps s'écoule ${g1}× plus lentement`)); }
    if (t.speed >= C_KMS * 0.99995) parts.push(tx('Motore a curvatura', 'Warp drive', 'Moteur de distorsion'));
    parts.push(t.nearest ? `${t.where} · ${tx('vicino a', 'near', 'près de')} ${t.nearest} (${t.nearestDist})` : t.where);
    tSub.textContent = parts.join(' · ');
    if (t.target) {
      tTarget.replaceChildren(`◎ ${t.target}${t.targetDist ? ' · ' + t.targetDist : ''}`);
      if (t.eta) tTarget.append(' · ', h('b', {}, `${tx('arrivo', 'ETA', 'arrivée')} ${t.eta}`));
      if (t.autopilot) tTarget.append(' · ', tx('pilota automatico', 'autopilot', 'pilote auto'));
    }
    else if (t.speed > 1) tTarget.textContent = tx(`Alla velocità attuale: Luna in ${formatDuration(384400 / t.speed)} · Proxima Centauri in ${formatDuration(4.0e13 / t.speed)}`, `At this speed: Moon in ${formatDuration(384400 / t.speed)} · Proxima Centauri in ${formatDuration(4.0e13 / t.speed)}`, `À cette vitesse : la Lune en ${formatDuration(384400 / t.speed)} · Proxima du Centaure en ${formatDuration(4.0e13 / t.speed)}`);
    else tTarget.textContent = tx('Trascina per orientarti · alza la manetta per partire', 'Drag to look around · push the throttle to go', 'Glissez pour vous orienter · poussez la manette pour partir');
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
      if ((state.live || Math.abs(state.time - Date.now()) < 15 * 60e3) && sky.place.id === 'earth') { if (tryComplete(hit.ref)) feel.success(); updateHud(); }
      else if (!warnedLive) { warnedLive = true; toast(tx('Per completare le missioni torna al tempo reale dalla Terra', 'To complete missions, return to real time on Earth', 'Pour accomplir les missions, revenez au temps réel depuis la Terre')); }
    }
  }

  // ------------------------------------------------------------------ condivisione (vista via link)
  function share() {
    const p = new URLSearchParams({
      az: sky.viewAz.toFixed(1), alt: sky.viewAlt.toFixed(1), t: String(Math.round(state.time / 60000) * 60000),
      lat: state.location.lat.toFixed(3), lon: state.location.lon.toFixed(3), place: state.placeId,
    });
    const url = `${location.origin}${location.pathname}#${p.toString()}`;
    if (navigator.share) navigator.share({ title: 'Vastity', text: tx('Guarda questo cielo con me', 'Look at this sky with me', 'Regarde ce ciel avec moi'), url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast(tx('Link copiato: chi lo apre vede lo stesso cielo', 'Link copied: whoever opens it sees the same sky', 'Lien copié : qui l\'ouvre voit le même ciel')));
  }
  function readHash() {
    if (!location.hash) return;
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('place')) sky.setPlace(p.get('place')!);
    if (p.get('t')) setTime(+p.get('t')!);
    if (p.get('lat') && p.get('lon')) state.location = { ...state.location, lat: +p.get('lat')!, lon: +p.get('lon')!, name: tx('Vista condivisa', 'Shared view', 'Vue partagée'), source: 'manual' };
    if (p.get('az')) sky.setView(+p.get('az')!, +(p.get('alt') ?? 30), 75);
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
  sky.setView(180, 25, 75);
  if (location.hash) readHash();
  updateHud();

  let last = performance.now();
  let hudT = 0;
  let lastZoomFov = 60;
  function syncZoom() {
    const v = zView();
    if (!zoomDrag) zoomRange.value = String(v.zoom);
    const mag = state.mode === 'sky' ? 75 / sky.zoomFov : ship.magnification;
    const label = `×${mag < 10 ? num(mag, 1) : num(Math.round(mag))}`;
    if (zoomLbl.textContent !== label) zoomLbl.textContent = label;
  }
  function frame(now: number) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.1, raw);
    last = now;
    adaptive.update(raw);
    tick(dt);
    idleT += dt;
    if (idleT > 6 && !sheetOpen() && !throttleActive && !document.body.classList.contains('touring')) document.body.classList.add('idle');
    if (state.mode === 'sky') {
      sky.update(dt); sky.updateOverlay(); sky.render(renderer);
      // ingrandimento come in un telescopio: 1× ≈ campo dell'occhio
      syncZoom();
      // zoom su un oggetto: il tempo va in pausa, così l'oggetto resta fermo nell'inquadratura
      const zf = sky.zoomFov;
      if (zf < 12 && lastZoomFov >= 12 && !(state.timeRate === 0 && !state.live)) {
        resumeRate = state.live ? 1 : state.timeRate;
        state.live = false; state.timeRate = 0;
        toast(tx('Tempo in pausa durante lo zoom · ▶ per riprendere', 'Time paused while zoomed · ▶ to resume', 'Temps en pause pendant le zoom · ▶ pour reprendre'));
        updateHud();
      }
      lastZoomFov = zf;
    }
    else { ship.update(dt); ship.updateOverlay(); ship.render(renderer); syncZoom(); }
    hudT += dt;
    if (hudT > 0.2) {
      checkMissions(hudT);
      hudT = 0;
      if (state.mode === 'ship') updateShipHud();
      if (!state.live || Math.floor(now / 1000) % 15 === 0) updateHud();
    }
  }
  renderer.setAnimationLoop(frame);
  // uscita dal caricamento: si entra nel buco nero, poi il cielo appare
  document.body.classList.add('intro');
  loader?.classList.add('done');
  setTimeout(() => document.body.classList.remove('intro'), 1600);
  if (!state.settings.tutorialDone && !location.hash) setTimeout(() => startTutorial(ui), 1500);
  setTimeout(() => loader?.remove(), 1300);

  // dati di rete in secondo piano
  loadISS().then(() => { ensureDailyMissions(); updateHud(); refreshAlerts(); }).catch(() => { ensureDailyMissions(); updateHud(); });
  bus.on('alerts', (ev: any[]) => {
    const today = ev.filter((e) => e.quality > 0 && e.date.getTime() - Date.now() < 12 * 3600e3 && e.date.getTime() > Date.now());
    if (today.length && !sessionStorage.getItem('vastity.greeted')) {
      sessionStorage.setItem('vastity.greeted', '1');
      { const hh = today[0].date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }); toast(tx(`Stanotte: ${today[0].title} alle ${hh}`, `Tonight: ${today[0].title} at ${hh}`, `Cette nuit : ${today[0].title} à ${hh}`), 'alert'); }
    }
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js').catch(() => {});
  (window as any).vastity = {
    sky, ship, state, setMode, setTime,
    /** Test: disegna un fotogramma e restituisce l'alfa minimo del canvas (deve essere 255: niente "buchi" trasparenti). */
    debugAlpha() {
      if (state.mode === 'sky') { sky.update(0.016); sky.render(renderer); } else { ship.update(0.016); ship.render(renderer); }
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, hh = gl.drawingBufferHeight;
      const px = new Uint8Array(4);
      let min = 255;
      for (let i = 1; i < 12; i++) for (let j = 1; j < 8; j++) {
        gl.readPixels(Math.floor((w * i) / 12), Math.floor((hh * j) / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        min = Math.min(min, px[3]);
      }
      return min;
    },
  };
}

main().catch((e) => {
  console.error(e);
  if (loader) loader.textContent = tx('Impossibile avviare Vastity: ', 'Vastity could not start: ', 'Impossible de démarrer Vastity : ') + (e?.message ?? e);
});
