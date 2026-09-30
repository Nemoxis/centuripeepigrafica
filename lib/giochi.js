/* ═══════════════════════════════════════════════════════════════════════
   ATTIVITA'
   Due giochi per chi visita l'archivio, soprattutto per le scuole:

     1. Ricomponi l'epigrafe: un modello 3D vero dell'archivio viene
        spezzato a caso in frammenti, e bisogna rimetterli al loro posto,
        come in un puzzle.
     2. Diventa lapicida: si sceglie una pietra, si scrive un testo da
        tastiera, lo si decora con segni antichi o a mano libera (con il
        dito, la penna o il mouse), e alla fine lo si guarda in 3D, con la
        luce radente, come le epigrafi vere.

   Il modulo non sa niente della pagina oltre a quello che la pagina gli
   passa in preparaGiochi(): cosi' il visualizzatore resta com'era.
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { t, lingua } from './lingue.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let H = null;                 // gli strumenti che presta la pagina
let attiva = null;            // 'puzzle' | 'lapicida' | null
let rend = null;              // un solo motore 3D per entrambi i giochi

/* ─────────────────────────── rumore ─────────────────────────────────
   Un rumore liscio e ripetibile: serve a spezzare la pietra lungo linee
   irregolari e a disegnare le venature del marmo. */
function hash(x, y, s){
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 144269)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function liscio(x, y, s){
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function frattale(x, y, s, ottave = 4){
  let v = 0, amp = .5, f = 1, tot = 0;
  for (let o = 0; o < ottave; o++){ v += amp * liscio(x * f, y * f, s + o * 31); tot += amp; amp *= .5; f *= 2.03; }
  return v / tot;
}
const caso = (a, b) => a + Math.random() * (b - a);
const mescola = a => { for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const colore = nome => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

/* ─────────────────────────── motore 3D ────────────────────────────── */
function motore(){
  if (rend) return rend;
  rend = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rend.setPixelRatio(Math.min(devicePixelRatio, 2));
  rend.outputColorSpace = THREE.SRGBColorSpace;
  rend.setClearColor(0x000000, 0);
  rend.domElement.className = 'g-tela3d';
  return rend;
}
function montaMotore(box){
  const r = motore();
  if (r.domElement.parentNode !== box) box.insertBefore(r.domElement, box.firstChild);
  misuraMotore(box);
  return r;
}
function misuraMotore(box){
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h || !rend) return false;
  rend.setSize(w, h, false);
  return true;
}

let ultimo = 0, giro = 0;
function ciclo(ora){
  giro = requestAnimationFrame(ciclo);
  const dt = Math.min(.05, (ora - ultimo) / 1000 || 0); ultimo = ora;
  if (attiva === 'puzzle') pzFotogramma(dt, ora);
  else if (attiva === 'lapicida') lpFotogramma(dt, ora);
  else if (attiva === 'scavo') svFotogramma(dt, ora);
}

/* ─────────────────────────── apertura ─────────────────────────────── */
const TITOLI = {
  puzzle:   ['Fragmenta',    'Ricomponi l\'epigrafe'],
  lapicida: ['Hic scripsi',  'Diventa lapicida'],
  scavo:    ['Ex terra',     'Dallo scavo al museo'],
};
function scriviTitolo(){
  if (!attiva) return;
  $('#g-t').textContent = t(TITOLI[attiva][0]);
  const inCorso = attiva === 'puzzle' ? st && st.m : attiva === 'scavo' ? sv && sv.m : null;
  if (inCorso) $('#g-s').textContent = inCorso.titolo + (inCorso.sede ? ' · ' + inCorso.sede : '');
  else $('#g-s').textContent = t(TITOLI[attiva][1]);
}

function apriGioco(tipo){
  if (attiva === tipo) return;
  if (attiva) chiudiGioco(true);
  H.fermaVetrina();
  attiva = tipo;
  scriviTitolo();
  $('#g-stato').textContent = '';
  $$('#giochi .g-corpo').forEach(c => c.classList.toggle('on', c.id === 'g-' + tipo));
  $('#giochi').classList.add('on');
  $('#giochi').setAttribute('aria-hidden', 'false');
  document.body.classList.add('fermo');
  chiudiGuida();
  if (!giro){ ultimo = performance.now(); giro = requestAnimationFrame(ciclo); }
  ({ puzzle: pzEntra, lapicida: lpEntra, scavo: svEntra })[tipo]();
}

function chiudiGioco(passaggio){
  if (!attiva) return;
  ({ puzzle: pzEsci, lapicida: lpEsci, scavo: svEsci })[attiva]();
  attiva = null;
  cancelAnimationFrame(giro); giro = 0;
  chiudiGuida();
  if (passaggio) return;
  $('#giochi').classList.remove('on');
  $('#giochi').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('fermo');
  H.riprendiVetrina();
}

/* la guida di ciascun gioco, dietro il "?" */
const GUIDE = {
  puzzle: {
    voci: [
      '<b>Trascina</b> ogni frammento sulla sagoma della pietra',
      '<b>Tocca</b> un frammento, senza trascinarlo, per <b>girarlo</b> di un quarto di giro',
      'Quando è nel posto giusto e dritto <b>si aggancia da solo</b>',
      '<b>Sbircia</b> mostra per un attimo come era la pietra intera',
    ],
    nota: 'Ogni partita spezza la pietra in modo diverso.',
  },
  scavo: {
    voci: [
      'La pietra passa per cinque tappe: <b>scavo</b>, <b>pulizia</b>, <b>analisi</b>, <b>studio</b> e <b>scheda</b>',
      'Scegli l\'attrezzo e passa il dito o il mouse sulla pietra, come con un pennello vero',
      'La <b>cazzuola</b> è per la terra, il <b>pennello</b> per la polvere asciutta, la <b>spugna</b> umida per il velo di fango, il <b>bisturi</b> per le incrostazioni',
      'L\'attrezzo sbagliato <b>graffia la pietra</b>: i graffi restano, come nella realtà',
      'Nell\'analisi usi la <b>luce radente</b>, il <b>metro</b> e la <b>macchina fotografica</b>',
    ],
    nota: 'Alla fine ottieni la scheda dell\'epigrafe, con le misure vere del modello 3D.',
  },
  lapicida: {
    voci: [
      'In <b>Pietra</b> scegli la forma, il materiale, la cornice e quanto è consumata',
      'In <b>Testo</b> scrivi da tastiera e scegli lo stile delle lettere, anche in latino o in greco',
      'Con <b>A mano</b> scrivi o disegni con il dito, la penna o il mouse',
      'In <b>Decora</b> scegli un segno antico e tocca la pietra per inciderlo',
      'Con <b>Sposta</b> trascini il testo e i segni dove vuoi',
      '<b>Guarda in 3D</b> trasforma il tuo lavoro in una pietra vera, da girare con la luce radente',
    ],
    nota: 'Il colore rosso ricorda il cinabro e il minio, i pigmenti con cui si ripassavano le lettere.',
  },
};
function apriGuida(){
  if (!attiva) return;
  const g = GUIDE[attiva];
  $('#g-guida-testo').innerHTML = `<h3>${t('Come si gioca')}</h3>
    <ul class="guida-gesti">${g.voci.map(v => `<li>${t(v)}</li>`).join('')}</ul>
    <p class="guida-nota">${t(g.nota)}</p>`;
  $('#g-guida').hidden = false;
}
function chiudiGuida(){ const g = $('#g-guida'); if (g) g.hidden = true; }

/* ═════════════════════════════ PUZZLE ═════════════════════════════════ */
const LIVELLI = {
  facile:    { n: 4, ruota: false, sagoma: .16, toll: .085, nome: 'Facile',    desc: '4 frammenti' },
  medio:     { n: 6, ruota: true,  sagoma: .12, toll: .07,  nome: 'Medio',     desc: '6 frammenti da girare' },
  difficile: { n: 9, ruota: true,  sagoma: .07, toll: .06,  nome: 'Difficile', desc: '9 frammenti da girare' },
};
let pzLivello = 'facile';
let pzScelta = '*';
let pzUltimo = null;
let pzGen = 0;
let st = null;                    // lo stato della partita in corso
let pzSuggT = 0;

/* si puo' scegliere fra tutte le epigrafi che hanno il modello compatto */
const LENTA = 45 * 1048576;
function pzCandidati(){
  return H.modelli().filter(m => m.epi);
}
function pzLente(m){ return m.pesante || (m.bytes || 0) > LENTA * 3; }

function pzEntra(){
  pzMostraScelta();
}
function pzEsci(){
  pzGen++;
  pzLibera();
  $('#pz-carico').hidden = true;
  $('#pz-fine').hidden = true;
}

function pzMostraScelta(){
  pzGen++;
  pzLibera();
  $('#g-stato').textContent = '';
  scriviTitolo();
  $('#pz-fine').hidden = true;
  $('#pz-carico').hidden = true;
  pzDisegnaScelta();
  $('#pz-scelta').hidden = false;
  $('#pz-scelta').scrollTop = 0;
}
function pzDisegnaScelta(){
  const lista = pzCandidati();
  const q = ($('#pz-cerca').value || '').trim().toLowerCase();
  const box = $('#pz-scelte');
  box.innerHTML = '';
  const voce = (id, testo, sotto, figura, lenta) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pz-scelta';
    b.setAttribute('aria-pressed', String(id === pzScelta));
    b.innerHTML = `<span class="pz-scelta-fig">${figura}${lenta ? `<em class="pz-peso">${t('pesante')}</em>` : ''}</span>
      <span class="pz-scelta-nome">${testo}</span>${sotto ? `<small class="pz-scelta-sede">${sotto}</small>` : ''}`;
    b.onclick = () => {
      pzScelta = id;
      box.querySelectorAll('.pz-scelta').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    };
    box.appendChild(b);
  };
  if (pzScelta !== '*' && !lista.some(m => m.id === pzScelta)) pzScelta = '*';
  if (!q) voce('*', t('A sorpresa'), '', `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 9a2.9 2.9 0 1 1 3.9 2.7c-.7.3-1.1.9-1.1 1.6v.7"/><path d="M12 17.6h.01"/></svg>`);
  let visti = 0;
  for (const m of lista){
    if (q && !(m.titolo + ' ' + (m.isic || '') + ' ' + (m.sede || '')).toLowerCase().includes(q)) continue;
    visti++;
    const src = H.anteprimaDi(m);
    voce(m.id, m.titolo, m.sede ? m.sede : t(m.gruppo || ''), src ? `<img src="${src}" alt="" loading="lazy" decoding="async">` : '', pzLente(m));
  }
  $('#pz-conta').textContent = lista.length ? String(lista.length) : '';
  const lv = $('#pz-livelli');
  lv.innerHTML = '';
  for (const [k, L] of Object.entries(LIVELLI)){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pz-livello';
    b.setAttribute('aria-pressed', String(k === pzLivello));
    b.innerHTML = `<b>${t(L.nome)}</b><small>${t(L.desc)}</small>`;
    b.onclick = () => { pzLivello = k; lv.querySelectorAll('.pz-livello').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    lv.appendChild(b);
  }
  $('#pz-vuoto').hidden = lista.length > 0;
  $('#pz-nessuna').hidden = !(lista.length && q && !visti);
  $('#pz-inizia').disabled = !lista.length;
}

function pzProgresso(f){
  const CIRC = 2 * Math.PI * 24;
  $('#pz-anello').style.strokeDashoffset = CIRC * (1 - f);
  $('#pz-perc').textContent = Math.round(f * 100) + '%';
}

async function pzAvvia(){
  const lista = pzCandidati();
  if (!lista.length) return;
  let m;
  if (pzScelta === '*'){
    // a sorpresa si pesca fra le pietre che si caricano in fretta
    let leggere = lista.filter(x => !pzLente(x)).sort((a, b) => (a.bytes || 0) - (b.bytes || 0));
    leggere = leggere.slice(0, Math.max(6, Math.ceil(leggere.length / 2)));
    if (!leggere.length) leggere = lista;
    const altri = leggere.filter(x => !pzUltimo || x.id !== pzUltimo.id);
    const pool = altri.length ? altri : leggere;
    m = pool[Math.floor(Math.random() * pool.length)];
  }else m = lista.find(x => x.id === pzScelta) || lista[0];
  pzUltimo = m;
  const gen = ++pzGen;
  pzLibera();
  $('#pz-scelta').hidden = true;
  $('#pz-fine').hidden = true;
  $('#pz-carico').hidden = false;
  $('#pz-carico-t').textContent = t('Sto spezzando la pietra');
  $('#pz-carico-t').classList.remove('rosso');
  $('#pz-carico-azioni').hidden = true;
  pzProgresso(0);
  let root = null, mappa = null;
  try{
    root = await H.leggiCompatto(m.epi, f => { if (gen === pzGen) pzProgresso(Math.min(.86, f * .86)); });
    if (gen !== pzGen){ pzButta(root); return; }
    if (m.tex){
      try{ mappa = await H.caricaTexture(m.tex); }catch(e){ mappa = null; }
    }
    if (gen !== pzGen){ pzButta(root); mappa && mappa.dispose(); return; }
    pzProgresso(.93);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));
    if (gen !== pzGen){ pzButta(root); mappa && mappa.dispose(); return; }
    pzCostruisci(m, root, mappa, LIVELLI[pzLivello]);
    pzProgresso(1);
    $('#pz-carico').hidden = true;
  }catch(e){
    console.error(e);
    if (gen !== pzGen) return;
    $('#pz-carico-t').textContent = t('Questa pietra non si carica');
    $('#pz-carico-t').classList.add('rosso');
    $('#pz-carico-azioni').hidden = false;
  }
}

