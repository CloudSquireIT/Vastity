// Icone SVG lineari (stile minimal, tratto 1.5).
const s = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const icons = {
  search: s('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  tonight: s('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3v3M15.5 4.5h3"/>'),
  missions: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>'),
  worlds: s('<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)"/>'),
  bell: s('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  ship: s('<path d="M12 2.5c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><path d="M8 13.5l-3 3 3 1M16 13.5l3 3-3 1M10.5 19.5L12 22l1.5-2.5"/><circle cx="12" cy="9.5" r="1.3"/>'),
  sky: s('<path d="M3 18h18"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M5 7l.6 1.4L7 9l-1.4.6L5 11l-.6-1.4L3 9l1.4-.6zM18 4l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z"/>'),
  compass: s('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  settings: s('<circle cx="12" cy="12" r="2.6"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  target: s('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  fly: s('<path d="M4 20L20 4M20 4h-7M20 4v7"/>'),
  stop: s('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  place: s('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  share: s('<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 13v6h14v-6"/>'),
  calendar: s('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  minus: s('<path d="M5 12h14"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  journal: s('<path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M6 3v18M10 8h5M10 12h5"/>'),
  clock: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  rewind: s('<path d="M11.5 6.5 5 12l6.5 5.5zM19 6.5 12.5 12l6.5 5.5z" fill="currentColor" stroke-linejoin="round"/>'),
  ffwd: s('<path d="M12.5 6.5 19 12l-6.5 5.5zM5 6.5 11.5 12 5 17.5z" fill="currentColor" stroke-linejoin="round"/>'),
  pause: s('<path d="M8.5 6v12M15.5 6v12" stroke-width="2.6"/>'),
  play: s('<path d="M8 5.5 18.5 12 8 18.5z" fill="currentColor" stroke-linejoin="round"/>'),
  back: s('<path d="M15 5l-7 7 7 7"/>'),
  fwd: s('<path d="M9 5l7 7-7 7"/>'),
  fullscreen: s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  eye: s('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff: s('<path d="M3 3l18 18"/><path d="M10.6 5.6A10 10 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3.2 4M6.3 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/>'),
  camera: s('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  light: s('<path d="M3 12h4M17 12h4"/><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2"/>'),
};

export type IconName = keyof typeof icons;
