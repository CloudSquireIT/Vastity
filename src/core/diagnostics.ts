// Diagnostica anonima e locale: gli errori restano sul dispositivo (nessun invio a server).
// Dalle Impostazioni l'utente può copiare un rapporto da mandare all'assistenza.
import { quality } from './quality';

const KEY = 'vastity.diag.v1';
interface DiagEntry { t: number; kind: string; msg: string }
let entries: DiagEntry[] = [];
try { entries = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { entries = []; }

export function logIssue(kind: string, msg: string) {
  entries.unshift({ t: Date.now(), kind, msg: String(msg).slice(0, 300) });
  entries = entries.slice(0, 30);
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* */ }
}

export function initDiagnostics(canvas?: HTMLCanvasElement) {
  window.addEventListener('error', (e) => logIssue('error', `${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => logIssue('promise', String((e.reason && e.reason.message) || e.reason)));
  if (canvas) {
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); logIssue('webgl', 'context lost'); });
    // dopo una perdita del contesto grafico (es. app in background su iOS) si riparte puliti
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
}

export function issueCount() { return entries.length; }
export function clearIssues() { entries = []; try { localStorage.removeItem(KEY); } catch { /* */ } }

/** Rapporto testuale: dispositivo, qualità, GPU e ultimi errori (nessun dato personale). */
export function diagnosticsReport(gl?: WebGLRenderingContext | WebGL2RenderingContext) {
  let gpu = '';
  try {
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch { /* */ }
  const lines = [
    `Vastity · ${new Date().toISOString()}`,
    `UA: ${navigator.userAgent}`,
    `Screen: ${screen.width}×${screen.height} @${devicePixelRatio} · viewport ${innerWidth}×${innerHeight}`,
    `Quality: ${quality.tier}${quality.auto ? ' (auto)' : ''} · GPU: ${gpu || 'n/d'}`,
    `Issues (${entries.length}):`,
    ...entries.map((e) => `  ${new Date(e.t).toISOString()} [${e.kind}] ${e.msg}`),
  ];
  return lines.join('\n');
}