function pzButta(root){
  if (!root) return;
  root.traverse(o => { if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
}

/* ── la frattura ───────────────────────────────────────────────────────
   La pietra si guarda di fronte, con l'orientamento dell'archivio. Nel
   piano dello schermo si spargono n punti (una griglia smossa a caso) e
   ogni triangolo del rilievo va al punto piu' vicino; prima pero' la sua
   posizione viene "storta" con un rumore, cosi' le linee di frattura non
   sono dritte ma frastagliate come quelle di una pietra rotta davvero. */
function pzSemi(n, b){
  const bw = b.max.x - b.min.x, bh = b.max.y - b.min.y;
  const a = bw / Math.max(bh, 1e-6);
  const righe = Math.max(1, Math.round(Math.sqrt(n / a)));
  const colonne = Math.ceil(n / righe);
  const celle = [];
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) celle.push([r, c]);
  mescola(celle);
  return celle.slice(0, n).map(([r, c]) => ({
    x: b.min.x + (c + .5 + caso(-.32, .32)) * bw / colonne,
    y: b.min.y + (r + .5 + caso(-.32, .32)) * bh / righe,
  }));
}

function pzCostruisci(m, root, mappa, L){
  const mesh = root.children.find(o => o.isMesh);
  const geo = mesh.geometry;
  mesh.material.dispose();
  const c0 = H.centroRobusto(root);
  const qs = H.orientamentoSalvato(m);

  const P = geo.getAttribute('position').array;
  const nv = P.length / 3;
  const W = new Float32Array(nv * 3);
  const v = new THREE.Vector3();
  const bb = new THREE.Box3();
  for (let i = 0; i < nv; i++){
    v.set(P[3 * i] - c0.x, P[3 * i + 1] - c0.y, P[3 * i + 2] - c0.z).applyQuaternion(qs);
    W[3 * i] = v.x; W[3 * i + 1] = v.y; W[3 * i + 2] = v.z;
    bb.expandByPoint(v);
  }
  const idx = geo.index.array;
  const nt = idx.length / 3;
  const bw = bb.max.x - bb.min.x, bh = bb.max.y - bb.min.y;
  const S = Math.max(bw, bh);
  const spessore = Math.max(bb.max.z - bb.min.z, S * .02);

  // baricentri dei triangoli, gia' storti dal rumore
  const seme = Math.floor(Math.random() * 1e6);
  const amp = S * .075, freq = 3.1 / S;
  const tx = new Float32Array(nt), ty = new Float32Array(nt);
  for (let t = 0; t < nt; t++){
    const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
    const x = (W[a] + W[b] + W[c]) / 3, y = (W[a + 1] + W[b + 1] + W[c + 1]) / 3;
    tx[t] = x + amp * (frattale(x * freq, y * freq, seme, 3) * 2 - 1);
    ty[t] = y + amp * (frattale(x * freq + 17.3, y * freq - 9.1, seme + 5, 3) * 2 - 1);
  }

  let semi = pzSemi(L.n, bb);
  const cella = new Uint8Array(nt);
  let conta = [];
  const assegna = () => {
    conta = new Array(semi.length).fill(0);
    for (let t = 0; t < nt; t++){
      let best = 0, bd = Infinity;
      for (let k = 0; k < semi.length; k++){
        const dx = tx[t] - semi[k].x, dy = ty[t] - semi[k].y;
        const d = dx * dx + dy * dy;
        if (d < bd){ bd = d; best = k; }
      }
      cella[t] = best; conta[best]++;
    }
  };
  // i frammenti troppo piccoli (semi caduti fuori dalla pietra) si tolgono,
  // e al loro posto si spacca il frammento piu' grande
  for (let giro = 0; giro < 8; giro++){
    assegna();
    const minimo = nt / L.n * .3;
    const buoni = semi.filter((s, k) => conta[k] >= minimo);
    if (buoni.length === semi.length && semi.length >= L.n) break;
    semi = buoni.length >= 1 ? buoni : semi;
    if (semi.length < L.n){
      assegna();
      let grande = 0;
      conta.forEach((c, k) => { if (c > conta[grande]) grande = k; });
      // un triangolo lontano dal seme del frammento piu' grande
      let scelto = -1, lontano = -1;
      for (let prova = 0; prova < 400; prova++){
        const t = Math.floor(Math.random() * nt);
        if (cella[t] !== grande) continue;
        const d = Math.hypot(tx[t] - semi[grande].x, ty[t] - semi[grande].y);
        if (d > lontano){ lontano = d; scelto = t; }
      }
      if (scelto >= 0){
        const s = semi[grande];
        semi.push({ x: (s.x + tx[scelto]) / 2 + (tx[scelto] - s.x) * .15, y: (s.y + ty[scelto]) / 2 + (ty[scelto] - s.y) * .15 });
      }
    }
  }
  assegna();

  // gli indici di ogni frammento, e il suo ingombro
  const liste = semi.map((s, k) => new Uint32Array(conta[k] * 3));
  const riemp = new Array(semi.length).fill(0);
  const scatole = semi.map(() => new THREE.Box3());
  for (let t = 0; t < nt; t++){
    const k = cella[t];
    const L3 = liste[k];
    let o = riemp[k];
    for (let j = 0; j < 3; j++){
      const vi = idx[3 * t + j];
      L3[o++] = vi;
      v.set(W[3 * vi], W[3 * vi + 1], W[3 * vi + 2]);
      scatole[k].expandByPoint(v);
    }
    riemp[k] = o;
  }

  // la scena
  const sc = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 1e6);
  const amb = new THREE.HemisphereLight(0xeef2f8, 0x3a3024, 1.15);
  const key = new THREE.DirectionalLight(0xfff2df, 2.1);
  const fil = new THREE.DirectionalLight(0xc9d6ea, .45);
  key.position.set(-.55, .75, 1);
  fil.position.set(.8, -.3, .7);
  sc.add(amb, key, fil);
  const gruppo = new THREE.Group();
  sc.add(gruppo);

  // la sagoma: la pietra intera, schiacciata e in ombra, dove vanno i pezzi
  const piatta = (materiale) => {
    const g = new THREE.Group();
    g.scale.z = .001;
    g.position.z = bb.min.z - spessore;
    const o = new THREE.Group(); o.quaternion.copy(qs);
    const ms = new THREE.Mesh(geo, materiale);
    ms.position.copy(c0).negate();
    o.add(ms); g.add(o);
    ms.renderOrder = -1;
    return g;
  };
  const inchiostro = new THREE.Color(colore('--inchiostro') || '#020304');
  const sagoma = piatta(new THREE.MeshBasicMaterial({ color: inchiostro, transparent: true, opacity: L.sagoma, depthWrite: false }));
  const sbirciata = piatta(new THREE.MeshBasicMaterial({ map: mappa, color: mappa ? 0xffffff : 0xbdb8ae, transparent: true, opacity: 0, depthWrite: false }));
  sbirciata.position.z += spessore * .1;
  sbirciata.visible = false;
  gruppo.add(sagoma, sbirciata);

  const pezzi = [];
  semi.forEach((s, k) => {
    if (!conta[k]) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.getAttribute('position'));
    if (geo.getAttribute('uv')) g.setAttribute('uv', geo.getAttribute('uv'));
    if (geo.getAttribute('normal')) g.setAttribute('normal', geo.getAttribute('normal'));
    g.setIndex(new THREE.BufferAttribute(liste[k], 1));
    g.boundingSphere = geo.boundingSphere || (geo.computeBoundingSphere(), geo.boundingSphere);
    const mat = new THREE.MeshPhongMaterial({
      map: mappa, color: mappa ? 0xffffff : 0xd6cec1,
      shininess: 6, specular: 0x121212, side: THREE.DoubleSide,
      emissive: 0x000000,
    });
    const ms = new THREE.Mesh(g, mat);
    ms.position.copy(c0).negate();
    const orient = new THREE.Group(); orient.quaternion.copy(qs); orient.add(ms);
    const b = scatole[k];
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    const dentro = new THREE.Group(); dentro.position.set(-cx, -cy, 0); dentro.add(orient);
    const p = new THREE.Group(); p.add(dentro);
    const r = Math.hypot(Math.max(b.max.x - cx, cx - b.min.x), Math.max(b.max.y - cy, cy - b.min.y));
    p.userData = { cx, cy, r, giro: 0, posto: false, lampo: 0, anim: null };
    ms.userData.pezzo = p;
    gruppo.add(p);
    pezzi.push(p);
  });

  st = {
    m, L, sc, cam, gruppo, pezzi, sagoma, sbirciata, geo, mappa,
    bb, S, spessore, strato: 0, posti: 0, mosse: 0, t0: 0, fine: 0,
    finito: false, drag: null, puntatore: null, sel: null, sbircia: 0,
    raggio: new THREE.Raycaster(),
    toll: S * L.toll,
  };
  const box = $('#pz-palco');
  montaMotore(box);
  pzInquadra();
  pzSpargi(pezzi);
  pzStato();
  $('#pz-ruota').hidden = !L.ruota;
  $('#pz-sugg').textContent = L.ruota
    ? t('Trascina i frammenti sulla sagoma. Toccali per girarli.')
    : t('Trascina i frammenti sulla sagoma.');
  $('#pz-sugg').classList.remove('via');
  clearTimeout(pzSuggT);
  pzSuggT = setTimeout(() => $('#pz-sugg').classList.add('via'), 7000);
  $('#g-s').textContent = m.titolo + (m.sede ? ' · ' + m.sede : '');
}

/* l'inquadratura: la sagoma al centro, intorno lo spazio per i frammenti */
function pzInquadra(){
  if (!st) return;
  const box = $('#pz-palco');
  if (!misuraMotore(box)) return;
  const a = box.clientWidth / box.clientHeight;
  const b = st.bb;
  const bw = b.max.x - b.min.x, bh = b.max.y - b.min.y;
  // in verticale (telefono, totem) i frammenti stanno sopra e sotto: la
  // sagoma puo' prendere piu' larghezza, e i pezzi restano grandi per le dita
  const k = a < .85 ? 1.6 : 1.95;
  const Vh = Math.max(bh * 1.95, bw * k / a) * 1.04;
  const Vw = Vh * a;
  const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
  const c = st.cam;
  c.left = -Vw / 2; c.right = Vw / 2; c.top = Vh / 2; c.bottom = -Vh / 2;
  c.position.set(cx, cy - Vh * .01, b.max.z + st.spessore * 400 + st.S * 4);
  c.near = 1e-3; c.far = st.spessore * 900 + st.S * 20;
  c.lookAt(cx, cy - Vh * .01, 0);
  c.updateProjectionMatrix();
  st.vista = { l: cx - Vw / 2, r: cx + Vw / 2, b: cy - Vh * .01 - Vh / 2, t: cy - Vh * .01 + Vh / 2 };
  // se lo schermo e' cambiato (telefono girato) i frammenti rientrano
  for (const p of st.pezzi) if (!p.userData.posto) pzDentro(p);
}

function pzDentro(p){
  const v = st.vista, r = Math.min(p.userData.r * .9, (v.r - v.l) * .45, (v.t - v.b) * .45);
  p.position.x = Math.min(v.r - r, Math.max(v.l + r, p.position.x));
  p.position.y = Math.min(v.t - r, Math.max(v.b + r, p.position.y));
}

function pzNuovoStrato(){
  st.strato++;
  return st.spessore * (1.3 + st.strato * 1.08);
}

/* i frammenti si spargono attorno alla sagoma, senza coprirla e senza
   finire uno sull'altro, finche' c'e' posto */
function pzSpargi(lista){
  const v = st.vista, b = st.bb;
  const g = st.S * .02;
  const T = { l: b.min.x - g, r: b.max.x + g, b: b.min.y - g, t: b.max.y + g };
  const messi = st.pezzi.filter(p => p.userData.posto || !lista.includes(p));
  for (const p of mescola(lista.slice())){
    const r = p.userData.r;
    const rx = Math.min(r * .95, (v.r - v.l) * .45), ry = Math.min(r * .95, (v.t - v.b) * .45);
    const alto = v.t - (v.t - v.b) * .07;          // la fascia del suggerimento resta libera
    let best = null, bs = Infinity;
    for (let t = 0; t < 600 && bs > 0; t++){
      const x = caso(v.l + rx, v.r - rx), y = caso(v.b + ry, Math.max(v.b + ry, alto - ry));
      const dx = Math.max(T.l - x, 0, x - T.r), dy = Math.max(T.b - y, 0, y - T.t);
      const suSagoma = Math.max(0, r * .78 - Math.hypot(dx, dy));
      let suAltri = 0;
      for (const q of messi){
        if (q.userData.posto) continue;
        suAltri += Math.max(0, (r + q.userData.r) * .78 - Math.hypot(x - q.position.x, y - q.position.y));
      }
      const s = suSagoma * (t < 400 ? 3 : .4) + suAltri;
      if (s < bs){ bs = s; best = { x, y }; }
    }
    p.position.set(best.x, best.y, pzNuovoStrato());
    const u = p.userData;
    if (st.L.ruota){
      u.giro = Math.random() < .88 ? 1 + Math.floor(Math.random() * 3) : 0;
      p.rotation.z = u.giro * Math.PI / 2;
    }else{ u.giro = 0; p.rotation.z = 0; }
    // e se per caso fosse gia' al suo posto, lo si sposta un po'
    if (Math.hypot(p.position.x - u.cx, p.position.y - u.cy) < st.toll * 1.5 && u.giro % 4 === 0){
      p.position.x += (p.position.x > u.cx ? 1 : -1) * st.toll * 3;
      pzDentro(p);
    }
    messi.push(p);
  }
}

function pzStato(){
  if (!st) return;
  const tot = st.pezzi.length;
  const sec = st.t0 ? Math.floor(((st.fine || performance.now()) - st.t0) / 1000) : 0;
  const tempo = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  $('#g-stato').innerHTML =
    `<span title="${t('Frammenti al loro posto')}"><b>${st.posti}</b>/${tot}</span>` +
    `<span class="g-stato-ext" title="${t('Mosse')}">${t('mosse')} <b>${st.mosse}</b></span>` +
    `<span title="${t('Tempo')}">${tempo}</span>`;
}

/* ── i gesti ─────────────────────────────────────────────────────────── */
function pzMondo(e){
  const r = $('#pz-palco').getBoundingClientRect();
  const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
  const c = st.cam;
  return {
    x: c.position.x + c.left + nx * (c.right - c.left),
    y: c.position.y + c.top - ny * (c.top - c.bottom),
    nx: nx * 2 - 1, ny: -(ny * 2 - 1),
  };
}
function pzColpisci(e){
  const w = pzMondo(e);
  st.raggio.setFromCamera(new THREE.Vector2(w.nx, w.ny), st.cam);
  const liberi = st.pezzi.filter(p => !p.userData.posto).map(p => p.children[0].children[0].children[0]);
  const hit = st.raggio.intersectObjects(liberi, false);
  return hit.length ? hit[0].object.userData.pezzo : null;
}
function pzSeleziona(p){
  st.sel = p;
}

function pzGiu(e){
  if (!st || st.finito || (e.button !== undefined && e.button > 0)) return;
  if (st.puntatore !== null) return;                 // un dito alla volta
  const p = pzColpisci(e);
  if (!p) return;
  e.preventDefault();
  st.puntatore = e.pointerId;
  try{ $('#pz-palco').setPointerCapture(e.pointerId); }catch(_){}
  const w = pzMondo(e);
  st.drag = { p, dx: p.position.x - w.x, dy: p.position.y - w.y, x0: e.clientX, y0: e.clientY, t0: performance.now(), mosso: false };
  p.position.z = pzNuovoStrato();
  p.userData.anim = null;
  pzSeleziona(p);
  p.userData.alza = 1;
  $('#pz-palco').classList.add('presa');
  $('#pz-sugg').classList.add('via');
  if (!st.t0){ st.t0 = performance.now(); }
}
function pzMuovi(e){
  if (!st) return;
  if (!st.drag || e.pointerId !== st.puntatore){
    // col mouse la manina dice che quel pezzo si puo' prendere
    if (e.pointerType === 'mouse' && !st.finito){
      const ora = performance.now();
      if (ora - (st._ultimoHover || 0) > 90){
        st._ultimoHover = ora;
        $('#pz-palco').classList.toggle('sopra', !!pzColpisci(e));
      }
    }
    return;
  }
  const d = st.drag, w = pzMondo(e);
  if (!d.mosso && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 7) d.mosso = true;
  if (!d.mosso) return;
  d.p.position.x = w.x + d.dx;
  d.p.position.y = w.y + d.dy;
  pzDentro(d.p);
}
function pzSu(e){
  if (!st || e.pointerId !== st.puntatore) return;
  const d = st.drag;
  st.drag = null; st.puntatore = null;
  $('#pz-palco').classList.remove('presa');
  if (!d) return;
  d.p.userData.alza = 0;
  if (!d.mosso && performance.now() - d.t0 < 450){
    if (st.L.ruota) pzRuota(d.p);
  }else if (d.mosso){
    st.mosse++;
    pzVerifica(d.p);
  }
  pzStato();
}
function pzRuota(p){
  if (!p || p.userData.posto) return;
  p.userData.giro++;
  st.mosse++;
  if (!st.t0) st.t0 = performance.now();
  pzVerifica(p);
  pzStato();
}
function pzVerifica(p){
  const u = p.userData;
  if (u.posto) return;
  const d = Math.hypot(p.position.x - u.cx, p.position.y - u.cy);
  if (((u.giro % 4) + 4) % 4 !== 0 || d > st.toll) return;
  u.posto = true;
  const giri = Math.round(p.rotation.z / (Math.PI * 2));
  u.anim = { da: p.position.clone(), a: new THREE.Vector3(u.cx, u.cy, 0), r0: p.rotation.z, r1: giri * Math.PI * 2, t0: performance.now(), dur: 240 };
  u.giro = giri * 4;
  u.lampo = 1;
  st.posti++;
  if (st.sel === p) st.sel = null;
  $('#pz-sugg').classList.add('via');
  try{ navigator.vibrate && navigator.vibrate(18); }catch(_){}
  if (st.posti === st.pezzi.length) setTimeout(pzFinito, 420);
}

function pzFinito(){
  if (!st || st.finito) return;
  st.finito = true;
  st.fine = performance.now();
  if (!st.t0) st.t0 = st.fine;
  st.festa = performance.now();
  pzStato();
  pzFinitoTesti();
  setTimeout(() => { if (st && st.finito) $('#pz-fine').hidden = false; }, 2400);
}
function pzFinitoTesti(){
  const sec = Math.floor((st.fine - st.t0) / 1000);
  $('#pz-fine-nome').textContent = st.m.titolo;
  $('#pz-fine-sede').textContent = st.m.sede || '';
  $('#pz-fine-dati').innerHTML =
    `<span><b>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</b>${t('tempo')}</span>` +
    `<span><b>${st.mosse}</b>${t('mosse')}</span>` +
    `<span><b>${st.pezzi.length}</b>${t('frammenti')}</span>`;
}

/* ── ogni fotogramma ─────────────────────────────────────────────────── */
function pzFotogramma(dt, ora){
  if (!st || !rend) return;
  const k = 1 - Math.pow(.0008, dt);
  for (const p of st.pezzi){
    const u = p.userData;
    if (u.anim){
      const f = Math.min(1, (ora - u.anim.t0) / u.anim.dur);
      const e = 1 - Math.pow(1 - f, 3);
      p.position.lerpVectors(u.anim.da, u.anim.a, e);
      p.rotation.z = u.anim.r0 + (u.anim.r1 - u.anim.r0) * e;
      if (f >= 1) u.anim = null;
    }else if (!u.posto){
      p.rotation.z += (u.giro * Math.PI / 2 - p.rotation.z) * k;
    }
    const ms = p.children[0].children[0].children[0];
    const acceso = (st.drag && st.drag.p === p) ? .10 : 0;
    if (u.lampo > 0) u.lampo = Math.max(0, u.lampo - dt * 1.8);
    const e = Math.max(acceso, u.lampo * .35);
    ms.material.emissive.setRGB(e * .35, e, e * .6);
    const s = 1 + (u.alza ? .035 : 0);
    p.scale.x += (s - p.scale.x) * k; p.scale.y = p.scale.x;
  }
  // sbircia: la pietra intera compare e svanisce
  if (st.sbircia){
    const f = (ora - st.sbircia) / 2600;
    const o = f < .15 ? f / .15 : f < .75 ? 1 : Math.max(0, 1 - (f - .75) / .25);
    st.sbirciata.visible = o > 0;
    st.sbirciata.children[0].children[0].material.opacity = o * .72;
    if (f >= 1){ st.sbircia = 0; st.sbirciata.visible = false; }
  }
  // festa: la pietra ricomposta si mostra girando un poco
  if (st.finito){
    const f = (ora - st.festa) / 1000;
    st.sagoma.visible = false;
    st.gruppo.rotation.y = Math.sin(f * 1.4) * .5 * Math.min(1, f / .8);
  }
  if (st.t0 && !st.finito && Math.floor(ora / 500) !== st._ultimoSec){ st._ultimoSec = Math.floor(ora / 500); pzStato(); }
  rend.render(st.sc, st.cam);
}

