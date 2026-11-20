// Lingue dell'interfaccia: italiano, inglese, francese.
// La lingua si sceglie una volta all'avvio (cambiarla ricarica l'app), così anche
// i dati statici (descrizioni, eventi storici, nomi) vengono tradotti al caricamento.

export type Lang = 'it' | 'en' | 'fr';
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'it', name: 'Italiano' },
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
];

const KEY = 'vastity.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'it' || saved === 'en' || saved === 'fr') return saved;
  } catch { /* storage non disponibile */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.languages?.[0] ?? navigator.language : 'it') || 'it';
  const l = nav.slice(0, 2).toLowerCase();
  return l === 'fr' ? 'fr' : l === 'it' ? 'it' : 'en';
}

export const lang: Lang = detect();
export const LOCALE = lang === 'it' ? 'it-IT' : lang === 'fr' ? 'fr-FR' : 'en-GB';

/** Sceglie il testo nella lingua corrente. */
export function tx(it: string, en: string, fr: string): string {
  return lang === 'it' ? it : lang === 'fr' ? fr : en;
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* */ }
  location.reload();
}

/** Numero formattato nella lingua corrente. */
export function num(n: number, maxDigits = 0, minDigits = 0) {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxDigits, minimumFractionDigits: minDigits });
}

/** Rimpiazza {chiave} nel testo. */
export function fill(s: string, p: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));
}

if (typeof document !== 'undefined') document.documentElement.lang = lang;
