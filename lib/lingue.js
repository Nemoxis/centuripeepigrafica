/* ═══════════════════════════════════════════════════════════════════════
   LINGUE
   La pagina e' scritta in italiano. Le traduzioni stanno in lingue-testi.js,
   in un dizionario che ha per chiave la frase italiana: cosi' nella pagina
   non c'e' niente da marcare, e una frase che manca resta in italiano
   invece di sparire.

   Si traducono da soli:
     - i testi semplici (una frase dentro un elemento);
     - gli attributi title, placeholder, aria-label e alt;
     - gli elementi con l'attributo data-t, per intero, grassetti compresi.
   Un osservatore traduce anche quello che la pagina aggiunge dopo (la
   galleria, i messaggi, i pulsanti dei giochi). Le frasi composte nel
   codice passano da t().
   ═══════════════════════════════════════════════════════════════════════ */
import { TESTI } from './lingue-testi.js';

export const LINGUE = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const CHIAVI = new Set();
for (const d of Object.values(TESTI)) for (const k of Object.keys(d)) CHIAVI.add(k);

let attuale = 'it';
export const lingua = () => attuale;

export function t(s){
  if (s == null || attuale === 'it') return s;
  const d = TESTI[attuale];
  const r = d && d[norm(s)];
  return r === undefined ? s : r;
}

const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
const ESCLUSI = 'script,style,svg,textarea,[data-no-t]';

function traduciTesto(n){
  const p = n.parentElement;
  if (!p || p.closest(ESCLUSI) || p.closest('[data-t]')) return;
  if (n.__it === undefined){
    const k = norm(n.nodeValue);
    if (!k || !CHIAVI.has(k)) return;
    n.__it = n.nodeValue;
  }
  const orig = n.__it;
  let v = orig;
  if (attuale !== 'it'){
    const tr = (TESTI[attuale] || {})[norm(orig)];
    if (tr !== undefined){
      const prima = orig.match(/^\s*/)[0], dopo = orig.match(/\s*$/)[0];
      v = prima + tr + dopo;
    }
  }
  if (n.nodeValue !== v) n.nodeValue = v;
}
function traduciBlocco(el){
  if (el.__it === undefined) el.__it = el.innerHTML;
  const tr = attuale === 'it' ? undefined : (TESTI[attuale] || {})[norm(el.__it)];
  const v = tr === undefined ? el.__it : tr;
  if (el.innerHTML !== v) el.innerHTML = v;
}
function traduciAttributi(el){
  if (el.closest && el.closest('[data-no-t]')) return;
  for (const a of ATTR){
    if (!el.hasAttribute(a)) continue;
    const ora = el.getAttribute(a);
    el.__attr = el.__attr || {};
    // una frase italiana (anche nuova, messa dalla pagina) diventa l'originale
    if (CHIAVI.has(norm(ora))) el.__attr[a] = ora;
    if (el.__attr[a] === undefined) continue;
    const v = tradotto(el.__attr[a]);
    if (ora !== v) el.setAttribute(a, v);
  }
}
function tradotto(orig){
  if (orig === undefined) return undefined;
  if (attuale === 'it') return orig;
  const tr = (TESTI[attuale] || {})[norm(orig)];
  return tr === undefined ? orig : tr;
}

export function traduci(radice = document.body){
  if (!radice) return;
  if (radice.nodeType === 3){ traduciTesto(radice); return; }
  if (radice.nodeType !== 1) return;
  if (radice.matches('[data-t]')) traduciBlocco(radice);
  radice.querySelectorAll('[data-t]').forEach(traduciBlocco);
  const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) traduciTesto(n);
  traduciAttributi(radice);
  radice.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(traduciAttributi);
}

let osservatore = null;
function osserva(){
  if (osservatore) return;
  osservatore = new MutationObserver(lista => {
    for (const m of lista){
      if (m.type === 'childList') m.addedNodes.forEach(n => traduci(n));
      else if (m.type === 'attributes') traduciAttributi(m.target);
    }
  });
  osservatore.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTR });
}

export function impostaLingua(l){
  if (!LINGUE[l]) l = 'it';
  attuale = l;
  document.documentElement.lang = l;
  try{ localStorage.setItem('lingua', l); }catch(e){}
  traduci(document.body);
  document.title = t('Epigrafi Centuripine · Archivio 3D');
  dispatchEvent(new CustomEvent('lingua', { detail: l }));
}

/* la lingua di partenza: quella scelta l'ultima volta, altrimenti quella
   del dispositivo, se c'e'; altrimenti l'italiano.
   Il selettore e' un menu disegnato come il resto della pagina (quello
   nativo dei browser non si lascia vestire): si apre con un clic, si
   percorre con le frecce, si chiude con Esc o toccando fuori. */
export function avviaLingue(box){
  let l = null;
  try{ l = localStorage.getItem('lingua'); }catch(e){}
  if (!LINGUE[l]){
    const pref = (navigator.languages || [navigator.language || 'it']).map(x => String(x).slice(0, 2).toLowerCase());
    l = pref.find(x => LINGUE[x]) || 'it';
  }
  if (box) menuLingue(box, l);
  osserva();
  if (l !== 'it') impostaLingua(l);
  else document.documentElement.lang = 'it';
}

function menuLingue(box, iniziale){
  const tasto = box.querySelector('.lingua-tasto');
  const menu = box.querySelector('.lingua-menu');
  const nome = box.querySelector('.lingua-nome');
  menu.innerHTML = Object.entries(LINGUE).map(([k, n]) =>
    `<li role="option" tabindex="-1" data-l="${k}" lang="${k}" data-no-t>${n}<small>${k.toUpperCase()}</small></li>`).join('');
  const voci = [...menu.querySelectorAll('li')];
  const segna = k => {
    nome.textContent = LINGUE[k];
    voci.forEach(v => v.setAttribute('aria-selected', String(v.dataset.l === k)));
  };
  segna(iniziale);
  const apri = () => {
    menu.hidden = false;
    tasto.setAttribute('aria-expanded', 'true');
    const r = box.getBoundingClientRect();
    menu.classList.toggle('a-sinistra', r.right < 230);
    (voci.find(v => v.getAttribute('aria-selected') === 'true') || voci[0]).focus();
  };
  const chiudi = (fuoco) => {
    menu.hidden = true;
    tasto.setAttribute('aria-expanded', 'false');
    if (fuoco) tasto.focus();
  };
  const scegli = k => { segna(k); chiudi(true); if (k !== attuale) impostaLingua(k); };
  tasto.addEventListener('click', () => (menu.hidden ? apri() : chiudi()));
  tasto.addEventListener('keydown', e => { if (e.key === 'ArrowDown'){ e.preventDefault(); apri(); } });
  menu.addEventListener('click', e => { const v = e.target.closest('li'); if (v) scegli(v.dataset.l); });
  menu.addEventListener('keydown', e => {
    const i = voci.indexOf(document.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); voci[(i + 1) % voci.length].focus(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); voci[(i - 1 + voci.length) % voci.length].focus(); }
    else if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if (i >= 0) scegli(voci[i].dataset.l); }
    else if (e.key === 'Escape' || e.key === 'Tab'){ chiudi(e.key === 'Escape'); }
  });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !box.contains(e.target)) chiudi(); });
  addEventListener('lingua', () => segna(attuale));
}