function pzLibera(){
  if (!st) return;
  for (const p of st.pezzi){
    const ms = p.children[0].children[0].children[0];
    ms.material.dispose();
    ms.geometry.dispose();
  }
  st.sagoma.children[0].children[0].material.dispose();
  st.sbirciata.children[0].children[0].material.dispose();
  st.geo.dispose();
  st.mappa && st.mappa.dispose();
  st = null;
  if (rend) rend.clear();
}

/* ═════════════════════════════ LAPICIDA ═══════════════════════════════
   Il disegno sta su una tela 2D in coordinate "di bottega" (pixel della
   pietra), e ogni cosa incisa (lettere, tratti, segni) e' un oggetto: si
   puo' spostare, annullare, e alla fine diventa rilievo nella vista 3D. */
const MARGINE = 46;
const FAMIGLIA = '"DM Sans", ui-sans-serif, sans-serif';
const RETT = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/* un arco a tutto sesto sopra un rettangolo, rientrato di d */
function ARCO(w, h, r, d, n = 40){
  const p = [[d, h - d], [d, r]];
  for (let i = 1; i < n; i++){
    const a = Math.PI + i / n * Math.PI;
    p.push([r + Math.cos(a) * (r - d), r + Math.sin(a) * (r - d)]);
  }
  p.push([w - d, r], [w - d, h - d]);
  return p;
}
/* mezzo cerchio sopra una linea: il rotolo del pulvino visto di fronte */
const ARCO_SOPRA = (cx, cy, r, n = 18) => Array.from({ length: n + 1 }, (_, i) =>
  [cx - r * Math.cos(i / n * Math.PI), cy - r * Math.sin(i / n * Math.PI)]);
const CERCHIO = (cx, cy, r, n = 72) => Array.from({ length: n }, (_, i) =>
  [cx + Math.cos(i / n * Math.PI * 2) * r, cy + Math.sin(i / n * Math.PI * 2) * r]);

const SUPPORTI = {
  lastra: {
    nome: 'Lastra', w: 1100, h: 760,
    punti: RETT(0, 0, 1100, 760),
    campo: [96, 96, 908, 568],
    telaio: [RETT(38, 38, 1062, 722), RETT(58, 58, 1042, 702)],
    extra: [], fori: [],
  },
  tabula: {
    nome: 'Tabula ansata', w: 1200, h: 700,
    punti: [[170, 40], [1030, 40], [1030, 220], [1175, 95], [1175, 605], [1030, 480], [1030, 660], [170, 660], [170, 480], [25, 605], [25, 95], [170, 220]],
    campo: [232, 104, 736, 492],
    telaio: [RETT(205, 75, 995, 625), RETT(222, 92, 978, 608)],
    extra: [{ p: [[168, 250], [60, 158], [60, 542], [168, 450]], chiusa: true },
            { p: [[1032, 250], [1140, 158], [1140, 542], [1032, 450]], chiusa: true }],
    fori: [[96, 350], [1104, 350]],
  },
  stele: {
    // la stele greca ed ellenistica: si restringe verso l'alto, frontone
    // con tre acroteri, e una cornice sotto il timpano
    nome: 'Stele a frontone', w: 800, h: 1130,
    punti: [[40, 1130], [70, 390], [48, 390], [48, 340], [60, 340], [44, 282], [110, 312], [380, 176], [372, 150], [400, 100],
            [428, 150], [420, 176], [690, 312], [756, 282], [740, 340], [752, 340], [752, 390], [730, 390], [760, 1130]],
    campo: [110, 450, 580, 580],
    telaio: [RETT(95, 420, 705, 1090), RETT(111, 436, 689, 1074)],
    extra: [{ p: [[130, 318], [400, 190], [670, 318]], chiusa: true }, { p: [[60, 365], [740, 365]], chiusa: false }],
    fori: [],
  },
  centinata: {
    // la stele romana con la cima ad arco
    nome: 'Stele centinata', w: 760, h: 1080,
    punti: ARCO(760, 1080, 380, 0),
    campo: [110, 300, 540, 690],
    telaio: [ARCO(760, 1080, 380, 40), ARCO(760, 1080, 380, 56)],
    extra: [], fori: [],
  },
  ara: {
    // l'altare romano: zoccolo e coronamento modanati, e in alto i due pulvini
    nome: 'Ara', w: 860, h: 1100,
    punti: [...ARCO_SOPRA(130, 70, 90), ...ARCO_SOPRA(730, 70, 90), [820, 70], [820, 115], [860, 115], [860, 175], [770, 175], [770, 975], [860, 975], [860, 1040], [820, 1040], [820, 1100],
            [40, 1100], [40, 1040], [0, 1040], [0, 975], [90, 975], [90, 175], [0, 175], [0, 115], [40, 115], [40, 70]],
    campo: [150, 235, 560, 680],
    telaio: [RETT(120, 205, 740, 945), RETT(136, 221, 724, 929)],
    extra: [{ p: CERCHIO(130, 70, 34, 36), chiusa: true }, { p: CERCHIO(730, 70, 34, 36), chiusa: true },
            { p: [[40, 115], [820, 115]], chiusa: false }, { p: [[40, 1040], [820, 1040]], chiusa: false }],
    fori: [],
  },
};
const PIETRE = {
  marmo:      { nome: 'Marmo bianco',    base: [236, 232, 223], vena: [150, 150, 150], venatura: 1, grana: .05 },
  bardiglio:  { nome: 'Marmo grigio',    base: [172, 176, 180], vena: [88, 94, 102],   venatura: 1, grana: .07 },
  rosa:       { nome: 'Marmo rosa',      base: [230, 202, 193], vena: [164, 108, 102], venatura: 1, grana: .06 },
  cipollino:  { nome: 'Cipollino verde', base: [184, 199, 182], vena: [92, 124, 100],  venatura: 2, grana: .06 },
  travertino: { nome: 'Travertino',      base: [226, 213, 186], vena: [192, 174, 140], venatura: 0, grana: .1,  pori: true, bande: true },
  calcare:    { nome: 'Calcare',         base: [216, 199, 162], vena: [176, 156, 118], venatura: 0, grana: .13, pori: true },
  arenaria:   { nome: 'Arenaria',        base: [206, 166, 122], vena: [170, 128, 90],  venatura: 0, grana: .19, pori: true },
  lava:       { nome: 'Pietra lavica',   base: [84, 83, 84],    vena: [52, 52, 54],    venatura: 0, grana: .2,  pori: true, scura: true },
};
const COLORI = { incisa: 'Incisa', rossa: 'Cinabro', nera: 'Nera', blu: 'Blu egizio', oro: 'Oro' };
const STILI = { monumentale: 'Monumentale', elegante: 'Elegante', rustica: 'Rustica', arcaica: 'Arcaica' };
const ALLINEA = { left: 'A sinistra', center: 'Al centro', right: 'A destra' };
const CORNICI = { nessuna: 'Nessuna', semplice: 'Semplice', doppia: 'Doppia' };
const ALFABETI = { libero: 'Come scrivo', latino: 'Latino', greco: 'Greco' };

/* i segni decorativi, disegnati in un riquadro di 100 x 100 */
const SEGNI = {
  edera(c){
    c.beginPath();
    c.moveTo(0, 34);
    c.bezierCurveTo(-10, 22, -44, 6, -38, -18);
    c.bezierCurveTo(-33, -38, -8, -38, 0, -20);
    c.bezierCurveTo(8, -38, 33, -38, 38, -18);
    c.bezierCurveTo(44, 6, 10, 22, 0, 34);
    c.closePath(); c.fill();
    c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 32); c.bezierCurveTo(3, 46, 24, 50, 30, 38); c.stroke();
  },
  rosetta(c){
    c.lineWidth = 4.5;
    c.beginPath(); c.arc(0, 0, 45, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 6; k++){
      const a = k * Math.PI / 3;
      c.beginPath(); c.arc(Math.cos(a) * 22, Math.sin(a) * 22, 22, a + Math.PI * 2 / 3, a + Math.PI * 4 / 3); c.stroke();
    }
    c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
  },
  corona(c){
    for (const lato of [-1, 1]){
      for (let i = 0; i < 8; i++){
        const a = (Math.PI / 2) + lato * (0.35 + i * 0.33);
        const x = Math.cos(a) * 36, y = Math.sin(a) * 36;
        c.save(); c.translate(x, y); c.rotate(a + lato * Math.PI / 2 + lato * .5);
        c.beginPath(); c.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      c.lineWidth = 3.5;
      c.beginPath(); c.arc(0, 0, 36, Math.PI / 2 + lato * .25, Math.PI / 2 + lato * 2.95, lato < 0); c.stroke();
    }
    c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 38); c.lineTo(-12, 52); c.moveTo(0, 38); c.lineTo(12, 52); c.stroke();
  },
  palma(c){
    c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 48); c.quadraticCurveTo(6, 0, 0, -48); c.stroke();
    c.lineWidth = 4;
    for (let i = 0; i < 9; i++){
      const y = 38 - i * 10, l = 30 * (1 - i / 11);
      c.beginPath(); c.moveTo(2, y); c.lineTo(2 + l, y - 13); c.moveTo(2, y); c.lineTo(2 - l, y - 13); c.stroke();
    }
  },
  stella(c){
    c.beginPath();
    for (let k = 0; k < 16; k++){
      const a = k * Math.PI / 8 - Math.PI / 2, r = k % 2 ? 17 : 47;
      k ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill();
  },
  spirale(c){
    c.lineWidth = 5.5; c.lineCap = 'round';
    for (const lato of [-1, 1]){
      c.beginPath();
      for (let i = 0; i <= 60; i++){
        const a = i / 60 * Math.PI * 3.2, r = 24 - i / 60 * 20;
        const x = lato * 24 + Math.cos(a) * r * lato, y = Math.sin(a) * r;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    c.beginPath(); c.moveTo(-48, 0); c.lineTo(48, 0); c.stroke();
  },
  delfino(c){
    c.beginPath();
    c.moveTo(50, 0);
    c.bezierCurveTo(40, -6, 30, -18, 10, -20);
    c.bezierCurveTo(-10, -22, -28, -14, -38, -2);
    c.lineTo(-50, -14); c.lineTo(-45, 2); c.lineTo(-52, 16); c.lineTo(-36, 8);
    c.bezierCurveTo(-24, 14, 0, 16, 22, 10);
    c.bezierCurveTo(32, 7, 40, 4, 50, 0);
    c.closePath(); c.fill();
    c.beginPath(); c.moveTo(2, -19); c.quadraticCurveTo(-3, -34, -15, -37); c.quadraticCurveTo(-9, -27, -11, -18); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(12, 10); c.quadraticCurveTo(6, 22, -3, 25); c.quadraticCurveTo(3, 17, 3, 11); c.closePath(); c.fill();
  },
  alloro(c){
    c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-50, 0); c.lineTo(50, 0); c.stroke();
    for (let i = -4; i <= 4; i++){
      for (const lato of [-1, 1]){
        c.save(); c.translate(i * 11, 0); c.rotate(lato * -.7);
        c.beginPath(); c.ellipse(0, lato * -9, 4.5, 10, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
  },
  meandro(c){
    c.lineWidth = 5; c.lineJoin = 'miter'; c.lineCap = 'square';
    c.beginPath(); c.moveTo(-50, 20); c.lineTo(50, 20); c.stroke();
    for (let k = 0; k < 3; k++){
      const x = -46 + k * 32;
      c.beginPath();
      c.moveTo(x, 20); c.lineTo(x, -18); c.lineTo(x + 24, -18); c.lineTo(x + 24, 6); c.lineTo(x + 10, 6); c.lineTo(x + 10, -6);
      c.stroke();
    }
  },
};
const NOMI_SEGNI = {
  edera: 'Foglia d\'edera', rosetta: 'Rosetta', corona: 'Corona', palma: 'Ramo di palma',
  stella: 'Stella', spirale: 'Volute', delfino: 'Delfino', alloro: 'Ramo d\'alloro', meandro: 'Meandro',
};

let lp = null;
function lpStato(){
  if (lp) return lp;
  lp = {
    supporto: 'lastra', pietra: 'marmo', cornice: 'doppia', usura: 0, profondita: 1, guide: false,
    testo: { tipo: 'testo', righe: '', x: 0, y: 0, dim: 96, colore: 'incisa', alfabeto: 'libero',
             stile: 'monumentale', allinea: 'center', spaziatura: .08, interlinea: 1.2 },
    oggetti: [], storia: [],
    strumento: 'mano', colore: 'incisa', spess: 12, dimSegno: 1.6, angSegno: 0,
    sel: null, live: null, trasc: null, puntatore: null,
    tela: null, ctx: null, pietraC: null, cacheC: null, maschera: null, tmp: null, erosione: null,
    seme: Math.floor(Math.random() * 1e6),
  };
  const f = SUPPORTI[lp.supporto].campo;
  lp.testo.x = MARGINE + f[0] + f[2] / 2;
  lp.testo.y = MARGINE + f[1] + f[3] / 2;
  return lp;
}
const tela2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function lpEntra(){
  lpStato();
  lp.tela = $('#lp-tela');
  lp.ctx = lp.tela.getContext('2d');
  lpPreparaPannello();
  lpRifaiPietra();
  lpMisura();
  $('#lp-3d').hidden = true;
}
function lpEsci(){
  lpChiudi3d();
  if (lp){ lp.trasc = lp.live = null; lp.puntatore = null; }
}
function lpFotogramma(){
  if (lp && lp.v3 && rend){
    lp.v3.ctrl.update();
    rend.render(lp.v3.sc, lp.v3.cam);
  }
}

function lpDimensioni(){
  const s = SUPPORTI[lp.supporto];
  return { W: s.w + MARGINE * 2, H: s.h + MARGINE * 2 };
}
function lpContorno(){
  const s = SUPPORTI[lp.supporto];
  const p = new Path2D();
  s.punti.forEach(([x, y], i) => i ? p.lineTo(x + MARGINE, y + MARGINE) : p.moveTo(x + MARGINE, y + MARGINE));
  p.closePath();
  return p;
}

/* la tessitura della pietra, calcolata a meta' risoluzione e poi distesa */
function lpTessitura(W, H){
  const p = PIETRE[lp.pietra];
  const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
  const c = tela2d(w, h);
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, h);
  const d = img.data;
  const s = lp.seme;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const n = frattale(x / 85, y / 85, s, 4);
      const g = hash(x, y, s + 7);
      let k = 1 + (n - .5) * .2 + (g - .5) * p.grana;
      let vena = 0;
      if (p.venatura === 1){
        // venature lunghe e oblique, appena mosse, che compaiono e svaniscono
        const t1 = Math.sin((x * .8 + y * .5) / w * Math.PI * 1.7 + frattale(x / 120, y / 120, s + 3, 5) * 3.4);
        const filo = Math.pow(1 - Math.abs(t1), 28);
        const t2 = Math.sin((x * .35 - y * .9) / w * Math.PI * 1.1 + frattale(x / 90, y / 90, s + 9, 4) * 2.6);
        const filo2 = Math.pow(1 - Math.abs(t2), 60);
        const presenza = Math.max(0, frattale(x / 160, y / 160, s + 11, 2) - .38) * 1.9;
        vena = Math.min(1, (filo * .55 + filo2 * .35) * presenza);
      }else if (p.venatura === 2){
        // il cipollino: fasce ondulate e fitte
        const t1 = Math.sin(y / h * Math.PI * 16 + frattale(x / 70, y / 70, s + 3, 4) * 5 + x / w * 2);
        vena = Math.pow((t1 + 1) / 2, 5) * .7;
      }
      if (p.bande) k *= 1 + .07 * Math.sin(y / h * Math.PI * 34 + frattale(x / 50, y / 50, s + 13, 3) * 5);
      if (p.pori && g > .982) k *= .72;
      const i = (y * w + x) * 4;
      for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, p.base[j] * k * (1 - vena) + p.vena[j] * vena));
      d[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  return c;
}

/* le macchie del tempo: una patina irregolare, piu' scura negli incavi */
function lpPatina(W, H){
  const w = Math.ceil(W / 3), h = Math.ceil(H / 3);
  const c = tela2d(w, h);
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, h);
  const d = img.data, s = lp.seme + 41;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const n = frattale(x / 40, y / 40, s, 4);
    const a = Math.max(0, Math.min(1, (n - .42) * 2.4));
    const i = (y * w + x) * 4;
    d[i] = 118; d[i + 1] = 100; d[i + 2] = 74; d[i + 3] = a * 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}
/* l'erosione delle lettere: macchioline che si mangiano il solco */
function lpErosione(){
  const W = lp.tela.width, H = lp.tela.height;
  const chiave = W + 'x' + H + ':' + lp.seme;
  if (lp.erosione && lp.erosione._chiave === chiave) return lp.erosione;
  const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
  const c = tela2d(w, h);
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, h);
  const d = img.data, s = lp.seme + 21;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const n = frattale(x / 14, y / 14, s, 3);
    const g = hash(x, y, s + 3);
    const a = Math.max(0, Math.min(1, (n - .52) * 5)) + (g > .965 ? .9 : 0);
    const i = (y * w + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255);
  }
  cx.putImageData(img, 0, 0);
  c._chiave = chiave;
  lp.erosione = c;
  return c;
}

