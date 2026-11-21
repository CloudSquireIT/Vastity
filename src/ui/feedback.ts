// «Segnala un problema o suggerisci un'idea»: un solo modulo per bug, nuove funzioni e modifiche.
// L'invio passa da FormSubmit (servizio che inoltra i moduli per email, senza un server nostro) e
// arriva all'indirizzo del progetto con oggetto «VASTITY Report: <oggetto>».
import { h, openSheet, closeSheet, toast } from './dom';
import { tx, lang } from '../i18n';
import { quality } from '../core/quality';
import { native } from '../core/native';
import { feel } from '../core/feel';
import { state } from '../state';

const ENDPOINT = 'https://formsubmit.co/ajax/danimanci@outlook.it';
export const APP_VERSION = __APP_VERSION__;

type Kind = 'bug' | 'idea' | 'change';

/** Invia una segnalazione. Restituisce true se il servizio l'ha accettata. */
export async function sendReport(fields: Record<string, string>, subject: string): Promise<boolean> {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: `VASTITY Report: ${subject}`, _template: 'table', _captcha: 'false', ...fields }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok && (j.success === true || j.success === 'true');
}

export function openFeedback() {
  const kinds: [Kind, string, string][] = [
    ['bug', tx('Qualcosa non funziona', 'Something is broken', 'Quelque chose ne marche pas'), '⚠︎'],
    ['idea', tx('Ho un\'idea', 'I have an idea', 'J\'ai une idée'), '✦'],
    ['change', tx('Cambierei qualcosa', 'I\'d change something', 'Je changerais quelque chose'), '↻'],
  ];
  const sel = new Set<Kind>(['bug']);
  const kindRow = h('div', { class: 'fb-kinds', role: 'group', 'aria-label': tx('Tipo di segnalazione', 'Report type', 'Type de signalement') });
  const field = (label: string, el: HTMLElement, hint?: string) => h('label', { class: 'fb-field' }, h('span', { class: 'fb-l' }, label), el, hint ? h('span', { class: 'fb-h' }, hint) : null);
  const input = (id: string, ph: string, type = 'text') => h('input', { id, type, class: 'txt', placeholder: ph, autocomplete: type === 'email' ? 'email' : 'off' }) as HTMLInputElement;
  const area = (id: string, ph: string, rows = 3) => h('textarea', { id, class: 'txt', rows, placeholder: ph }) as HTMLTextAreaElement;
  const select = (id: string, opts: [string, string][]) => h('select', { id, class: 'txt' }, ...opts.map(([v, l]) => h('option', { value: v }, l))) as HTMLSelectElement;

  const subject = input('fb-subject', tx('In breve: cosa succede o cosa vorresti?', 'In short: what happens or what would you like?', 'En bref : que se passe-t-il ou que voudriez-vous ?'));
  const desc = area('fb-desc', tx('Raccontaci tutto quello che ti sembra utile.', 'Tell us anything that seems useful.', 'Dites-nous tout ce qui vous semble utile.'), 4);
  const areaSel = select('fb-area', [
    ['sky', tx('Cielo', 'Sky', 'Ciel')], ['ship', tx('Navicella', 'Spaceship', 'Vaisseau')], ['search', tx('Ricerca e schede', 'Search and cards', 'Recherche et fiches')],
    ['missions', tx('Missioni, tour e diario', 'Missions, tours and log', 'Missions, visites et journal')], ['tonight', tx('Stasera e avvisi', 'Tonight and alerts', 'Ce soir et alertes')],
    ['sensors', tx('Bussola, giroscopio, realtà aumentata', 'Compass, gyroscope, AR', 'Boussole, gyroscope, RA')], ['ui', tx('Interfaccia e grafica', 'Interface and graphics', 'Interface et graphismes')],
    ['sound', tx('Suoni', 'Sound', 'Son')], ['other', tx('Altro', 'Other', 'Autre')],
  ]);
  // solo per i bug
  const steps = area('fb-steps', tx('1. Ho aperto…  2. Ho toccato…  3. …', '1. I opened…  2. I tapped…  3. …', '1. J\'ai ouvert…  2. J\'ai touché…  3. …'));
  const expected = area('fb-expected', tx('Cosa ti aspettavi, e cosa è successo invece?', 'What did you expect, and what happened instead?', 'Qu\'attendiez-vous, et que s\'est-il passé ?'), 2);
  const freq = select('fb-freq', [['always', tx('Sempre', 'Always', 'Toujours')], ['sometimes', tx('A volte', 'Sometimes', 'Parfois')], ['once', tx('Una volta sola', 'Only once', 'Une seule fois')]]);
  const sev = select('fb-sev', [['blocker', tx('Non posso usare l\'app', 'I can\'t use the app', 'Je ne peux pas utiliser l\'app')], ['annoying', tx('Fastidioso', 'Annoying', 'Gênant')], ['cosmetic', tx('Solo estetico', 'Just cosmetic', 'Juste esthétique')]]);
  // solo per idee e modifiche
  const why = area('fb-why', tx('Perché ti sarebbe utile? Come lo useresti?', 'Why would it help? How would you use it?', 'En quoi ce serait utile ? Comment l\'utiliseriez-vous ?'), 2);
  const prio = select('fb-prio', [['nice', tx('Sarebbe carino', 'Nice to have', 'Ce serait bien')], ['important', tx('Importante per me', 'Important to me', 'Important pour moi')], ['must', tx('Indispensabile', 'Essential', 'Indispensable')]]);
  const email = input('fb-email', tx('Facoltativa, se vuoi una risposta', 'Optional, if you\'d like a reply', 'Facultatif, si vous voulez une réponse'), 'email');
  const diag = h('input', { type: 'checkbox', id: 'fb-diag', checked: true }) as HTMLInputElement;

  const bugBox = h('div', { class: 'fb-group' },
    field(tx('Come si riproduce', 'Steps to reproduce', 'Étapes pour reproduire'), steps),
    field(tx('Atteso e ottenuto', 'Expected vs actual', 'Attendu et obtenu'), expected),
    h('div', { class: 'fb-row' }, field(tx('Quanto spesso', 'How often', 'Fréquence'), freq), field(tx('Gravità', 'Severity', 'Gravité'), sev)));
  const ideaBox = h('div', { class: 'fb-group' },
    field(tx('Perché', 'Why', 'Pourquoi'), why),
    field(tx('Quanto ti serve', 'How much you need it', 'À quel point c\'est utile'), prio));
  const paintKinds = () => {
    kindRow.replaceChildren(...kinds.map(([k, label, ic]) => h('button', { type: 'button', class: 'chip fb-kind' + (sel.has(k) ? ' on' : ''), 'aria-pressed': String(sel.has(k)),
      onclick: () => { if (sel.has(k) && sel.size > 1) sel.delete(k); else sel.add(k); feel.toggle(sel.has(k)); paintKinds(); } }, h('span', { 'aria-hidden': 'true' }, ic), label)));
    bugBox.style.display = sel.has('bug') ? '' : 'none';
    ideaBox.style.display = sel.has('idea') || sel.has('change') ? '' : 'none';
  };
  paintKinds();

  const status = h('p', { class: 'fb-status muted small', role: 'status' });
  const send = h('button', { type: 'submit', class: 'btn primary block' }, tx('Invia', 'Send', 'Envoyer')) as HTMLButtonElement;
  const form = h('form', { class: 'fb-form', novalidate: true },
    h('p', { class: 'muted' }, tx('Hai trovato un problema o hai un\'idea per migliorare Vastity? Scegli una o più voci e raccontacelo: leggiamo tutto.',
      'Found a problem or have an idea to make Vastity better? Pick one or more and tell us: we read everything.',
      'Un problème ou une idée pour améliorer Vastity ? Choisissez une ou plusieurs options et racontez-nous : nous lisons tout.')),
    kindRow,
    field(tx('Oggetto', 'Subject', 'Objet'), subject),
    field(tx('Dove', 'Where', 'Où'), areaSel),
    field(tx('Descrizione', 'Description', 'Description'), desc),
    bugBox, ideaBox,
    field(tx('La tua email', 'Your email', 'Votre email'), email),
    h('label', { class: 'toggle' }, h('span', {}, tx('Includi informazioni tecniche (versione, dispositivo, qualità grafica)', 'Include technical details (version, device, graphics quality)', 'Inclure les infos techniques (version, appareil, qualité graphique)')), diag, h('span', { class: 'switch' })),
    status, send) as HTMLFormElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subj = subject.value.trim();
    if (!subj) { status.textContent = tx('Scrivi un oggetto, anche di poche parole.', 'Write a subject, even just a few words.', 'Écrivez un objet, même de quelques mots.'); subject.focus(); return; }
    if (!desc.value.trim() && !steps.value.trim() && !why.value.trim()) { status.textContent = tx('Aggiungi qualche dettaglio nella descrizione.', 'Add a few details to the description.', 'Ajoutez quelques détails à la description.'); desc.focus(); return; }
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { status.textContent = tx('L\'email non sembra valida.', 'That email doesn\'t look right.', 'Cet email ne semble pas valide.'); email.focus(); return; }
    const k = [...sel];
    const fields: Record<string, string> = {
      Tipo: k.map((x) => ({ bug: 'Bug', idea: 'Nuova funzione', change: 'Modifica' }[x])).join(' + '),
      Area: areaSel.selectedOptions[0]?.textContent ?? '',
      Descrizione: desc.value.trim(),
    };
    if (sel.has('bug')) Object.assign(fields, { 'Passi per riprodurre': steps.value.trim(), 'Atteso / ottenuto': expected.value.trim(), Frequenza: freq.selectedOptions[0]?.textContent ?? '', Gravità: sev.selectedOptions[0]?.textContent ?? '' });
    if (sel.has('idea') || sel.has('change')) Object.assign(fields, { Motivazione: why.value.trim(), Priorità: prio.selectedOptions[0]?.textContent ?? '' });
    if (email.value) { fields.email = email.value.trim(); fields._replyto = email.value.trim(); }
    if (diag.checked) Object.assign(fields, {
      Versione: APP_VERSION, Piattaforma: native.isNative ? native.platform : 'web', Lingua: lang,
      Schermo: `${innerWidth}×${innerHeight} @${devicePixelRatio}x`, Qualità: quality.tier, Modalità: state.mode, Dispositivo: navigator.userAgent,
    });
    send.disabled = true;
    status.textContent = tx('Invio in corso…', 'Sending…', 'Envoi en cours…');
    try {
      if (!(await sendReport(fields, subj))) throw new Error('rifiutato');
      feel.success();
      closeSheet();
      toast(tx('Grazie! La tua segnalazione è arrivata.', 'Thank you! Your report has been sent.', 'Merci ! Votre signalement est bien parti.'));
    } catch {
      send.disabled = false;
      feel.error();
      status.textContent = tx('Invio non riuscito: controlla la connessione e riprova.', 'Couldn\'t send: check your connection and try again.', 'Échec de l\'envoi : vérifiez la connexion et réessayez.');
    }
  });
  openSheet('feedback', tx('Segnala un problema o suggerisci un\'idea', 'Report a problem or suggest an idea', 'Signaler un problème ou suggérer une idée'), form, { wide: true });
}