function lpCornici(m){
  const s = SUPPORTI[lp.supporto];
  m.strokeStyle = '#fff'; m.fillStyle = '#fff'; m.lineWidth = 5; m.lineJoin = 'miter';
  const linea = (punti, chiusa) => {
    m.beginPath();
    punti.forEach(([x, y], i) => i ? m.lineTo(x + MARGINE, y + MARGINE) : m.moveTo(x + MARGINE, y + MARGINE));
    if (chiusa) m.closePath();
    m.stroke();
  };
  if (lp.cornice !== 'nessuna'){
    linea(s.telaio[0], true);
    if (lp.cornice === 'doppia') linea(s.telaio[1], true);
    for (const e of s.extra) linea(e.p, e.chiusa);
  }
  for (const [x, y] of s.fori){ m.beginPath(); m.arc(x + MARGINE, y + MARGINE, 13, 0, Math.PI * 2); m.fill(); }
}

function lpRifaiPietra(){
  const { W, H } = lpDimensioni();
  lp.tela.width = W; lp.tela.height = H;
  for (const k of ['pietraC', 'cacheC', 'maschera', 'tmp']){
    if (!lp[k] || lp[k].width !== W || lp[k].height !== H) lp[k] = tela2d(W, H);
  }
  const cont = lpContorno();
  const p = PIETRE[lp.pietra];
  // la pietra si prepara a parte, senza ombra: cosi' le scheggiature
  // tolgono pietra e l'ombra, disegnata dopo, segue il bordo rotto
  const blocco = tela2d(W, H);
  const c = blocco.getContext('2d');
  c.save();
  c.clip(cont);
  c.imageSmoothingQuality = 'high';
  c.drawImage(lpTessitura(W, H), 0, 0, W, H);
  if (lp.usura > 0){
    c.globalAlpha = Math.min(.75, lp.usura * .7);
    c.globalCompositeOperation = p.scura ? 'source-over' : 'multiply';
    c.drawImage(lpPatina(W, H), 0, 0, W, H);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  // lo spigolo: un filo d'ombra lungo il bordo
  c.lineWidth = 14; c.strokeStyle = 'rgba(0,0,0,.10)'; c.stroke(cont);
  c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.16)'; c.stroke(cont);
  c.restore();
  // cornici e fori, incisi nella pietra
  const m = lp.maschera.getContext('2d');
  m.clearRect(0, 0, W, H);
  lpCornici(m);
  lpConsuma(m, 0, 0, W, H);
  const tc = lpTinta('incisa');
  lpIncidi(c, lp.maschera, p.scura ? tc
    : { fondo: 'rgba(70,52,34,.14)', ombra: 'rgba(28,18,8,.34)', luce: 'rgba(255,255,255,.7)' }, 2.2 * lp.profondita, null, cont);
  m.clearRect(0, 0, W, H);
  // con l'usura, gli spigoli scheggiati
  if (lp.usura > 0){
    const s = SUPPORTI[lp.supporto];
    c.save();
    c.globalCompositeOperation = 'destination-out';
    const pt = s.punti, n = pt.length;
    let k = 0;
    for (let i = 0; i < n; i++){
      const [x0, y0] = pt[i], [x1, y1] = pt[(i + 1) % n];
      const L = Math.hypot(x1 - x0, y1 - y0);
      for (let q = 0; q < L; q += 10){
        k++;
        if (hash(k, i, lp.seme) > lp.usura * .5) continue;
        const f = q / L;
        const r = 2 + hash(k, i + 7, lp.seme) * (3 + lp.usura * 11);
        c.beginPath();
        c.arc(MARGINE + x0 + (x1 - x0) * f, MARGINE + y0 + (y1 - y0) * f, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }
  const pc = lp.pietraC.getContext('2d');
  pc.clearRect(0, 0, W, H);
  pc.save();
  pc.shadowColor = 'rgba(0,0,0,.30)'; pc.shadowBlur = 34; pc.shadowOffsetY = 14;
  pc.drawImage(blocco, 0, 0);
  pc.restore();
  lpRicostruisci();
}

/* la resa dell'incisione: fondo del solco piu' scuro, la parete in alto a
   sinistra in ombra, quella in basso a destra illuminata. Si ottiene
   sottraendo alla forma una copia di se' stessa spostata. */
function lpTinta(col){
  const scura = PIETRE[lp.pietra].scura;
  if (col === 'rossa') return { fondo: 'rgba(170,30,20,.93)', ombra: 'rgba(55,6,2,.6)', luce: 'rgba(255,205,185,.38)' };
  if (col === 'nera')  return { fondo: 'rgba(26,22,20,.93)', ombra: 'rgba(0,0,0,.6)', luce: 'rgba(255,255,255,.22)' };
  if (col === 'blu')   return { fondo: 'rgba(36,76,160,.93)', ombra: 'rgba(6,18,58,.58)', luce: 'rgba(205,222,255,.4)' };
  if (col === 'oro')   return { fondo: 'rgba(200,154,50,.96)', ombra: 'rgba(92,58,6,.58)', luce: 'rgba(255,246,200,.75)' };
  return scura
    ? { fondo: 'rgba(255,255,255,.13)', ombra: 'rgba(0,0,0,.62)', luce: 'rgba(255,255,255,.26)' }
    : { fondo: 'rgba(70,52,34,.30)',   ombra: 'rgba(28,18,8,.58)', luce: 'rgba(255,255,255,.62)' };
}
function lpIncidi(dst, mask, tinta, d, area, clip){
  const W = mask.width, H = mask.height;
  let x = 0, y = 0, w = W, h = H;
  if (area){
    x = Math.max(0, Math.floor(area.x - d - 4)); y = Math.max(0, Math.floor(area.y - d - 4));
    w = Math.min(W, Math.ceil(area.x + area.w + d + 4)) - x; h = Math.min(H, Math.ceil(area.y + area.h + d + 4)) - y;
    if (w <= 0 || h <= 0) return;
  }
  const t = lp.tmp.getContext('2d');
  const passo = (colore, dx, dy) => {
    t.globalCompositeOperation = 'source-over';
    t.clearRect(x, y, w, h);
    t.drawImage(mask, x, y, w, h, x, y, w, h);
    if (dx || dy){
      t.globalCompositeOperation = 'destination-out';
      t.drawImage(mask, x, y, w, h, x + dx, y + dy, w, h);
    }
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = colore; t.fillRect(x, y, w, h);
    t.globalCompositeOperation = 'source-over';
    dst.drawImage(lp.tmp, x, y, w, h, x, y, w, h);
  };
  dst.save();
  if (clip) dst.clip(clip);
  passo(tinta.fondo, 0, 0);
  passo(tinta.ombra, d, d);
  passo(tinta.luce, -d, -d);
  dst.restore();
}

/* le lettere: come le scrivi, oppure alla latina o alla greca */
const GRECO = { A: 'Α', B: 'Β', C: 'Κ', D: 'Δ', E: 'Ε', F: 'Φ', G: 'Γ', H: 'Η', I: 'Ι', J: 'Ι', K: 'Κ', L: 'Λ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Π', Q: 'Κ', R: 'Ρ', S: 'Σ', T: 'Τ', U: 'Υ', V: 'Υ', W: 'Ω', X: 'Ξ', Y: 'Υ', Z: 'Ζ' };
function lpLettere(testo, alfabeto){
  let s = testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (alfabeto === 'latino'){
    s = s.replace(/W/g, 'VV').replace(/U/g, 'V').replace(/J/g, 'I');
    s = s.split('\n').map(r => r.trim().split(/\s+/).filter(Boolean).join(' · ')).join('\n');
  }else if (alfabeto === 'greco'){
    s = s.replace(/TH/g, 'Θ').replace(/PH/g, 'Φ').replace(/CH/g, 'Χ').replace(/PS/g, 'Ψ').replace(/KS/g, 'Ξ');
    s = s.replace(/[A-Z]/g, ch => GRECO[ch] || ch);
  }
  return s;
}

function lpFont(stile, dim){
  if (stile === 'elegante') return `400 ${dim}px ${FAMIGLIA}`;
  if (stile === 'rustica')  return `italic 400 ${dim}px ${FAMIGLIA}`;
  if (stile === 'arcaica')  return `500 ${dim}px ${FAMIGLIA}`;
  return `700 ${dim}px ${FAMIGLIA}`;
}

/* il testo si compone lettera per lettera, come fa il lapicida: cosi' la
   spaziatura e' sempre la stessa, e lo stile arcaico puo' storcere un poco
   ogni segno */
function lpComponi(m, o){
  const righe = lpLettere(o.righe, o.alfabeto).split('\n');
  if (!righe.some(r => r.trim())) return null;
  const f = SUPPORTI[lp.supporto].campo;
  const cond = o.stile === 'rustica' ? .84 : 1;
  const extra = o.stile === 'elegante' ? .06 : 0;
  const misura = dim => {
    m.font = lpFont(o.stile, dim);
    const sp = dim * (o.spaziatura + extra);
    return righe.map(r => {
      const l = [...r].map(ch => m.measureText(ch).width * cond);
      return { l, w: l.reduce((a, b) => a + b, 0) + sp * Math.max(0, l.length - 1), sp };
    });
  };
  let dim = o.dim;
  let mis = misura(dim);
  let larga = Math.max(...mis.map(r => r.w));
  const max = f[2] * .96;
  if (larga > max){ dim = dim * max / larga; mis = misura(dim); larga = Math.max(...mis.map(r => r.w)); }
  const lh = dim * o.interlinea;
  const y0 = o.y - (righe.length - 1) * lh / 2;
  return { righe, mis, dim, larga, lh, y0, cond };
}
function lpScriviTesto(m, o){
  const c = lpComponi(m, o);
  if (!c){ o._box = null; return null; }
  const { righe, mis, dim, larga, lh, y0, cond } = c;
  m.textAlign = 'center'; m.textBaseline = 'middle';
  righe.forEach((r, i) => {
    const { l, w, sp } = mis[i];
    let x = o.allinea === 'left' ? o.x - larga / 2 : o.allinea === 'right' ? o.x + larga / 2 - w : o.x - w / 2;
    const y = y0 + i * lh;
    [...r].forEach((ch, j) => {
      const cx = x + l[j] / 2;
      m.save();
      m.translate(cx, y);
      if (o.stile === 'arcaica'){
        m.rotate((hash(i, j, lp.seme) - .5) * .2);
        m.translate(0, (hash(j, i, lp.seme + 1) - .5) * dim * .1);
        const s = 1 + (hash(i + 3, j, lp.seme + 2) - .5) * .14;
        m.scale(s, s);
      }
      if (cond !== 1) m.scale(cond, 1);
      m.fillText(ch, 0, 0);
      m.restore();
      x += l[j] + sp;
    });
  });
  o._box = { x: o.x - larga / 2 - 12, y: y0 - lh / 2, w: larga + 24, h: righe.length * lh };
  o._d = Math.max(1.6, Math.min(4.2, dim * .038));
  o._guide = { x0: o.x - larga / 2 - dim * .3, x1: o.x + larga / 2 + dim * .3, y0, lh, n: righe.length, dim };
  return o._box;
}

function lpMascheraDi(m, o){
  m.fillStyle = '#fff'; m.strokeStyle = '#fff';
  m.lineCap = 'round'; m.lineJoin = 'round';
  if (o.tipo === 'testo') return lpScriviTesto(m, o);
  if (o.tipo === 'tratto'){
    const P = o.punti;
    const n = P.length / 3;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (let i = 0; i < n; i++){
      minx = Math.min(minx, P[3 * i]); maxx = Math.max(maxx, P[3 * i]);
      miny = Math.min(miny, P[3 * i + 1]); maxy = Math.max(maxy, P[3 * i + 1]);
    }
    const larg = w => o.spess * (.55 + .9 * (w || .5));
    if (n === 1){
      m.beginPath(); m.arc(P[0], P[1], larg(P[2]) / 2, 0, Math.PI * 2); m.fill();
    }else{
      let px = P[0], py = P[1];
      for (let i = 1; i < n; i++){
        const x = P[3 * i], y = P[3 * i + 1];
        const mx = (px + x) / 2, my = (py + y) / 2;
        m.lineWidth = larg(P[3 * i + 2]);
        m.beginPath();
        m.moveTo(i === 1 ? P[0] : (P[3 * (i - 2)] + px) / 2, i === 1 ? P[1] : (P[3 * (i - 2) + 1] + py) / 2);
        m.quadraticCurveTo(px, py, mx, my);
        m.stroke();
        px = x; py = y;
      }
      m.lineWidth = larg(P[3 * (n - 1) + 2]);
      m.beginPath(); m.moveTo((P[3 * (n - 2)] + px) / 2, (P[3 * (n - 2) + 1] + py) / 2); m.lineTo(px, py); m.stroke();
    }
    const g = o.spess * 1.5;
    o._box = { x: minx - g, y: miny - g, w: maxx - minx + 2 * g, h: maxy - miny + 2 * g };
    o._d = Math.max(1.4, Math.min(3.4, o.spess * .2));
    return o._box;
  }
  if (o.tipo === 'segno'){
    m.save();
    m.translate(o.x, o.y); m.rotate(o.ang || 0); m.scale(o.s, o.s);
    SEGNI[o.forma](m);
    m.restore();
    const r = 58 * o.s;
    o._box = { x: o.x - r, y: o.y - r, w: 2 * r, h: 2 * r };
    o._d = Math.max(1.6, Math.min(3.6, o.s * 2.2));
    return o._box;
  }
  return null;
}
/* l'usura si mangia i solchi */
function lpConsuma(m, x, y, w, h){
  if (lp.usura <= 0) return;
  const e = lpErosione();
  m.save();
  m.globalCompositeOperation = 'destination-out';
  m.globalAlpha = Math.min(1, lp.usura * 1.05);
  const sx = Math.max(0, Math.floor(x / 2)), sy = Math.max(0, Math.floor(y / 2));
  const sw = Math.min(e.width - sx, Math.ceil(w / 2) + 2), sh = Math.min(e.height - sy, Math.ceil(h / 2) + 2);
  if (sw > 0 && sh > 0) m.drawImage(e, sx, sy, sw, sh, sx * 2, sy * 2, sw * 2, sh * 2);
  m.restore();
}

function lpIncidiOggetto(dst, o){
  const m = lp.maschera.getContext('2d');
  const W = lp.maschera.width, H = lp.maschera.height;
  m.clearRect(0, 0, W, H);
  const box = lpMascheraDi(m, o);
  if (!box) return;
  lpConsuma(m, box.x - 8, box.y - 8, box.w + 16, box.h + 16);
  const cont = lpContorno();
  lpIncidi(dst, lp.maschera, lpTinta(o.colore), (o._d || 2.4) * lp.profondita, box, cont);
  m.clearRect(Math.max(0, box.x - 12), Math.max(0, box.y - 12), box.w + 24, box.h + 24);
  // le righe guida del lapicida, sottili, sopra e sotto ogni riga di testo
  if (o.tipo === 'testo' && lp.guide && o._guide){
    const g = o._guide;
    m.strokeStyle = '#fff'; m.lineWidth = 2.2; m.lineCap = 'butt';
    m.beginPath();
    for (let i = 0; i < g.n; i++){
      const yc = g.y0 + i * g.lh;
      for (const dy of [-g.dim * .37, g.dim * .37]){ m.moveTo(g.x0, yc + dy); m.lineTo(g.x1, yc + dy); }
    }
    m.stroke();
    const gb = { x: g.x0 - 4, y: g.y0 - g.lh, w: g.x1 - g.x0 + 8, h: g.n * g.lh + g.lh };
    lpIncidi(dst, lp.maschera, PIETRE[lp.pietra].scura ? lpTinta('incisa')
      : { fondo: 'rgba(70,52,34,.12)', ombra: 'rgba(28,18,8,.26)', luce: 'rgba(255,255,255,.5)' }, 1.1, gb, cont);
    m.clearRect(Math.max(0, gb.x - 8), Math.max(0, gb.y - 8), gb.w + 16, gb.h + 16);
  }
}

function lpRicostruisci(escluso){
  if (!lp.cacheC) return;
  const c = lp.cacheC.getContext('2d');
  c.clearRect(0, 0, lp.cacheC.width, lp.cacheC.height);
  c.drawImage(lp.pietraC, 0, 0);
  if (lp.testo !== escluso) lpIncidiOggetto(c, lp.testo);
  for (const o of lp.oggetti) if (o !== escluso) lpIncidiOggetto(c, o);
  lpDisegna();
}

function lpVuota(){ return !lp.testo.righe.trim() && !lp.oggetti.length; }

function lpDisegna(){
  if (!lp.cacheC || !lp.ctx) return;
  const c = lp.ctx, W = lp.tela.width, H = lp.tela.height;
  c.clearRect(0, 0, W, H);
  c.drawImage(lp.cacheC, 0, 0);
  const extra = lp.live || (lp.trasc && lp.trasc.o);
  if (extra) lpIncidiOggetto(c, extra);
  if (lpVuota()){
    const f = SUPPORTI[lp.supporto].campo;
    c.save();
    let dim = 34;
    c.font = `500 ${dim}px ${FAMIGLIA}`;
    const frase = t('Scrivi il tuo testo o disegna qui');
    const w = c.measureText(frase).width;
    if (w > f[2] * .95){ dim *= f[2] * .95 / w; c.font = `500 ${dim}px ${FAMIGLIA}`; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = PIETRE[lp.pietra].scura ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.32)';
    c.fillText(frase, MARGINE + f[0] + f[2] / 2, MARGINE + f[1] + f[3] / 2);
    c.restore();
  }
  if (lp.strumento === 'sposta' && lp.sel && lp.sel._box){
    const b = lp.sel._box;
    c.save();
    c.strokeStyle = '#00a769'; c.lineWidth = 3; c.setLineDash([12, 9]);
    c.strokeRect(b.x, b.y, b.w, b.h);
    c.restore();
  }
}

/* la tela sta tutta nel suo riquadro, qualunque sia lo schermo */
function lpMisura(){
  if (!lp || !lp.tela) return;
  const box = $('#lp-tela-box');
  const bw = box.clientWidth - 16, bh = box.clientHeight - 16;
  if (bw <= 0 || bh <= 0) return;
  const s = Math.min(bw / lp.tela.width, bh / lp.tela.height);
  lp.tela.style.width = Math.floor(lp.tela.width * s) + 'px';
  lp.tela.style.height = Math.floor(lp.tela.height * s) + 'px';
}

function lpPunto(e){
  const r = lp.tela.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * lp.tela.width / r.width,
    y: (e.clientY - r.top) * lp.tela.height / r.height,
    p: e.pointerType === 'pen' ? (e.pressure || .5) : .5,
  };
}
function lpSnap(){
  const T = lp.testo;
  lp.storia.push(JSON.stringify({ oggetti: lp.oggetti, testo: { x: T.x, y: T.y, dim: T.dim, colore: T.colore } },
    (k, v) => (k[0] === '_') ? undefined : v));
  if (lp.storia.length > 60) lp.storia.shift();
  $('#lp-annulla').disabled = false;
}
function lpAnnulla(){
  const s = lp.storia.pop();
  if (!s) return;
  const d = JSON.parse(s);
  lp.oggetti = d.oggetti;
  Object.assign(lp.testo, d.testo);
  lp.sel = null;
  $('#lp-annulla').disabled = !lp.storia.length;
  lpSincronizzaPannello();
  lpRicostruisci();
}
function lpColpisci(pt){
  for (let i = lp.oggetti.length - 1; i >= 0; i--){
    const o = lp.oggetti[i];
    if (o.tipo !== 'segno' || !o._box) continue;
    const b = o._box;
    if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return o;
  }
  const b = lp.testo._box;
  if (b && pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return lp.testo;
  return null;
}

function lpGiu(e){
  if (lp.puntatore !== null || (e.button !== undefined && e.button > 0)) return;
  const pt = lpPunto(e);
  e.preventDefault();
  if (lp.strumento.startsWith('segno:')){
    lpSnap();
    const o = { tipo: 'segno', forma: lp.strumento.slice(6), x: pt.x, y: pt.y, s: lp.dimSegno, ang: lp.angSegno * Math.PI / 180, colore: lp.colore };
    lp.oggetti.push(o);
    lp.sel = o;
    lpScegliStrumento('sposta');
    lpRicostruisci();
    return;
  }
  lp.puntatore = e.pointerId;
  try{ lp.tela.setPointerCapture(e.pointerId); }catch(_){}
  if (lp.strumento === 'mano'){
    lpSnap();
    lp.live = { tipo: 'tratto', punti: [pt.x, pt.y, pt.p], spess: lp.spess, colore: lp.colore };
    lpDisegna();
  }else if (lp.strumento === 'sposta'){
    const o = lpColpisci(pt);
    lp.sel = o;
    if (o){
      lpSnap();
      lp.trasc = { o, dx: o.x - pt.x, dy: o.y - pt.y };
      lpSincronizzaPannello();
      lpRicostruisci(o);
    }else{ lpSincronizzaPannello(); lpDisegna(); }
  }
}
function lpMuovi(e){
  if (e.pointerId !== lp.puntatore) return;
  const pt = lpPunto(e);
  if (lp.live){
    const P = lp.live.punti, n = P.length;
    if (Math.hypot(pt.x - P[n - 3], pt.y - P[n - 2]) < 2.2) return;
    const eventi = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    if (eventi.length > 1){
      for (const ev of eventi){ const q = lpPunto(ev); P.push(q.x, q.y, q.p); }
    }else P.push(pt.x, pt.y, pt.p);
    lpDisegna();
  }else if (lp.trasc){
    lp.trasc.o.x = pt.x + lp.trasc.dx;
    lp.trasc.o.y = pt.y + lp.trasc.dy;
    lpDisegna();
  }
}
function lpSu(e){
  if (e.pointerId !== lp.puntatore) return;
  lp.puntatore = null;
  if (lp.live){
    lp.oggetti.push(lp.live);
    lp.live = null;
    lpRicostruisci();
  }else if (lp.trasc){
    lp.trasc = null;
    lpRicostruisci();
  }
}

function lpAiuto(){
  const s = lp.strumento;
  $('#lp-aiuto').textContent = s === 'mano' ? t('Scrivi o disegna sulla pietra con il dito, la penna o il mouse')
    : s === 'sposta' ? t('Trascina il testo o un segno per spostarlo')
    : t('Tocca la pietra dove vuoi incidere il segno') + ': ' + t(NOMI_SEGNI[s.slice(6)]).toLowerCase();
}
function lpScegliStrumento(s){
  lp.strumento = s;
  $$('#g-lapicida [data-strumento]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.strumento === s)));
  $$('#lp-segni .lp-segno').forEach(b => b.setAttribute('aria-pressed', String('segno:' + b.dataset.forma === s)));
  lp.tela.dataset.strumento = s.startsWith('segno:') ? 'segno' : s;
  if (s !== 'sposta') lp.sel = null;
  lpAiuto();
  lpSincronizzaPannello();
  lpDisegna();
}

/* il cambio di supporto porta con se' quello che c'e' gia' inciso */
function lpCambiaSupporto(nuovo){
  if (nuovo === lp.supporto) return;
  const a = SUPPORTI[lp.supporto].campo, b = SUPPORTI[nuovo].campo;
  const mx = x => MARGINE + b[0] + (x - MARGINE - a[0]) * b[2] / a[2];
  const my = y => MARGINE + b[1] + (y - MARGINE - a[1]) * b[3] / a[3];
  const sc = Math.min(b[2] / a[2], b[3] / a[3]);
  lp.testo.x = mx(lp.testo.x); lp.testo.y = my(lp.testo.y);
  for (const o of lp.oggetti){
    if (o.tipo === 'segno'){ o.x = mx(o.x); o.y = my(o.y); o.s *= sc; }
    else if (o.tipo === 'tratto'){ for (let i = 0; i < o.punti.length; i += 3){ o.punti[i] = mx(o.punti[i]); o.punti[i + 1] = my(o.punti[i + 1]); } o.spess *= sc; }
  }
  lp.supporto = nuovo;
  lp.storia = []; $('#lp-annulla').disabled = true;
  lpRifaiPietra();
  lpMisura();
}

function lpAnteprimaSegno(forma, lato){
  const c = tela2d(lato, lato);
  const x = c.getContext('2d');
  x.fillStyle = x.strokeStyle = colore('--inchiostro') || '#222';
  x.translate(lato / 2, lato / 2);
  x.scale(lato / 118, lato / 118);
  SEGNI[forma](x);
  return c;
}

/* le scelte del pannello: si ricostruiscono anche quando cambia la lingua */
const ICONE_SUPPORTI = {
  lastra: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="1"/></svg>',
  tabula: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6.5 7h11v2.4L21.5 7v10l-4-2.4V17h-11v-2.4L2.5 17V7l4 2.4z"/></svg>',
  stele: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 21l.8-11.5H5.5V8.2L5 6.6 7 7.6 12 4.2 17 7.6l2-1-.5 1.6v1.3h-1.3L18 21z"/></svg>',
  centinata: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 21V10a6 6 0 0 1 12 0v11z"/></svg>',
  ara:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4.5 5a2 2 0 0 1 4 0h7a2 2 0 0 1 4 0v1.5H20V8h-3v9h3v1.5h-1V21H5v-2.5H4V17h3V8H4V6.5h.5z"/></svg>',
};
const ICONE_ALLINEA = {
  left: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
  center: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
};
function lpOpzioni(box, voci, attuale, fai){
  box.innerHTML = '';
  for (const [k, et, extra, solo] of voci){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lp-opz'; b.dataset.v = k;
    b.innerHTML = (extra || '') + (solo ? '' : `<span>${et}</span>`);
    if (solo){ b.title = et; b.setAttribute('aria-label', et); }
    b.setAttribute('aria-pressed', String(k === attuale()));
    b.onclick = () => { fai(k); box.querySelectorAll('.lp-opz').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === attuale()))); };
    box.appendChild(b);
  }
}
function lpEtichette(){
  lpOpzioni($('#lp-supporti'), Object.entries(SUPPORTI).map(([k, s]) => [k, t(s.nome), ICONE_SUPPORTI[k]]),
    () => lp.supporto, k => lpCambiaSupporto(k));
  lpOpzioni($('#lp-pietre'), Object.entries(PIETRE).map(([k, p]) => [k, t(p.nome), `<i class="lp-campione" style="background:rgb(${p.base.join(',')})"></i>`]),
    () => lp.pietra, k => { lp.pietra = k; lpRifaiPietra(); });
  lpOpzioni($('#lp-cornici'), Object.entries(CORNICI).map(([k, n]) => [k, t(n)]),
    () => lp.cornice, k => { lp.cornice = k; lpRifaiPietra(); });
  lpOpzioni($('#lp-alfabeti'), Object.entries(ALFABETI).map(([k, n]) => [k, t(n)]),
    () => lp.testo.alfabeto, k => { lp.testo.alfabeto = k; lpRicostruisci(); });
  lpOpzioni($('#lp-stili'), Object.entries(STILI).map(([k, n]) => [k, t(n)]),
    () => lp.testo.stile, k => { lp.testo.stile = k; lpRicostruisci(); });
  lpOpzioni($('#lp-allinea'), Object.entries(ALLINEA).map(([k, n]) => [k, t(n), ICONE_ALLINEA[k], true]),
    () => lp.testo.allinea, k => { lp.testo.allinea = k; lpRicostruisci(); });
  lpOpzioni($('#lp-colore-testo'), Object.entries(COLORI).map(([k, n]) => [k, t(n), `<i class="lp-campione c-${k}"></i>`]),
    () => lp.testo.colore, k => { lp.testo.colore = k; lpRicostruisci(); });
  $$('#lp-colori [data-colore]').forEach(b => { const n = t(COLORI[b.dataset.colore]); b.title = n; b.setAttribute('aria-label', n); });
  $$('#lp-segni .lp-segno').forEach(b => { const n = t(NOMI_SEGNI[b.dataset.forma]); b.title = n; b.setAttribute('aria-label', n); });
  lpAiuto();
  lpDisegna();
}

function lpPreparaPannello(){
  if (lp._pronto){ lpSincronizzaPannello(); return; }
  lp._pronto = true;

  // i segni
  const sg = $('#lp-segni');
  sg.innerHTML = '';
  for (const forma of Object.keys(SEGNI)){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lp-segno'; b.dataset.forma = forma;
    b.setAttribute('aria-pressed', 'false');
    b.appendChild(lpAnteprimaSegno(forma, 96));
    b.onclick = () => lpScegliStrumento(lp.strumento === 'segno:' + forma ? 'sposta' : 'segno:' + forma);
    sg.appendChild(b);
  }
  lpEtichette();

  // i comandi
  const regola = (id, fai) => $(id).addEventListener('input', e => fai(+e.target.value));
  $('#lp-testo').addEventListener('input', e => { lp.testo.righe = e.target.value; lpRicostruisci(); });
  regola('#lp-dim-testo', v => { lp.testo.dim = v; lpRicostruisci(); });
  regola('#lp-spaziatura', v => { lp.testo.spaziatura = v; lpRicostruisci(); });
  regola('#lp-interlinea', v => { lp.testo.interlinea = v; lpRicostruisci(); });
  regola('#lp-spess', v => { lp.spess = v; });
  regola('#lp-dim-segno', v => {
    lp.dimSegno = v;
    if (lp.sel && lp.sel.tipo === 'segno'){ lp.sel.s = v; lpRicostruisci(); }
  });
  regola('#lp-rot-segno', v => {
    lp.angSegno = v;
    if (lp.sel && lp.sel.tipo === 'segno'){ lp.sel.ang = v * Math.PI / 180; lpRicostruisci(); }
  });
  let attesa = 0;
  regola('#lp-usura', v => { lp.usura = v; clearTimeout(attesa); attesa = setTimeout(lpRifaiPietra, 60); });
  regola('#lp-profondita', v => { lp.profondita = v; clearTimeout(attesa); attesa = setTimeout(lpRifaiPietra, 60); });
  $('#lp-guide').onclick = e => {
    lp.guide = !lp.guide;
    e.currentTarget.setAttribute('aria-pressed', String(lp.guide));
    lpRicostruisci();
  };
  $$('#g-lapicida [data-strumento]').forEach(b => b.onclick = () => lpScegliStrumento(b.dataset.strumento));
  $$('#lp-colori [data-colore]').forEach(b => b.onclick = () => {
    lp.colore = b.dataset.colore;
    $$('#lp-colori [data-colore]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (lp.sel && lp.strumento === 'sposta'){
      lpSnap();
      lp.sel.colore = lp.colore;
      lpSincronizzaPannello();
      lpRicostruisci();
    }
  });
  $('#lp-annulla').onclick = lpAnnulla;
  $('#lp-cancella').onclick = () => {
    if (lpVuota()) return;
    lpSnap();
    lp.oggetti = []; lp.sel = null;
    lp.testo.righe = ''; $('#lp-testo').value = '';
    lpRicostruisci();
  };
  $('#lp-nuova-pietra').onclick = () => { lp.seme = Math.floor(Math.random() * 1e6); lp.erosione = null; lpRifaiPietra(); };
  $$('#g-lapicida .lp-scheda').forEach(b => b.onclick = () => {
    $$('#g-lapicida .lp-scheda').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $$('#g-lapicida .lp-sez').forEach(s => s.hidden = s.id !== b.dataset.sez);
    $('.lp-pannello').scrollTop = 0;
  });
  $('#lp-vedi3d').onclick = lpApri3d;
  $('#lp-scarica').onclick = lpScarica;
  $('#lp-scarica').hidden = !!H.senzaRete;
  $('#lp-3d-chiudi').onclick = lpChiudi3d;
  $('#lp-3d-luce').onclick = e => {
    if (!lp.v3) return;
    lp.v3.radente = !lp.v3.radente;
    e.currentTarget.setAttribute('aria-pressed', String(lp.v3.radente));
    lpLuci3d();
  };
  const tl = $('#lp-tela');
  tl.addEventListener('pointerdown', lpGiu);
  tl.addEventListener('pointermove', lpMuovi);
  tl.addEventListener('pointerup', lpSu);
  tl.addEventListener('pointercancel', lpSu);
  new ResizeObserver(() => { if (attiva === 'lapicida') lpMisura(); }).observe($('#lp-tela-box'));
  lpScegliStrumento('mano');
  lpSincronizzaPannello();
}
function lpSincronizzaPannello(){
  if (!lp || !lp._pronto) return;
  const T = lp.testo;
  const seg = lp.sel && lp.sel.tipo === 'segno' ? lp.sel : null;
  $('#lp-testo').value = T.righe;
  $('#lp-dim-testo').value = T.dim;
  $('#lp-spaziatura').value = T.spaziatura;
  $('#lp-interlinea').value = T.interlinea;
  $('#lp-spess').value = lp.spess;
  $('#lp-dim-segno').value = seg ? seg.s : lp.dimSegno;
  $('#lp-rot-segno').value = seg ? Math.round((seg.ang || 0) * 180 / Math.PI) : lp.angSegno;
  $('#lp-usura').value = lp.usura;
  $('#lp-profondita').value = lp.profondita;
  $('#lp-guide').setAttribute('aria-pressed', String(lp.guide));
  $('#lp-annulla').disabled = !lp.storia.length;
  const scelta = (sel, v) => $$(sel + ' .lp-opz').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === v)));
  scelta('#lp-colore-testo', T.colore);
  scelta('#lp-alfabeti', T.alfabeto);
  scelta('#lp-stili', T.stile);
  scelta('#lp-allinea', T.allinea);
  const col = lp.sel && lp.sel !== T ? lp.sel.colore : lp.colore;
  $$('#lp-colori [data-colore]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.colore === col)));
}

function lpImmagine(){
  const sel = lp.sel; lp.sel = null;
  lpRicostruisci();
  lp.sel = sel;
  return lp.cacheC;
}
function lpScarica(){
  const c = lpImmagine();
  c.toBlob(b => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = t('la-mia-epigrafe') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

/* ── la pietra in 3D ─────────────────────────────────────────────────
   La forma del supporto diventa un blocco estruso; sulla faccia davanti
   va il disegno, e le incisioni diventano rilievo vero (una mappa di
   rilievo): con la luce radente si leggono come sulle epigrafi dell'archivio. */
function lpRilievo(){
  const W = lp.cacheC.width, Hh = lp.cacheC.height;
  const c = tela2d(W, Hh);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh);
  const m = lp.maschera.getContext('2d');
  const tm = lp.tmp.getContext('2d');
  m.clearRect(0, 0, W, Hh);
  lpCornici(m);
  for (const o of [lp.testo, ...lp.oggetti]) lpMascheraDi(m, o);
  lpConsuma(m, 0, 0, W, Hh);
  tm.globalCompositeOperation = 'source-over';
  tm.clearRect(0, 0, W, Hh);
  tm.drawImage(lp.maschera, 0, 0);
  tm.globalCompositeOperation = 'source-in';
  tm.fillStyle = '#000'; tm.fillRect(0, 0, W, Hh);
  tm.globalCompositeOperation = 'source-over';
  x.filter = 'blur(1.6px)';
  x.drawImage(lp.tmp, 0, 0);
  x.filter = 'none';
  m.clearRect(0, 0, W, Hh);
  tm.clearRect(0, 0, W, Hh);
  return c;
}

function lpApri3d(){
  lpChiudi3d();
  $('#lp-3d').hidden = false;
  const box = $('#lp-3d-palco');
  const r = montaMotore(box);
  const s = SUPPORTI[lp.supporto];
  const W = lp.tela.width, Hh = lp.tela.height;
  const img = tela2d(W, Hh);
  img.getContext('2d').drawImage(lpImmagine(), 0, 0);
  const mappa = new THREE.CanvasTexture(img);
  mappa.colorSpace = THREE.SRGBColorSpace;
  mappa.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());
  const rilievo = new THREE.CanvasTexture(lpRilievo());
  for (const tx of [mappa, rilievo]){
    tx.repeat.set(1 / W, 1 / Hh);
    tx.offset.set(MARGINE / W, MARGINE / Hh);
  }
  const forma = new THREE.Shape();
  s.punti.forEach(([x, y], i) => i ? forma.lineTo(x, s.h - y) : forma.moveTo(x, s.h - y));
  forma.closePath();
  const prof = Math.round(Math.min(s.w, s.h) * .16);
  const corpoG = new THREE.ExtrudeGeometry(forma, { depth: prof, bevelEnabled: false, curveSegments: 1 });
  const p = PIETRE[lp.pietra];
  const tinta = new THREE.Color(`rgb(${p.base.map(v => Math.round(v * .93)).join(',')})`);
  const corpoM = new THREE.MeshStandardMaterial({ color: tinta, roughness: .92, metalness: 0 });
  const fronteG = new THREE.ShapeGeometry(forma);
  const fronteM = new THREE.MeshStandardMaterial({ map: mappa, bumpMap: rilievo, bumpScale: 6 * lp.profondita, roughness: .82, metalness: 0 });
  const blocco = new THREE.Group();
  const corpo = new THREE.Mesh(corpoG, corpoM);
  const fronte = new THREE.Mesh(fronteG, fronteM);
  fronte.position.z = prof + .6;
  blocco.add(corpo, fronte);
  blocco.position.set(-s.w / 2, -s.h / 2, -prof / 2);
  const perno = new THREE.Group(); perno.add(blocco);

  const sc = new THREE.Scene();
  const amb = new THREE.HemisphereLight(0xffffff, 0x4a4036, 1);
  const key = new THREE.DirectionalLight(0xfff4e4, 2.2);
  const fil = new THREE.DirectionalLight(0xcdd8ea, .5);
  sc.add(amb, key, fil, perno);
  const cam = new THREE.PerspectiveCamera(32, 1, 10, 20000);
  const ctrl = new OrbitControls(cam, r.domElement);
  ctrl.enableDamping = true; ctrl.dampingFactor = .08;
  ctrl.enablePan = false;
  ctrl.autoRotate = true; ctrl.autoRotateSpeed = 1.1;
  ctrl.addEventListener('start', () => { ctrl.autoRotate = false; });
  lp.v3 = { sc, cam, ctrl, amb, key, fil, perno, s, prof, radente: false, cose: [corpoG, corpoM, fronteG, fronteM, mappa, rilievo] };
  $('#lp-3d-luce').setAttribute('aria-pressed', 'false');
  lpLuci3d();
  lpInquadra3d();
  lp.v3.oss = new ResizeObserver(lpInquadra3d);
  lp.v3.oss.observe(box);
}
function lpInquadra3d(){
  const v = lp && lp.v3;
  if (!v) return;
  const box = $('#lp-3d-palco');
  if (!misuraMotore(box)) return;
  const a = box.clientWidth / box.clientHeight;
  v.cam.aspect = a; v.cam.updateProjectionMatrix();
  const vf = THREE.MathUtils.degToRad(v.cam.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * a);
  const d = Math.max((v.s.h * .62) / Math.tan(vf / 2), (v.s.w * .62) / Math.tan(hf / 2)) + v.prof;
  v.cam.position.set(0, 0, d);
  v.ctrl.target.set(0, 0, 0);
  v.ctrl.minDistance = d * .45; v.ctrl.maxDistance = d * 2.2;
  v.ctrl.update();
}
function lpLuci3d(){
  const v = lp.v3;
  if (v.radente){
    v.key.position.set(-1, .12, .32); v.key.intensity = 3.6;
    v.fil.intensity = .08; v.amb.intensity = .22;
  }else{
    v.key.position.set(-.5, .7, 1); v.key.intensity = 2.2;
    v.fil.position.set(.8, -.2, .6); v.fil.intensity = .5; v.amb.intensity = 1;
  }
}
function lpChiudi3d(){
  if (!lp || !lp.v3){ const o = $('#lp-3d'); if (o) o.hidden = true; return; }
  lp.v3.oss.disconnect();
  lp.v3.ctrl.dispose();
  lp.v3.cose.forEach(x => x.dispose());
  lp.v3 = null;
  $('#lp-3d').hidden = true;
  if (rend) rend.clear();
}

/* ═══════════════════════════ DALLO SCAVO AL MUSEO ═══════════════════════
   La strada di un'epigrafe, in cinque tappe: la si scava, la si pulisce,
   la si studia con la luce radente e il metro, si risponde a qualche
   domanda come fa chi la pubblica, e alla fine se ne compila la scheda.
   La pietra e' un modello vero dell'archivio, visto di fronte; sopra c'e'
   una tela 2D con tre strati di sporco (terra, polvere, incrostazioni) che
   si tolgono con gli attrezzi giusti. Quelli sbagliati graffiano. */
const tf = (s, v) => t(s).replace(/\{(\w+)\}/g, (_, k) => v[k] == null ? '' : v[k]);
const FASI = ['Scavo', 'Pulizia', 'Analisi', 'Studio', 'Scheda'];
const ATTREZZI = {
  cazzuola: { nome: 'Cazzuola', per: 'per la terra', r: 46, su: { terra: .55 }, danno: 'terra',
    icona: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5 20.5 10.5 11 17 7 13z"/><path d="M8.8 15.2 4 20"/><path d="M3.2 20.8 5 19"/></svg>' },
  pennello: { nome: 'Pennello', per: 'per la polvere', r: 30, su: { terra: .12, polvere: .34 },
    icona: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10 20.5 3.5"/><path d="M9.5 11.5 12.5 14.5"/><path d="M9.5 11.5c-3 0-4.5 2-4.8 4.5-.2 1.8-1 3-2.2 4 3.5.3 6.4-.4 8-2.3 1.2-1.4 1.8-2.6 2-3.7"/><path d="M11 13l3-3"/></svg>' },
  spugna: { nome: 'Spugna', per: 'per il velo di fango', r: 36, su: { velo: .4, polvere: .06 }, bagna: true,
    icona: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8" width="17" height="10" rx="3"/><circle cx="8" cy="12" r=".8" fill="currentColor"/><circle cx="12.5" cy="14.5" r=".8" fill="currentColor"/><circle cx="16" cy="11.5" r=".8" fill="currentColor"/><path d="M8 5.5c1-1.3 2-1.3 3 0M13 4.5c1-1.3 2-1.3 3 0"/></svg>' },
  bisturi: { nome: 'Bisturi', per: 'per le incrostazioni', r: 13, su: { croste: .6 }, danno: 'croste',
    icona: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5 12 12"/><path d="M12 12c2-3.5 5-6.5 8.5-8.5-1 4.5-3.5 7.8-6.8 10.2z"/></svg>' },
};
const ATTREZZI_FASE = { 1: ['cazzuola', 'pennello'], 2: ['pennello', 'spugna', 'bisturi'] };
const TESTI_FASE = {
  1: ['Scavo', 'La pietra è sepolta. Togli la terra con la cazzuola e rifinisci con il pennello, finché tutta la superficie è scoperta.'],
  2: ['Pulizia', 'Tre strati da togliere: il pennello spazza la polvere asciutta, la spugna umida scioglie il velo di fango rimasto attaccato, il bisturi stacca le incrostazioni dure. Attento: sulla pietra pulita il bisturi graffia.'],
  3: ['Analisi', 'Ora si studia. Accendi la luce radente e girala: le lettere consumate vengono fuori con le loro ombre. Poi misura l\'altezza della pietra con il metro e scatta la fotografia.'],
  4: ['Studio', 'Chi studia un\'epigrafe deve sapere dove si trova, come è fatta e come si legge. Rispondi alle domande.'],
};
let sv = null;
let svGen = 0;

function svCandidate(){
  let l = H.modelli().filter(m => m.epi && m.tex && !m.pesante).sort((a, b) => (a.bytes || 0) - (b.bytes || 0));
  return l.slice(0, Math.max(6, Math.ceil(l.length / 2)));
}
function svEntra(){ svIntro(); }
function svEsci(){ svGen++; svLibera(); }
function svIntro(){
  svGen++;
  svLibera();
  $('#g-stato').textContent = '';
  scriviTitolo();
  $('#sv-intro').hidden = false;
  $('#sv-carico').hidden = true;
  $('#sv-scheda').hidden = true;
  $('#sv-intro-inizia').disabled = !svCandidate().length;
  $('#sv-vuoto').hidden = svCandidate().length > 0;
  svFasi(0);
}
function svFasi(n){
  $('#sv-fasi').innerHTML = FASI.map((f, i) =>
    `<li class="${i + 1 < n ? 'fatta' : i + 1 === n ? 'ora' : ''}"><b>${i + 1}</b><span>${t(f)}</span></li>`).join('');
}

async function svAvvia(){
  const lista = svCandidate();
  if (!lista.length) return;
  const altri = lista.filter(x => !sv || !sv.ultimo || x.id !== sv.ultimo);
  const pool = altri.length ? altri : lista;
  const m = pool[Math.floor(Math.random() * pool.length)];
  const gen = ++svGen;
  svLibera();
  $('#sv-intro').hidden = true;
  $('#sv-scheda').hidden = true;
  $('#sv-carico').hidden = false;
  $('#sv-carico-t').textContent = t('Sto preparando lo scavo');
  $('#sv-carico-t').classList.remove('rosso');
  $('#sv-carico-azioni').hidden = true;
  const prog = f => { $('#sv-anello').style.strokeDashoffset = 2 * Math.PI * 24 * (1 - f); $('#sv-carico-perc').textContent = Math.round(f * 100) + '%'; };
  prog(0);
  try{
    const root = await H.leggiCompatto(m.epi, f => { if (gen === svGen) prog(Math.min(.85, f * .85)); });
    if (gen !== svGen){ pzButta(root); return; }
    let mappa = null;
    try{ mappa = await H.caricaTexture(m.tex); }catch(e){ mappa = null; }
    if (gen !== svGen){ pzButta(root); mappa && mappa.dispose(); return; }
    prog(.92);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));
    if (gen !== svGen){ pzButta(root); mappa && mappa.dispose(); return; }
    svCostruisci(m, root, mappa);
    prog(1);
    $('#sv-carico').hidden = true;
  }catch(e){
    console.error(e);
    if (gen !== svGen) return;
    $('#sv-carico-t').textContent = t('Questa pietra non si carica');
    $('#sv-carico-t').classList.add('rosso');
    $('#sv-carico-azioni').hidden = false;
  }
}

function svCostruisci(m, root, mappa){
  const mesh = root.children.find(o => o.isMesh);
  const geo = mesh.geometry;
  mesh.material.dispose();
  const c0 = H.centroRobusto(root);
  const qs = H.orientamentoSalvato(m);
  const sc3 = new THREE.Scene();
  const orient = new THREE.Group(); orient.quaternion.copy(qs);
  const mat = new THREE.MeshPhongMaterial({ map: mappa, color: mappa ? 0xffffff : 0xd6cec1, shininess: 6, specular: 0x121212, side: THREE.DoubleSide });
  const ms = new THREE.Mesh(geo, mat);
  ms.position.copy(c0).negate();
  orient.add(ms);
  sc3.add(orient);
  orient.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(orient);
  const amb = new THREE.HemisphereLight(0xeef2f8, 0x3a3024, 1.1);
  const key = new THREE.DirectionalLight(0xfff2df, 2.1);
  const fil = new THREE.DirectionalLight(0xc9d6ea, .45);
  fil.position.set(.8, -.3, .7);
  sc3.add(amb, key, fil);
  const bw = bb.max.x - bb.min.x, bh = bb.max.y - bb.min.y, bd = bb.max.z - bb.min.z;
  const vw = bw * 1.3, vh = bh * 1.3;
  const cam = new THREE.OrthographicCamera(-vw / 2, vw / 2, vh / 2, -vh / 2, .01, 1e6);
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
  cam.position.set(cx, cy, bb.max.z + bd * 50 + bw * 4);
  cam.far = bd * 120 + bw * 20;
  cam.lookAt(cx, cy, 0);
  cam.updateProjectionMatrix();
  const A = vw / vh;
  const W = A >= 1 ? 1000 : Math.round(1000 * A), Hh = A >= 1 ? Math.round(1000 / A) : 1000;
  sv = {
    m, ultimo: m.id, sc3, cam, amb, key, fil, geo, mat, mappa, W, H: Hh, vw, vh,
    dim: { w: bw / 10, h: bh / 10, d: bd / 10 },          // i modelli sono in millimetri
    fase: 1, attrezzo: 'cazzuola', graffi: 0, t0: performance.now(), fine: 0,
    radente: false, az: 135, giroLuce: false, misura: null, misurata: false, foto: null,
    quiz: null, rifai3d: true, rifaiSporco: true, puntatore: null,
  };
  // la tavola ha le proporzioni della vista: 3D e sporco restano allineati
  const tav = $('#sv-tavola');
  montaMotore(tav);
  const tela = $('#sv-sporco');
  tela.width = W; tela.height = Hh;
  svMisura();
  svLuci();
  rend.render(sc3, cam);
  // la sagoma della pietra, presa dal primo disegno (fondo trasparente)
  const sil = tela2d(W, Hh);
  sil.getContext('2d').drawImage(rend.domElement, 0, 0, W, Hh);
  const sd = sil.getContext('2d').getImageData(0, 0, W, Hh).data;
  const sagoma = new Uint8Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) sagoma[i] = sd[i * 4 + 3] > 24 ? 1 : 0;
  const silC = tela2d(W, Hh);
  const sx = silC.getContext('2d');
  const id = sx.createImageData(W, Hh);
  for (let i = 0; i < W * Hh; i++) id.data[i * 4 + 3] = sagoma[i] ? 255 : 0;
  sx.putImageData(id, 0, 0);
  sv.sagoma = sagoma; sv.silC = silC;
  // la griglia per contare quanto e' pulito
  const gw = 100, gh = Math.max(1, Math.round(100 * Hh / W));
  const gs = tela2d(gw, gh), gx = gs.getContext('2d', { willReadFrequently: true });
  gx.drawImage(silC, 0, 0, gw, gh);
  const gd = gx.getImageData(0, 0, gw, gh).data;
  sv.griglia = { gw, gh, tela: gs, ctx: gx, sil: Array.from({ length: gw * gh }, (_, i) => gd[i * 4 + 3] > 128) };
  sv.celle = sv.griglia.sil.filter(Boolean).length || 1;
  svSporco();
  svFasi(1);
  svFase(1);
  $('#g-s').textContent = m.titolo + (m.sede ? ' · ' + m.sede : '');
}

/* ── lo sporco ────────────────────────────────────────────────────────── */
function svSporco(){
  const { W, H: Hh } = sv;
  const s = Math.floor(Math.random() * 1e6);
  const mezza = (fn) => {
    const w = Math.ceil(W / 2), h = Math.ceil(Hh / 2);
    const c = tela2d(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) fn(img.data, (y * w + xx) * 4, xx, y);
    x.putImageData(img, 0, 0);
    const out = tela2d(W, Hh);
    out.getContext('2d', { willReadFrequently: true }).drawImage(c, 0, 0, W, Hh);
    return out;
  };
  // la terra copre tutto
  const terra = mezza((d, i, x, y) => {
    const n = frattale(x / 26, y / 26, s, 4), g = hash(x, y, s + 1);
    const k = .7 + n * .55 + (g - .5) * .16;
    d[i] = 118 * k; d[i + 1] = 88 * k; d[i + 2] = 58 * k; d[i + 3] = 255;
  });
  const tx = terra.getContext('2d');
  for (let k = 0; k < 90; k++){
    const x = hash(k, 1, s) * W, y = hash(k, 2, s) * Hh, r = 3 + hash(k, 3, s) * 9;
    const v = 120 + hash(k, 4, s) * 90;
    tx.fillStyle = `rgb(${v},${v * .92},${v * .8})`;
    tx.beginPath(); tx.ellipse(x, y, r, r * (.6 + hash(k, 5, s) * .4), hash(k, 6, s) * 3, 0, Math.PI * 2); tx.fill();
  }
  tx.strokeStyle = 'rgba(60,40,24,.5)'; tx.lineWidth = 1.4;
  for (let k = 0; k < 14; k++){
    let x = hash(k, 7, s) * W, y = hash(k, 8, s) * Hh;
    tx.beginPath(); tx.moveTo(x, y);
    for (let j = 0; j < 8; j++){ x += (hash(k, j + 9, s) - .5) * 40; y += (hash(k, j + 20, s) - .3) * 30; tx.lineTo(x, y); }
    tx.stroke();
  }
  // la polvere e le incrostazioni stanno solo sulla pietra
  const polvere = mezza((d, i, x, y) => {
    const n = frattale(x / 18, y / 18, s + 3, 3);
    d[i] = 196; d[i + 1] = 176; d[i + 2] = 146; d[i + 3] = 175 + n * 70;
  });
  const croste = mezza((d, i, x, y) => {
    const n = frattale(x / 22, y / 22, s + 5, 4), l = frattale(x / 12, y / 12, s + 9, 3);
    // poche chiazze, ben visibili: sono il lavoro di precisione del bisturi
    if (n > .7){ const v = 205 + l * 30; d[i] = v; d[i + 1] = v * .97; d[i + 2] = v * .88; d[i + 3] = 255; }
    else if (l > .82){ d[i] = 132; d[i + 1] = 146; d[i + 2] = 104; d[i + 3] = 235; }
  });
  // il velo di fango: sottile, bruno, resta dopo il pennello e va via solo bagnandolo
  const velo = mezza((d, i, x, y) => {
    const n = frattale(x / 30, y / 30, s + 7, 3);
    d[i] = 128; d[i + 1] = 100; d[i + 2] = 70; d[i + 3] = 95 + n * 90;
  });
  for (const c of [polvere, croste, velo]){
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(sv.silC, 0, 0);
    x.globalCompositeOperation = 'source-over';
  }
  const graffi = tela2d(W, Hh);
  sv.strati = { terra, polvere, croste, velo, graffi, bagnato: tela2d(W, Hh) };
  sv.rifaiSporco = true;
}

function svCopertura(nome){
  const g = sv.griglia;
  g.ctx.clearRect(0, 0, g.gw, g.gh);
  g.ctx.drawImage(sv.strati[nome], 0, 0, g.gw, g.gh);
  const d = g.ctx.getImageData(0, 0, g.gw, g.gh).data;
  let n = 0;
  for (let i = 0; i < g.sil.length; i++) if (g.sil[i] && d[i * 4 + 3] > 60) n++;
  return n / sv.celle;
}

function svDisegna(){
  const c = $('#sv-sporco').getContext('2d');
  c.clearRect(0, 0, sv.W, sv.H);
  c.drawImage(sv.strati.graffi, 0, 0);
  if (sv.fase <= 2){
    c.drawImage(sv.strati.bagnato, 0, 0);
    c.drawImage(sv.strati.velo, 0, 0);
    c.drawImage(sv.strati.croste, 0, 0);
    c.drawImage(sv.strati.polvere, 0, 0);
    c.drawImage(sv.strati.terra, 0, 0);
  }
  if (sv.fase === 3 && sv.misura){
    const { a, b } = sv.misura;
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.strokeStyle = '#f3c696'; c.lineWidth = 4;
    c.setLineDash([10, 10]);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#00a769';
    for (const p of [a, b]){ c.beginPath(); c.arc(p.x, p.y, 7, 0, Math.PI * 2); c.fill(); }
    const cm = svCm(sv.misura);
    const txt = svNum(cm) + ' cm';
    c.font = '700 26px "DM Sans", sans-serif';
    const w = c.measureText(txt).width + 22;
    const mx = Math.min(sv.W - w - 6, Math.max(6, (a.x + b.x) / 2 + 14)), my = Math.max(34, (a.y + b.y) / 2);
    c.fillStyle = 'rgba(2,3,4,.82)';
    c.beginPath(); c.roundRect ? c.roundRect(mx, my - 22, w, 38, 19) : c.rect(mx, my - 22, w, 38); c.fill();
    c.fillStyle = '#fff'; c.fillText(txt, mx + 11, my + 6);
    c.restore();
  }
  sv.rifaiSporco = false;
}
const svCm = mis => Math.hypot(mis.b.x - mis.a.x, mis.b.y - mis.a.y) * (sv.vw / sv.W) / 10;

function svMisura(){
  if (!sv) return;
  const palco = $('#sv-palco');
  const pw = palco.clientWidth - 24, ph = palco.clientHeight - 24;
  if (pw <= 0 || ph <= 0) return;
  const s = Math.min(pw / sv.W, ph / sv.H);
  const tav = $('#sv-tavola');
  tav.style.width = Math.floor(sv.W * s) + 'px';
  tav.style.height = Math.floor(sv.H * s) + 'px';
  misuraMotore(tav);
  sv.rifai3d = true;
}
function svLuci(){
  const a = sv.az * Math.PI / 180;
  if (sv.radente){
    sv.key.position.set(Math.cos(a), Math.sin(a), .16); sv.key.intensity = 3.4;
    sv.amb.intensity = .2; sv.fil.intensity = .05;
  }else{
    sv.key.position.set(-.55, .75, 1); sv.key.intensity = 2.1;
    sv.amb.intensity = 1.1; sv.fil.intensity = .45;
  }
  sv.rifai3d = true;
}
function svFotogramma(){
  if (!sv || !rend || !sv.sc3) return;
  if (sv.rifai3d){ rend.render(sv.sc3, sv.cam); sv.rifai3d = false; }
  if (sv.umido){
    const ora = performance.now();
    if (ora - (sv._asciuga || 0) > 70){
      sv._asciuga = ora;
      const b = sv.strati.bagnato.getContext('2d');
      b.globalCompositeOperation = 'destination-out';
      b.fillStyle = 'rgba(0,0,0,.06)'; b.fillRect(0, 0, sv.W, sv.H);
      b.globalCompositeOperation = 'source-over';
      sv.rifaiSporco = true;
      if (ora - sv.umido > 4000) sv.umido = 0;
    }
  }
  if (sv.rifaiSporco) svDisegna();
  if (sv.fase <= 4 && !sv.fine){
    const ora = Math.floor((performance.now() - sv.t0) / 1000);
    if (ora !== sv._sec){ sv._sec = ora; svStato(); }
  }
}
function svStato(){
  if (!sv) return;
  const sec = Math.floor(((sv.fine || performance.now()) - sv.t0) / 1000);
  $('#g-stato').innerHTML =
    `<span title="${t('Fase')}"><b>${Math.min(sv.fase, 5)}</b>/5</span>` +
    `<span class="g-stato-ext" title="${t('Graffi sulla pietra')}">${t('graffi')} <b>${sv.graffi}</b></span>` +
    `<span title="${t('Tempo')}">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</span>`;
}

/* ── le fasi ──────────────────────────────────────────────────────────── */
function svFase(n){
  sv.fase = n;
  svFasi(n);
  const [tit, testo] = TESTI_FASE[n] || ['', ''];
  $('#sv-fase-n').textContent = tf('Fase {n} di 5', { n });
  $('#sv-fase-t').textContent = t(tit);
  $('#sv-fase-p').textContent = t(testo);
  $('#sv-avviso').textContent = '';
  $('#sv-avanti').disabled = true;
  $('#sv-attrezzi').hidden = n > 2;
  $('#sv-progresso').hidden = n > 2;
  $('#sv-strati').hidden = n !== 2;
  $('#sv-analisi').hidden = n !== 3;
  $('#sv-quiz').hidden = n !== 4;
  $('#sv-avanti').hidden = n === 4;
  $('#sv-tavola').dataset.fase = n;
  if (n <= 2){
    sv.attrezzo = ATTREZZI_FASE[n][0];
    svAttrezzi();
    svControlla();
  }
  if (n === 3){ sv.radente = false; svLuci(); svCompiti(); }
  if (n === 4) svQuiz();
  sv.rifaiSporco = true;
  svStato();
}
function svAttrezzi(){
  const box = $('#sv-attrezzi');
  box.innerHTML = '';
  for (const k of ATTREZZI_FASE[sv.fase]){
    const a = ATTREZZI[k];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sv-attrezzo';
    b.setAttribute('aria-pressed', String(k === sv.attrezzo));
    b.innerHTML = `${a.icona}<span>${t(a.nome)}</span><small>${t(a.per)}</small>`;
    b.onclick = () => { sv.attrezzo = k; svAttrezzi(); };
    box.appendChild(b);
  }
}
function svControlla(){
  if (!sv || sv.fase > 2) return;
  let pulito, fatto;
  if (sv.fase === 1){
    const c = svCopertura('terra');
    pulito = 1 - c; fatto = c <= .07;
  }else{
    const p = svCopertura('polvere'), v = svCopertura('velo'), c = svCopertura('croste');
    pulito = 1 - (p + v + c) / 3; fatto = p <= .1 && v <= .1 && c <= .08;
    // cosa manca ancora, strato per strato
    $('#sv-strati').innerHTML = [['polvere', p, 'Polvere', 'pennello'], ['velo', v, 'Velo di fango', 'spugna'], ['croste', c, 'Incrostazioni', 'bisturi']]
      .map(([k, q, nome, att]) => `<li class="${q <= (k === 'croste' ? .08 : .1) ? 'ok' : ''}"><span>${t(nome)}</span><small>${t(ATTREZZI[att].nome)}</small><b>${Math.round((1 - q) * 100)}%</b></li>`).join('');
  }
  $('#sv-barra').style.width = Math.min(100, pulito * 100).toFixed(0) + '%';
  $('#sv-perc').textContent = tf('{n}% scoperto', { n: Math.min(100, Math.round(pulito * 100)) });
  if (fatto && $('#sv-avanti').disabled){
    $('#sv-avanti').disabled = false;
    svAvviso(sv.fase === 1 ? t('La pietra è scoperta! Passa alla pulizia.') : t('La pietra è pulita! Ora si può studiare.'), true);
  }
}
let svAvvisoT = 0;
function svAvviso(testo, bene){
  const el = $('#sv-avviso');
  el.textContent = testo;
  el.classList.toggle('bene', !!bene);
  el.classList.remove('lampo'); void el.offsetWidth; el.classList.add('lampo');
  clearTimeout(svAvvisoT);
  if (!bene) svAvvisoT = setTimeout(() => { el.textContent = ''; }, 4200);
}
function svAvanti(){
  if (!sv) return;
  if (sv.fase === 1){
    const x = sv.strati.terra.getContext('2d');
    x.globalCompositeOperation = 'destination-out'; x.drawImage(sv.silC, 0, 0); x.globalCompositeOperation = 'source-over';
    svFase(2);
  }else if (sv.fase === 2){
    for (const k of ['polvere', 'croste', 'velo', 'bagnato']) sv.strati[k].getContext('2d').clearRect(0, 0, sv.W, sv.H);
    svFase(3);
  }else if (sv.fase === 3) svFase(4);
}

/* ── gli attrezzi sulla pietra ────────────────────────────────────────── */
function svPunto(e){
  const r = $('#sv-sporco').getBoundingClientRect();
  return { x: (e.clientX - r.left) * sv.W / r.width, y: (e.clientY - r.top) * sv.H / r.height, s: r.width / sv.W, r };
}
function svSullaPietra(x, y){
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= sv.W || yi >= sv.H) return false;
  return !!sv.sagoma[yi * sv.W + xi];
}
function svAlfa(nome, x, y){
  const d = sv.strati[nome].getContext('2d', { willReadFrequently: true }).getImageData(Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), 1, 1).data;
  return d[3];
}
function svTocca(x, y){
  const a = ATTREZZI[sv.attrezzo];
  // lo stato della pietra si guarda prima del colpo: e' li' che si capisce
  // se l'attrezzo sta lavorando sullo sporco o sulla pietra nuda
  let rovina = false;
  const controlla = a.danno && svSullaPietra(x, y) && performance.now() - (sv._ultimoDanno || 0) > 280;
  if (controlla){
    if (a.danno === 'terra') rovina = svAlfa('terra', x, y) < 20;
    else rovina = svAlfa('croste', x, y) < 20 && svAlfa('polvere', x, y) < 60;
  }
  // la spugna lascia la pietra bagnata, piu' scura, che poi asciuga
  if (a.bagna && svSullaPietra(x, y)){
    const b = sv.strati.bagnato.getContext('2d');
    const g = b.createRadialGradient(x, y, 0, x, y, a.r);
    g.addColorStop(0, 'rgba(40,28,16,.2)'); g.addColorStop(1, 'rgba(40,28,16,0)');
    b.fillStyle = g; b.fillRect(x - a.r, y - a.r, a.r * 2, a.r * 2);
    b.globalCompositeOperation = 'destination-in'; b.drawImage(sv.silC, 0, 0); b.globalCompositeOperation = 'source-over';
    sv.umido = performance.now();
  }
  // il pennello sul velo non fa niente: lo si dice, una volta ogni tanto
  if (sv.attrezzo === 'pennello' && sv.fase === 2 && svSullaPietra(x, y) &&
      performance.now() - (sv._consiglioVelo || 0) > 5000 &&
      svAlfa('polvere', x, y) < 40 && svAlfa('velo', x, y) > 70){
    sv._consiglioVelo = performance.now();
    svAvviso(t('Il pennello toglie solo la polvere asciutta: il velo di fango si scioglie con la spugna umida.'));
  }
  for (const [nome, forza] of Object.entries(a.su)){
    const c = sv.strati[nome].getContext('2d');
    const g = c.createRadialGradient(x, y, 0, x, y, a.r);
    g.addColorStop(0, `rgba(0,0,0,${forza})`);
    g.addColorStop(.6, `rgba(0,0,0,${forza * .6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = g;
    c.fillRect(x - a.r, y - a.r, a.r * 2, a.r * 2);
    c.globalCompositeOperation = 'source-over';
  }
  // l'attrezzo sbagliato sulla pietra scoperta la rovina
  if (rovina){
    sv._ultimoDanno = performance.now();
    sv.graffi++;
    const gr = sv.strati.graffi.getContext('2d');
    gr.strokeStyle = 'rgba(245,240,230,.72)'; gr.lineWidth = sv.attrezzo === 'bisturi' ? 1.2 : 2.2;
    gr.lineCap = 'round';
    for (let k = 0; k < 2; k++){
      const ang = Math.random() * Math.PI, l = (sv.attrezzo === 'bisturi' ? 8 : 16) + Math.random() * 12;
      gr.beginPath(); gr.moveTo(x - Math.cos(ang) * l / 2 + (Math.random() - .5) * 6, y - Math.sin(ang) * l / 2);
      gr.lineTo(x + Math.cos(ang) * l / 2, y + Math.sin(ang) * l / 2); gr.stroke();
    }
    svAvviso(sv.attrezzo === 'bisturi'
      ? t('Attento! Il bisturi graffia la pietra pulita: usalo solo sulle incrostazioni.')
      : t('Attento! La cazzuola è per la terra: sulla pietra scoperta usa il pennello.'));
    svStato();
  }
}
function svGiu(e){
  if (!sv || sv.puntatore !== null || (e.button !== undefined && e.button > 0)) return;
  if (sv.fase > 3) return;
  e.preventDefault();
  sv.puntatore = e.pointerId;
  try{ $('#sv-sporco').setPointerCapture(e.pointerId); }catch(_){}
  const p = svPunto(e);
  if (sv.fase === 3){
    sv.misura = { a: { x: p.x, y: p.y }, b: { x: p.x, y: p.y } };
    sv.rifaiSporco = true;
    return;
  }
  sv.ultimoP = p;
  svTocca(p.x, p.y);
  sv.rifaiSporco = true;
  svCursore(e);
}
function svMuovi(e){
  if (!sv) return;
  svCursore(e);
  if (e.pointerId !== sv.puntatore) return;
  const p = svPunto(e);
  if (sv.fase === 3){
    if (sv.misura){ sv.misura.b = { x: p.x, y: p.y }; sv.rifaiSporco = true; }
    return;
  }
  const q = sv.ultimoP, a = ATTREZZI[sv.attrezzo];
  const d = Math.hypot(p.x - q.x, p.y - q.y), passo = Math.max(2, a.r * .35);
  if (d < passo) return;
  const n = Math.ceil(d / passo);
  for (let i = 1; i <= n; i++) svTocca(q.x + (p.x - q.x) * i / n, q.y + (p.y - q.y) * i / n);
  sv.ultimoP = p;
  sv.rifaiSporco = true;
  const ora = performance.now();
  if (ora - (sv._ultimoConto || 0) > 260){ sv._ultimoConto = ora; svControlla(); }
}
function svSu(e){
  if (!sv || e.pointerId !== sv.puntatore) return;
  sv.puntatore = null;
  if (sv.fase === 3 && sv.misura){
    const { a, b } = sv.misura;
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    if (dx + dy < 8){ sv.misura = null; sv.rifaiSporco = true; return; }
    const cm = svCm(sv.misura);
    const giusta = dy > dx * 2 && Math.abs(cm - sv.dim.h) / sv.dim.h < .15;
    if (giusta && !sv.misurata){ sv.misurata = true; svAvviso(tf('Giusto: la pietra è alta circa {cm} cm.', { cm: svNum(sv.dim.h) }), true); }
    else if (!giusta) svAvviso(dy > dx * 2 ? t('Quasi: tira il metro dal punto più basso a quello più alto della pietra.') : t('Per l\'altezza il metro va tenuto in verticale.'));
    svCompiti();
    return;
  }
  svControlla();
  if (e.pointerType !== 'mouse') $('#sv-cursore').hidden = true;
}
function svCursore(e){
  const cur = $('#sv-cursore');
  if (!sv || sv.fase > 2){ cur.hidden = true; return; }
  const r = $('#sv-sporco').getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < 0 || y < 0 || x > r.width || y > r.height){ cur.hidden = true; return; }
  const d = ATTREZZI[sv.attrezzo].r * 2 * r.width / sv.W;
  cur.hidden = false;
  cur.style.width = cur.style.height = d + 'px';
  cur.style.transform = `translate(${x - d / 2}px, ${y - d / 2}px)`;
}
const svNum = v => (Math.round(v * 10) / 10).toLocaleString(lingua(), { maximumFractionDigits: 1 });

/* ── l'analisi ────────────────────────────────────────────────────────── */
function svCompiti(){
  const voci = [
    [sv.radente && sv.giroLuce, t('Accendi la luce radente e girala')],
    [sv.misurata, t('Misura l\'altezza della pietra con il metro')],
    [!!sv.foto, t('Fotografa la pietra')],
  ];
  $('#sv-compiti').innerHTML = voci.map(([ok, testo]) => `<li class="${ok ? 'ok' : ''}">${testo}</li>`).join('');
  $('#sv-radente').setAttribute('aria-pressed', String(sv.radente));
  const tutti = voci.every(v => v[0]);
  if (tutti && $('#sv-avanti').disabled){
    $('#sv-avanti').disabled = false;
    svAvviso(t('Analisi completata! Adesso tocca allo studio.'), true);
  }
}
function svFoto(){
  rend.render(sv.sc3, sv.cam);
  const c = tela2d(sv.W, sv.H);
  const x = c.getContext('2d');
  x.drawImage(rend.domElement, 0, 0, sv.W, sv.H);
  x.drawImage(sv.strati.graffi, 0, 0);
  sv.foto = c.toDataURL('image/jpeg', .86);
  const f = $('#sv-flash');
  f.classList.remove('via'); void f.offsetWidth; f.classList.add('via');
  svCompiti();
}

/* ── lo studio: qualche domanda ──────────────────────────────────────── */
function svDomande(){
  const m = sv.m, dom = [];
  const casa = museoDi(m);
  if (casa){
    const altri = mescola(MUSEI.filter(x => x !== casa)).slice(0, 2);
    dom.push({ d: t('Dove è conservata oggi questa epigrafe?'),
      r: mescola([casa, ...altri].map(x => ({ testo: t(x.nome) + ', ' + x.citta, giusta: x === casa }))),
      spiega: t('Le epigrafi di Centuripe oggi sono divise fra diversi musei della Sicilia.') });
  }
  const h = sv.dim.h;
  dom.push({ d: t('Quanto è alta questa pietra, più o meno?'),
    r: mescola([[h, true], [h * 1.9, false], [h * .5, false]].map(([v, g]) => ({ testo: svNum(v) + ' cm', giusta: g }))),
    spiega: t('L\'hai misurata tu con il metro, durante l\'analisi.') });
  dom.push({ d: t('A che cosa serve la luce radente?'),
    r: mescola([
      { testo: t('Fa risaltare con le ombre le lettere consumate'), giusta: true },
      { testo: t('Asciuga la pietra dopo la pulizia'), giusta: false },
      { testo: t('Cambia il colore della pietra'), giusta: false }]),
    spiega: t('La luce che arriva di sbieco riempie di ombra i solchi: così si leggono anche i segni quasi spariti.') });
  dom.push({ d: t('Con che cosa si tolgono le incrostazioni dure?'),
    r: mescola([
      { testo: t('Con il bisturi, piano e con attenzione'), giusta: true },
      { testo: t('Con la cazzuola'), giusta: false },
      { testo: t('Con la spugna bagnata'), giusta: false }]),
    spiega: t('Il bisturi stacca le incrostazioni, ma sulla pietra pulita la graffia: per questo lo si usa con molta cura.') });
  if (!casa) dom.push({ d: t('Dove si pubblicano oggi le iscrizioni antiche della Sicilia?'),
    r: mescola([
      { testo: t('Nel corpus digitale I.Sicily'), giusta: true },
      { testo: t('Su un giornale locale'), giusta: false },
      { testo: t('Solo sui cartellini del museo'), giusta: false }]),
    spiega: t('I.Sicily raccoglie in rete le iscrizioni della Sicilia antica, con testo, traduzione e fotografie.') });
  return dom;
}
function svQuiz(){
  sv.quiz = { lista: svDomande(), i: 0, primo: 0, sbagli: 0 };
  svDomanda();
}
function svDomanda(){
  const q = sv.quiz, box = $('#sv-quiz');
  const d = q.lista[q.i];
  box.innerHTML = `<p class="sv-q-conta">${tf('Domanda {n} di {tot}', { n: q.i + 1, tot: q.lista.length })}</p>
    <h5>${d.d}</h5><div class="sv-risposte"></div><p class="sv-spiega" hidden></p>`;
  const rb = box.querySelector('.sv-risposte');
  q.sbagli = 0;
  d.r.forEach(r => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sv-risposta'; b.textContent = r.testo;
    b.onclick = () => {
      if (box.dataset.fatta === '1') return;
      if (r.giusta){
        b.classList.add('giusta');
        box.dataset.fatta = '1';
        if (!q.sbagli) q.primo++;
        const sp = box.querySelector('.sv-spiega');
        sp.hidden = false; sp.textContent = d.spiega;
        const avanti = document.createElement('button');
        avanti.type = 'button'; avanti.className = 'g-tasto primo';
        avanti.textContent = q.i + 1 < q.lista.length ? t('Domanda successiva') : t('Compila la scheda');
        avanti.onclick = () => { box.dataset.fatta = ''; q.i++; q.i < q.lista.length ? svDomanda() : svScheda(); };
        box.appendChild(avanti);
      }else{
        q.sbagli++;
        b.classList.add('sbagliata'); b.disabled = true;
      }
    };
    rb.appendChild(b);
  });
}

/* ── la scheda finale ─────────────────────────────────────────────────── */
function svScheda(){
  sv.fase = 5; if (!sv.fine) sv.fine = performance.now();
  svFasi(6);
  svStato();
  if (!sv.foto) svFoto();
  const m = sv.m, d = sv.dim, q = sv.quiz;
  let stelle = 3;
  if (sv.graffi > 3) stelle--;
  if (sv.graffi > 12) stelle--;
  if (q && q.primo < q.lista.length - 1) stelle--;
  stelle = Math.max(1, stelle);
  const sec = Math.floor((sv.fine - sv.t0) / 1000);
  const casa = museoDi(m);
  const isic = m.isic ? (H.senzaRete ? `<b>${m.isic}</b>` : `<a class="isic" href="https://isicily.classics.ox.ac.uk/inscription/${encodeURIComponent(m.isic)}" target="_blank" rel="noopener">${m.isic}</a>`) : t('non ancora assegnato');
  $('#sv-scheda-foto').src = sv.foto;
  $('#sv-scheda-stelle').innerHTML = [1, 2, 3].map(i => `<i class="${i <= stelle ? 'si' : ''}"></i>`).join('');
  $('#sv-scheda-dati').innerHTML = `
    <dt>${t('Inventario')}</dt><dd>${m.titolo}</dd>
    <dt>${t('Conservata a')}</dt><dd>${casa ? t(casa.nome) + ', ' + casa.citta : (m.sede || t('sede non indicata'))}</dd>
    <dt>${t('Dimensioni')}</dt><dd>${svNum(d.w)} × ${svNum(d.h)} × ${svNum(d.d)} cm</dd>
    <dt>I.Sicily</dt><dd>${isic}</dd>
    <dt>${t('Scavo e pulizia')}</dt><dd>${sv.graffi ? tf('{n} graffi', { n: sv.graffi }) : t('nessun graffio')}</dd>
    <dt>${t('Domande')}</dt><dd>${tf('{n} su {tot} al primo colpo', { n: q ? q.primo : 0, tot: q ? q.lista.length : 0 })}</dd>
    <dt>${t('Tempo')}</dt><dd>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</dd>`;
  $('#sv-scheda-giudizio').textContent = stelle === 3 ? t('Lavoro da vero archeologo!')
    : stelle === 2 ? t('Buon lavoro! Con un po\' più di cura la pietra resta intatta.')
    : t('La pietra è salva, ma ha qualche graffio di troppo: la prossima volta usa l\'attrezzo giusto.');
  $('#sv-scheda').hidden = false;
}

function svLibera(){
  if (!sv) return;
  sv.geo && sv.geo.dispose();
  sv.mat && sv.mat.dispose();
  sv.mappa && sv.mappa.dispose();
  const ultimo = sv.ultimo;
  sv = { ultimo };
  if (rend) rend.clear();
  const c = $('#sv-sporco'); c && c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

/* i musei dove oggi sono conservate le epigrafi: servono alle domande di Ex terra */
const MUSEI = [
  { k: 'centuripe', nome: 'Museo archeologico regionale', citta: 'Centuripe', lon: 14.74,  lat: 37.623, re: /centuripe/i, et: 'sx' },
  { k: 'adrano',    nome: 'Museo archeologico regionale', citta: 'Adrano',    lon: 14.832, lat: 37.664, re: /adrano/i, et: 'dx' },
  { k: 'catania',   nome: 'Castello Ursino',              citta: 'Catania',   lon: 15.087, lat: 37.499, re: /catania|ursino/i, et: 'dx' },
  { k: 'siracusa',  nome: 'Museo archeologico Paolo Orsi', citta: 'Siracusa', lon: 15.283, lat: 37.075, re: /siracusa|orsi/i, et: 'dx' },
  { k: 'palermo',   nome: 'Museo archeologico Antonio Salinas', citta: 'Palermo', lon: 13.362, lat: 38.119, re: /palermo|salinas/i, et: 'su' },
];
function museoDi(m){
  const s = (m.sede || '') + ' ' + (m.gruppo || '');
  return MUSEI.find(x => x.re.test(s)) || null;
}

/* ═════════════════════════ collegamenti con la pagina ═════════════════ */
export function preparaGiochi(aiuti){
  H = aiuti;
  $$('[data-gioco]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); apriGioco(b.dataset.gioco); }));
  $('#g-esci').onclick = () => chiudiGioco();
  $('#g-aiuto').onclick = () => ($('#g-guida').hidden ? apriGuida() : chiudiGuida());
  $('#g-guida-ok').onclick = chiudiGuida;
  $('#g-guida').addEventListener('click', e => { if (e.target === $('#g-guida')) chiudiGuida(); });

  // puzzle
  $('#pz-inizia').onclick = pzAvvia;
  $('#pz-nuova').onclick = pzMostraScelta;
  $('#pz-ancora').onclick = pzAvvia;
  $('#pz-altra').onclick = pzMostraScelta;
  $('#pz-riprova').onclick = pzMostraScelta;
  $('#pz-guarda').onclick = () => { const m = st && st.m; chiudiGioco(); if (m) H.apri(m); };
  $('#pz-mescola').onclick = () => { if (st && !st.finito){ pzSpargi(st.pezzi.filter(p => !p.userData.posto)); } };
  $('#pz-sbircia').onclick = () => { if (st && !st.finito) st.sbircia = performance.now(); };
  $('#pz-ruota').onclick = () => { if (st && st.sel && !st.finito) pzRuota(st.sel); };
  const palco = $('#pz-palco');
  palco.addEventListener('pointerdown', pzGiu);
  palco.addEventListener('pointermove', pzMuovi);
  palco.addEventListener('pointerup', pzSu);
  palco.addEventListener('pointercancel', pzSu);
  palco.addEventListener('contextmenu', e => e.preventDefault());
  new ResizeObserver(() => { if (attiva === 'puzzle' && st) pzInquadra(); }).observe(palco);

  addEventListener('keydown', e => {
    if (!attiva) return;
    const scrive = /^(TEXTAREA|INPUT)$/.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape'){
      if (scrive){ e.target.blur(); return; }
      if (!$('#g-guida').hidden){ chiudiGuida(); return; }
      if (attiva === 'lapicida' && lp && lp.v3){ lpChiudi3d(); return; }
      chiudiGioco();
      return;
    }
    if (scrive) return;
    if (attiva === 'puzzle' && st && (e.key === 'r' || e.key === 'R' || e.key === ' ')){
      e.preventDefault(); if (st.sel) pzRuota(st.sel);
    }
    if (attiva === 'lapicida' && lp && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
      e.preventDefault(); lpAnnulla();
    }
  });

  $('#pz-cerca').addEventListener('input', pzDisegnaScelta);

  // dallo scavo al museo
  $('#sv-intro-inizia').onclick = svAvvia;
  $('#sv-riprova').onclick = svIntro;
  $('#sv-avanti').onclick = svAvanti;
  $('#sv-ancora').onclick = svAvvia;
  $('#sv-guarda').onclick = () => { const m = sv && sv.m; chiudiGioco(); if (m) H.apri(m); };
  $('#sv-radente').onclick = () => { if (!sv || !sv.sc3) return; sv.radente = !sv.radente; svLuci(); svCompiti(); };
  $('#sv-luce').addEventListener('input', e => {
    if (!sv || !sv.sc3) return;
    sv.az = +e.target.value;
    if (sv.radente) sv.giroLuce = true;
    svLuci(); svCompiti();
  });
  $('#sv-foto').onclick = () => { if (sv && sv.sc3) svFoto(); };
  const sporco = $('#sv-sporco');
  sporco.addEventListener('pointerdown', svGiu);
  sporco.addEventListener('pointermove', svMuovi);
  sporco.addEventListener('pointerup', svSu);
  sporco.addEventListener('pointercancel', svSu);
  sporco.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') $('#sv-cursore').hidden = true; });
  new ResizeObserver(() => { if (attiva === 'scavo' && sv && sv.sc3) svMisura(); }).observe($('#sv-palco'));

  addEventListener('lingua', () => {
    if (!attiva) return;
    scriviTitolo();
    if (!$('#g-guida').hidden) apriGuida();
    if (attiva === 'puzzle'){
      if (!$('#pz-scelta').hidden) pzDisegnaScelta();
      if (st){
        pzStato();
        $('#pz-sugg').textContent = st.L.ruota ? t('Trascina i frammenti sulla sagoma. Toccali per girarli.') : t('Trascina i frammenti sulla sagoma.');
        if (st.finito) pzFinitoTesti();
      }
    }else if (attiva === 'lapicida'){ if (lp && lp._pronto) lpEtichette(); }
    else if (attiva === 'scavo' && sv){
      if (!sv.sc3){ svFasi(0); return; }
      if (sv.fase <= 4){
        const [tit, testo] = TESTI_FASE[sv.fase];
        $('#sv-fase-n').textContent = tf('Fase {n} di 5', { n: sv.fase });
        $('#sv-fase-t').textContent = t(tit); $('#sv-fase-p').textContent = t(testo);
        svFasi(sv.fase);
        if (sv.fase <= 2){ svAttrezzi(); svControlla(); }
        if (sv.fase === 3) svCompiti();
        if (sv.fase === 4){ const i = sv.quiz.i, p = sv.quiz.primo; sv.quiz = { lista: svDomande(), i, primo: p, sbagli: 0 }; svDomanda(); }
      }else svScheda();
      svStato(); sv.rifaiSporco = true;
    }
  });

  // per le prove automatiche
  window.__giochi = {
    get puzzle(){ return st; },
    get lapicida(){ return lp; },
    get scavo(){ return sv; },
    pulisci(){
      if (!sv || !sv.strati) return;
      const nomi = sv.fase === 1 ? ['terra'] : ['polvere', 'croste', 'velo'];
      for (const k of nomi){ const x = sv.strati[k].getContext('2d'); x.globalCompositeOperation = 'destination-out'; x.drawImage(sv.silC, 0, 0); x.globalCompositeOperation = 'source-over'; }
      sv.rifaiSporco = true; svControlla();
    },
    risolvi(){
      if (!st) return;
      for (const p of st.pezzi){
        if (p.userData.posto) continue;
        p.position.set(p.userData.cx, p.userData.cy, p.position.z);
        p.userData.giro = Math.round(p.rotation.z / (Math.PI / 2));
        p.userData.giro -= ((p.userData.giro % 4) + 4) % 4;
        p.rotation.z = p.userData.giro * Math.PI / 2;
        pzVerifica(p);
      }
    },
  };
}
