// The protein alphabet: a showcase of what plain HTML, SVG and CSS transitions can do between clicks, with
// no canvas at all. The drawings are RDKit depictions (tools/prep_amino_acids.py) in placeholder colours that
// the slide swaps for the theme's, so they work in both themes.
//
// Steps: 1 one amino acid, split into the backbone all of them share and a side chain R · 2 all twenty,
// grouped by kind, backbones lined up so that only the side chains differ · 3 seven of them stand out (the
// first seven residues of ubiquitin, the protein on the cartoon slide) · 4 they fly out of the grid into a row,
// in chain order · 5 every other one turns over, so each acid end meets the next one's amine · 6 they join
// head to tail, each peptide bond giving off a water.
//
// Geometry (the second slide here): that stretch in 3D, drawn the way Mol* draws it (web/addons/molstar.js).
// 1 the joined chain exactly as the alphabet slide leaves it · 2 its atoms take over the drawing and lift into
// the chain's real 3D shape (residues 1-7 of ubiquitin, PDB 1UBQ): all atom, the side chains tell you each
// residue · 3 backbone only: they go, and so does the identity · 4 what is left is the same N-Cα-C(=O) unit in
// every residue. Drag to turn it; from step 2 a switch shows or hides the side chains.
//
// The pattern for an animated step (go() in both slides): a forward click from the step before plays the
// transition; any other arrival (going back, jumping in) calls apply(), which sets that step's end state at once.
{
// colours of the five kinds of amino acid, per theme (kept here rather than in the deck's palette, since
// only this slide uses them)
const CLASSES = {
  dark: { hydrophobic: '#e0b85a', polar: '#5bc0be', special: '#c58cf0', positive: '#6c8cff', negative: '#ef6b6b' },
  light: { hydrophobic: '#a87400', polar: '#0d8580', special: '#8a4fd0', positive: '#3a5bd9', negative: '#cf3434' },
};
const ALPHABET = {
  heading: 'The protein alphabet',
  chainHeading: 'From amino acids to a protein chain',
  backbone: ['backbone', 'the same in every amino acid'],
  side: ['side chain', 'one of 20: what makes each amino acid itself'],
  captions: {
    4: 'Lined up in the order they come in the chain.',
    6: 'Each link, a peptide bond, gives off one water (H₂O).',
  },
  rows: [  // [class, label] groups per row
    [['hydrophobic', 'hydrophobic'], ['special', 'special cases']],
    [['polar', 'polar, uncharged'], ['positive', 'positive charge'], ['negative', 'negative charge']],
  ],
};
const TILE = 7.1;    // width of one amino acid's tile, in units of --u (1% of the frame's width)
const BIG = 0.105;   // --u per drawing pixel for the single amino acid of step 1
const CHAIN = { x: 18, y: 11.5, width: 64 };  // where the joined chain's drawing sits, in --u (both slides)
const GAP = 60;      // drawing pixels between neighbouring amino acids before they join (clear of OH and H2N)
// The peptide's drawings colour each side chain by its own class (placeholders from tools/prep_amino_acids.py).
const paintChain = (P, svg) => [['#010101', P.fg], ['#020202', P.el.N], ['#030303', P.el.O], ['#040404', P.el.S],
  ['#0a0a0a', P.classes.hydrophobic], ['#0b0b0b', P.classes.polar], ['#0c0c0c', P.classes.positive],
  ['#0d0d0d', P.classes.negative], ['#0e0e0e', P.classes.special]].reduce((t, [a, b]) => t.replaceAll(a, b), svg);

Deck.slide('alphabet', {
  steps: 6,
  notes: 'Every amino acid has the same backbone: amine, Cα, carboxyl. Only the side chain differs, and there '
    + 'are 20 of them. The seven picked out are the first seven residues of ubiquitin (MQIFVKT). Joining two '
    + 'amino acids (a peptide bond) releases a water molecule. Everything here is HTML and SVG moved by CSS '
    + 'transitions; step back and forth to see each state rebuilt.',

  mount(frame, { theme, palette, data, css, esc }) {
    const P = { ...palette, classes: CLASSES[theme] };
    css(`
      .aa-at { position: absolute; }
      .aa-at svg { display: block; width: 100%; height: auto; }
      .aa-draw { overflow: hidden; }
      .aa-draw svg { display: block; width: 100%; height: auto; }
      .aa-grid { position: absolute; left: 4.2%; top: calc(10 * var(--u)); display: flex; flex-direction: column;
        gap: calc(2.6 * var(--u)); }
      .aa-rowbox { display: flex; gap: calc(1.4 * var(--u)); }
      .aa-class { position: relative; display: flex; padding: calc(.9 * var(--u)) calc(.3 * var(--u)) calc(1.3 * var(--u)); }
      /* the outline is its own layer, so step 3 can dim it (and the name) without dimming the tiles inside */
      .aa-class::before { content: ''; position: absolute; inset: 0; border: 1.5px solid var(--c);
        border-radius: calc(1.1 * var(--u)); transition: opacity .4s; pointer-events: none; }
      .aa-group { z-index: 1; }
      .aa-group i { font-style: normal; transition: opacity .4s; }
      .aa-group { position: absolute; left: calc(.7 * var(--u)); padding: 0 .45em; background: var(--bg);
        font-size: calc(1.2 * var(--u)); font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
        line-height: 1; white-space: nowrap; }
      .aa-group.above { top: -.55em; }
      .aa-group.below { bottom: -.5em; }
      .aa-tile { position: relative; }
      .aa-label { text-align: center; line-height: 1.25; white-space: nowrap; }
      .aa-one { font-size: calc(1.6 * var(--u)); font-weight: 700; }
      .aa-three { font-size: calc(1.2 * var(--u)); color: var(--muted); margin-left: .3em; }
      .aa-name { font-size: calc(1.05 * var(--u)); color: var(--muted); }
      .aa-box { position: absolute; border-radius: .9em; border: 2px dashed; }
      .aa-note { position: absolute; line-height: 1.3; }
      .aa-note b { display: block; font-size: var(--t-lead); font-weight: 600; }
      .aa-note span { font-size: var(--t-small); color: var(--muted); }
      .aa-caption { position: absolute; left: 4.2%; top: 87%; width: 92%; font-size: var(--t-body); }
      .aa-fade { opacity: 0; transition: opacity .5s; }
      .aa-fade.in { opacity: 1; }
      .instant .aa-fade { transition: none; }
      /* step 3: everything but the seven picks fades right back; the class names fade their text only, keeping
         their solid patch over the outline */
      .aa-pick-on .aa-tile.in:not(.aa-pick) { opacity: .07; }
      .aa-pick-on .aa-class::before { opacity: .12; }
      .aa-pick-on .aa-group i { opacity: .12; }
      .aa-badge { position: absolute; left: 0; top: calc(-.4 * var(--u)); width: calc(2 * var(--u));
        height: calc(2 * var(--u)); border-radius: 50%; background: var(--accent); color: var(--bg);
        font: 700 var(--t-micro) / calc(2 * var(--u)) Lato, sans-serif; text-align: center; opacity: 0;
        transition: opacity .4s; }
      .aa-pick-on .aa-badge { opacity: 1; }
      .aa-free, .aa-chain { position: absolute; transform-origin: 0 0; }
      .aa-free { opacity: 0; }
      .aa-free.in { opacity: 1; }
      .aa-card { position: absolute; transform-style: preserve-3d;
        transition: opacity .5s, transform 1.6s cubic-bezier(.45, 0, .25, 1); }
      .aa-card.still, .instant .aa-card { transition: none; }
      /* Safari: needs the -webkit- prefix to hide a turned card's front (else it shows through, mirrored), and
         does not pass a preserve-3d card's opacity on to its faces, so the faces fade themselves too */
      .aa-face { position: absolute; inset: 0; -webkit-backface-visibility: hidden; backface-visibility: hidden;
        transition: opacity .5s; transition-delay: inherit; }
      .aa-card:not(.in) .aa-face { opacity: 0; }
      .aa-card.still .aa-face, .instant .aa-card .aa-face { transition: none; }
      .aa-face svg { display: block; width: 100%; height: 100%; overflow: visible; }
      .aa-back { transform: rotateX(180deg); }
      .aa-num { position: absolute; margin-left: calc(-1 * var(--u)); width: calc(2 * var(--u)); height: calc(2 * var(--u));
        border-radius: 50%; background: var(--accent); color: var(--bg); text-align: center;
        font: 700 var(--t-micro) / calc(2 * var(--u)) Lato, sans-serif; }
      .aa-num { transition: opacity .3s, transform 1.6s cubic-bezier(.45, 0, .25, 1); }
      .aa-num.still, .instant .aa-num { transition: none; }
      .aa-num:not(.in) { transition-delay: 0s !important; }
      .aa-free svg, .aa-chain svg { overflow: visible; }
      .aa-free svg, .aa-chain svg { display: block; width: 100%; height: 100%; }
      .aa-free { transition: opacity .5s, left 1s cubic-bezier(.6, 0, .3, 1), transform 1.3s cubic-bezier(.5, 0, .25, 1); }
      .instant .aa-free, .aa-free.still { transition: none; }
      .aa-joining .aa-free { transition: opacity .25s, left 1s cubic-bezier(.6, 0, .3, 1); transition-delay: 0s; }
      .aa-joining .aa-chain { transition-duration: .35s; }
      .aa-water { position: absolute; transform: translate(-50%, -50%); font-size: var(--t-small); font-weight: 700;
        color: ${P.el.O}; opacity: 0; pointer-events: none; }
      .aa-water.go { animation: aa-water 1.8s ease-out forwards; }
      @keyframes aa-water { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.6); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        70% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, calc(-50% - 5 * var(--u))); } }
    `);
    const D = data.amino_acids;
    const pep = D.peptide;
    const u = (v) => `calc(${v} * var(--u))`;
    const paint = (svg, cls) => [['#010101', P.fg], ['#020202', P.el.N], ['#030303', P.el.O], ['#040404', P.el.S],
      ['#0a0a0a', cls ? P.classes[cls] : P.accent], ['#191919', P.accent]].reduce((s, [a, b]) => s.replaceAll(a, b), svg);

    // Step 1: the generic amino acid, large, with boxes round its backbone and its side chain.
    const g = D.generic;
    const gx = 12, gy = 14;  // where its drawing sits, in --u
    const box = (pts, pad) => {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { x: gx + (Math.min(...xs) - pad[0]) * BIG, y: gy + (Math.min(...ys) - pad[1]) * BIG,
               w: (Math.max(...xs) - Math.min(...xs) + 2 * pad[0]) * BIG,
               h: (Math.max(...ys) - Math.min(...ys) + pad[1] + pad[2]) * BIG };
    };
    const bb = box(g.atoms.slice(0, 5), [30, 26, 22]);   // N, Cα, C, O and OH, with room for their labels
    const sc = box(g.atoms.slice(5), [22, 16, 18]);
    const single = `
      <div class="aa-at aa-fade" data-show="1" style="left:${u(gx)}; top:${u(gy)}; width:${u(g.size[0] * BIG)}">
        ${paint(g.svg)}</div>
      <div class="aa-box aa-fade" data-show="1" style="left:${u(bb.x)}; top:${u(bb.y)}; width:${u(bb.w)};
        height:${u(bb.h)}; border-color:${P.muted}"></div>
      <div class="aa-box aa-fade" data-show="1" style="left:${u(sc.x)}; top:${u(sc.y)}; width:${u(sc.w)};
        height:${u(sc.h)}; border-color:${P.accent}"></div>
      <div class="aa-note reveal-in" data-show="1" style="left:${u(bb.x + bb.w + 4)}; top:${u(bb.y + 1.2)}; --i:1">
        <b>${esc(ALPHABET.backbone[0])}</b><span>${esc(ALPHABET.backbone[1])}</span></div>
      <div class="aa-note reveal-in" data-show="1" style="left:${u(bb.x + bb.w + 4)}; top:${u(sc.y + 0.6)}; --i:2">
        <b style="color:${P.accent}">${esc(ALPHABET.side[0])} <i>R</i></b><span>${esc(ALPHABET.side[1])}</span></div>`;

    // Steps 2-3: all twenty, a row per line of ALPHABET.rows, each row's drawings as deep as its deepest side
    // chain. Each class sits in a rounded box (sized by its content) with its name on the box's edge: above the
    // box on the top row, below it on the bottom row, so the names keep clear of the amino acids' own labels.
    const scale = TILE / D.amino_acids[0].size[0];  // --u per drawing pixel
    let k = 0, n = 0;  // tiles and boxes so far, for staggering their fade-ins
    const tiles = `<div class="aa-grid">${ALPHABET.rows.map((groups, row) => {
      const members = groups.flatMap(([cls]) => D.amino_acids.filter((a) => a.class === cls));
      const depth = Math.max(...members.map((a) => a.bottom)) * scale;
      return `<div class="aa-rowbox">${groups.map(([cls, label]) => `<div class="aa-class aa-fade" data-show="2 3"
          style="--c:${P.classes[cls]}; transition-delay:${0.1 * n++}s">
        <span class="aa-group ${row ? 'below' : 'above'}" style="color:${P.classes[cls]}"><i>${esc(label)}</i></span>
        ${D.amino_acids.filter((m) => m.class === cls).map((a) => {
          const order = pep.seq.indexOf(a.one);
          return `<div class="aa-tile aa-fade${order >= 0 ? ' aa-pick' : ''}" data-show="2 3" data-one="${a.one}"
              style="width:${u(TILE)}; transition-delay:${0.04 * k++}s">
            <div class="aa-draw" style="height:${u(depth)}">${paint(a.svg, a.class)}</div>
            <div class="aa-label"><span class="aa-one" style="color:${P.classes[a.class]}">${esc(a.one)}</span><span
              class="aa-three">${esc(a.three)}</span><div class="aa-name">${esc(a.name)}</div></div>
            ${order >= 0 ? `<div class="aa-badge">${order + 1}</div>` : ''}</div>`;
        }).join('')}</div>`).join('')}</div>`;
    }).join('')}</div>`;

    // Steps 4-6: the chain, on one canvas (pep.size pixels) drawn R --u per pixel at CHAIN.
    const R = CHAIN.width / pep.size[0];
    const H = pep.size[1] * R;
    const apart = (k2) => (k2 - (pep.residues.length - 1) / 2) * GAP * R;  // --u each sits off its joined place
    // Steps 4-5: each of the seven as a card in the row. Its front is its alphabet drawing (side chain down, as
    // in the grid); its back is the same amino acid the way it sits in the chain. Step 4 moves the cards out
    // of the grid without turning them; step 5 turns over the ones whose side chain points up in the chain,
    // about a horizontal line through their Cα.
    const cards = pep.residues.map((r, k2) => {
      const a = D.amino_acids.find((m) => m.one === r.one);
      const cx = a.ca[0] * R, cy = a.ca[1] * R;  // the Cα, within the card
      const left = CHAIN.x + apart(k2) + r.ca[0] * R - cx, top = CHAIN.y + r.ca[1] * R - cy;
      return `<div class="aa-card aa-fade" data-show="4 5" data-k="${k2}" style="left:${u(left)}; top:${u(top)};
          width:${u(a.size[0] * R)}; height:${u(a.size[1] * R)}; transform-origin:${u(cx)} ${u(cy)};
          transition-delay:${0.15 * k2}s">
        <div class="aa-face">${paint(a.svg, a.class)}</div>
        <div class="aa-face aa-back" style="transform-origin:${u(cx)} ${u(cy)}">
          <div style="position:absolute; left:${u(cx - r.ca[0] * R)}; top:${u(cy - r.ca[1] * R)}; width:${u(CHAIN.width)};
            height:${u(H)}">${paintChain(P, r.svg)}</div></div></div>`;
    }).join('');
    // the chain-order numbers, on a line under the row (so they stay put while cards turn over), below the
    // lowest drawing before the turn (side chains all hang down then)
    const lowest = Math.max(H, ...pep.residues.map((r) => {
      const a = D.amino_acids.find((m) => m.one === r.one);
      return r.ca[1] * R + (a.bottom - a.ca[1]) * R;
    }));
    const numbers = pep.residues.map((r, k2) => `<div class="aa-num aa-fade" data-show="4 5"
      data-k="${k2}" style="left:${u(CHAIN.x + apart(k2) + r.ca[0] * R)}; top:${u(CHAIN.y + lowest + 0.4)};
      transition-delay:${0.15 * k2}s">${k2 + 1}</div>`).join('');
    const free = pep.residues.map((r, k2) => `<div class="aa-free" style="left:${u(CHAIN.x + apart(k2))};
      top:${u(CHAIN.y)}; width:${u(CHAIN.width)}; height:${u(H)}">${paintChain(P, r.svg)}</div>`).join('');
    const water = pep.residues.slice(0, -1).map((r) => `<div class="aa-water" style="left:${u(CHAIN.x + r.oh[0] * R)};
      top:${u(CHAIN.y + r.oh[1] * R)}">H<sub>2</sub>O</div>`).join('');

    frame.innerHTML = `
      <h2 class="deck-heading reveal-in" data-show="1 2 3">${esc(ALPHABET.heading)}</h2>
      <h2 class="deck-heading reveal-in" data-show="4 5 6">${esc(ALPHABET.chainHeading)}</h2>
      ${single}${tiles}
      <div class="aa-chain aa-fade" data-show="6" style="left:${u(CHAIN.x)}; top:${u(CHAIN.y)}; width:${u(CHAIN.width)};
        height:${u(H)}">${paintChain(P, pep.svg)}</div>
      ${cards}${numbers}${free}${water}
      ${Object.entries(ALPHABET.captions).map(([st, c]) => `<div class="aa-caption reveal-in" data-show="${st}"
        style="--i:4">${esc(c)}</div>`).join('')}`;
    const shows = [...frame.querySelectorAll('[data-show]')].map((el) => [el, el.dataset.show.split(' ').map(Number)]);
    const cardEls = [...frame.querySelectorAll('.aa-card')];
    const numEls = [...frame.querySelectorAll('.aa-num')];
    const frees = [...frame.querySelectorAll('.aa-free')];
    const waters = [...frame.querySelectorAll('.aa-water')];

    // where a tile's drawing sits now, in --u from the frame's top-left (1 --u is 1% of the frame's width)
    const tileAt = (one) => {
      const f = frame.getBoundingClientRect(), d = frame.querySelector(`.aa-tile[data-one="${one}"] .aa-draw`).getBoundingClientRect();
      return { x: (d.left - f.left) / f.width * 100, y: (d.top - f.top) / f.width * 100 };
    };
    // A card's flight starts on its tile: moved and scaled so its Cα sits on the tile's Cα, at the tile's size.
    const fromTile = (k2) => {
      const r = pep.residues[k2], a = D.amino_acids.find((m) => m.one === r.one), t = tileAt(r.one);
      const gx = t.x + a.ca[0] * scale, gy = t.y + a.ca[1] * scale;
      const cx = CHAIN.x + apart(k2) + r.ca[0] * R, cy = CHAIN.y + r.ca[1] * R;
      return `translate(${u(gx - cx)}, ${u(gy - cy)}) scale(${scale / R})`;
    };
    // A number's flight starts on its badge in the grid.
    const fromBadge = (k2) => {
      const f = frame.getBoundingClientRect();
      const b = frame.querySelector(`.aa-tile[data-one="${pep.residues[k2].one}"] .aa-badge`).getBoundingClientRect();
      const n = numEls[k2].getBoundingClientRect();
      const d = (a, c) => (a - c) / f.width * 100;
      return `translate(${u(d(b.left + b.width / 2, n.left + n.width / 2))}, ${u(d(b.top + b.height / 2, n.top + n.height / 2))})`;
    };
    const FLAT = 'perspective(calc(60 * var(--u))) rotateX(0deg)';
    const turned = (k2) => `perspective(calc(60 * var(--u))) rotateX(${pep.residues[k2].up ? 180 : 0}deg)`;
    const place = (joined) => frees.forEach((el, k2) => { el.style.left = u(CHAIN.x + (joined ? 0 : apart(k2))); });

    let step = 0, run = 0;
    const later = (ms, id) => new Promise((done) => setTimeout(() => done(id === run), ms));
    function show(target, animate) {
      frame.classList.toggle('instant', !animate);
      void frame.offsetWidth;  // flush styles, so a fresh mount fades in from the hidden state
      for (const [el, steps] of shows) el.classList.toggle('in', steps.includes(target));
      // stays on into step 4, so the dimmed grid fades out dimmed rather than flashing back first
      frame.classList.toggle('aa-pick-on', target === 3 || target === 4);
    }
    // jump straight to step k
    function apply(k, animate) {
      cardEls.forEach((el, k2) => { el.classList.add('still'); el.style.transform = k >= 5 ? turned(k2) : FLAT; });
      numEls.forEach((el) => { el.style.transform = 'none'; });
      frees.forEach((el) => el.classList.remove('in'));
      place(true);
      show(k, animate);
      void frame.offsetWidth;
      cardEls.forEach((el) => el.classList.remove('still'));
    }
    async function go(target, animate) {
      const id = ++run;
      const from = step;
      step = target;
      waters.forEach((w) => w.classList.remove('go'));
      frame.classList.remove('aa-joining');
      const way = animate && target === from + 1;
      if (way && target === 4) {
        // out of the grid, one after another, each still the way the grid draws it, its number with it
        numEls.forEach((el) => { el.classList.add('still'); el.style.transform = 'none'; });
        void frame.offsetWidth;
        const starts = numEls.map((_, k2) => fromBadge(k2));
        cardEls.forEach((el, k2) => { el.classList.add('still'); el.style.transform = fromTile(k2); });
        numEls.forEach((el, k2) => { el.style.transform = starts[k2]; });
        void frame.offsetWidth;
        cardEls.forEach((el) => el.classList.remove('still'));
        numEls.forEach((el) => el.classList.remove('still'));
        show(4, true);
        void frame.offsetWidth;
        cardEls.forEach((el) => { el.style.transform = FLAT; });
        numEls.forEach((el) => { el.style.transform = 'none'; });
        return;
      }
      if (way && target === 5) {
        // turn over every other one, so each acid end (COOH) meets the next one's amine (H2N)
        show(5, true);
        cardEls.forEach((el, k2) => { el.style.transform = turned(k2); });
        return;
      }
      if (way && target === 6) {
        // the cards hand over to the same drawings on the chain's canvas (they look identical), which close up
        // head to tail; then the chain takes over and each new peptide bond lets a water go
        place(false);
        frees.forEach((el) => { el.classList.add('still', 'in'); });
        cardEls.forEach((el) => { el.classList.add('still'); el.classList.remove('in'); });
        void frame.offsetWidth;
        frees.forEach((el) => el.classList.remove('still'));
        frame.classList.remove('instant');
        frame.classList.add('aa-joining');
        place(true);
        if (!(await later(1000, id))) return;
        show(6, true);
        frees.forEach((el) => el.classList.remove('in'));
        waters.forEach((w, k2) => setTimeout(() => id === run && w.classList.add('go'), 150 + 90 * k2));
        if (await later(800, id)) frame.classList.remove('aa-joining');
        return;
      }
      apply(target, animate);
    }
    return {
      enter(target, animate) { go(target, animate); },
      get step() { return step; },
    };
  },
});

// ---------------------------------------------------------------------------------------------------------------

const BACKBONE = {
  heading: 'All-atom vs backbone',
  captions: [
    'In the protein, this chain is not flat: it has a real shape in 3D.',
    'All-atom: every heavy atom. The side chains tell you which amino acid each residue is.',
    'Backbone only: N, Cα, C and O of each residue. Which amino acid? You can no longer tell.',
    'Without its side chain, every residue is the same N–Cα–C(=O) unit, repeated along the chain.',
  ],
};
// Scene units: the camera faces the chain head-on and the frame is 16 x 9 units at its depth (x right, z up).
const VIEW = { fov: 30, distance: 4.5 / Math.tan(Math.PI / 12) };
const FIT = { width: 13, height: 3.9, z: 0.45 };   // the box the chain is scaled into, and its centre height
const ROCK = { amp: 0.4, speed: 0.55 }, TILT = 0.18;
const toScene = ([x, y, z]) => [x, -z, y];        // data: x right, y up, z toward the viewer
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

Deck.slide('backbone', {
  smoothBack: true,   // its camera moves (and lifts) play in reverse on one click back
  steps: 4,
  interactive: true,
  notes: 'The same seven residues as the alphabet slide; the drawing lifts into their real 3D shape, residues 1-7 '
    + 'of ubiquitin in PDB 1UBQ. All-atom: every heavy atom; backbone: N, Cα, C, O of each residue. A backbone '
    + 'model sees the shape of the chain, not which amino acid is where. Drag to turn it; from step 2 the switch '
    + 'shows or hides the side chains. The lift is one Molecule3D whose atom positions are interpolated from '
    + 'where the drawing put them to their real coordinates.',

  mount(frame, { theme, palette, data, M, css, esc }) {
    const P = { ...palette, classes: CLASSES[theme] };
    css(`
      .bb-scene, .bb-labels { position: absolute; inset: 0; }
      .bb-scene { touch-action: none; cursor: grab; }
      .bb-scene:active { cursor: grabbing; }
      .bb-labels { pointer-events: none; overflow: hidden; }
      .bb-res { position: absolute; top: 69%; transform: translateX(-50%); text-align: center; }
      .bb-res span { display: block; transition: opacity .5s; }
      .bb-one { font-size: var(--t-lead); font-weight: 700; }
      .bb-unknown { position: absolute; left: 0; right: 0; top: 0; font-size: var(--t-lead); font-weight: 700;
        color: var(--muted); opacity: 0; }
      .bb-num { font-size: var(--t-micro); color: var(--muted); }
      .bb-hidden .bb-one { opacity: 0; }
      .bb-hidden .bb-unknown { opacity: 1; }
      .instant .bb-res span, .instant .bb-unit { transition: none; }
      .bb-unit { position: absolute; border-radius: .8em; opacity: 0; transition: opacity .4s;
        border: 2px solid color-mix(in srgb, var(--accent) 75%, transparent);
        background: color-mix(in srgb, var(--accent) 7%, transparent); }
      .bb-units .bb-unit { opacity: 1; }
      .bb-tag { position: absolute; transform: translate(-50%, -50%); font-size: var(--t-micro); font-weight: 700;
        color: var(--fg); opacity: 0; transition: opacity .4s; text-shadow: 0 0 .3em var(--bg), 0 0 .3em var(--bg); }
      .bb-units .bb-tag { opacity: 1; }
      .instant .bb-tag { transition: none; }
      .bb-caption { position: absolute; left: 4.2%; top: 87%; width: 92%; font-size: var(--t-body); }
      .bb-caption div { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity .5s; }
      .bb-caption div.in { opacity: 1; }
      .instant .bb-caption div { transition: none; }
      .bb-source { position: absolute; left: 4.2%; top: 14.5%; font-size: var(--t-small); color: var(--detail); }
      .bb-count { position: absolute; right: 4%; top: 14.5%; font-size: var(--t-small); color: var(--muted);
        text-align: right; }
      .bb-count b { color: var(--fg); font-weight: 600; }
      .bb-switch { position: absolute; right: 4%; top: 20%; display: flex; align-items: center; gap: .55em;
        padding: .3em .2em; border: 0; background: none; color: var(--muted); cursor: pointer;
        font: 400 var(--t-caption) Lato, "Helvetica Neue", sans-serif; transition: opacity .5s; }
      .bb-switch i { position: relative; width: 2.3em; height: 1.25em; border-radius: 1em; background: var(--muted);
        opacity: .55; transition: background .25s, opacity .25s; }
      .bb-switch i::after { content: ''; position: absolute; left: .15em; top: .15em; width: .95em; height: .95em;
        border-radius: 50%; background: var(--bg); transition: transform .25s; }
      .bb-switch[aria-pressed="true"] i { background: var(--accent); opacity: 1; }
      .bb-switch[aria-pressed="true"] i::after { transform: translateX(1.05em); }
      .bb-flatstate .bb-switch { opacity: 0; pointer-events: none; }
      .bb-res, .bb-count { transition: opacity .5s; }
      .bb-flatstate .bb-res, .deck-frame.bb-flatstate .bb-count.reveal-in { opacity: 0; }
      .instant .bb-res, .instant .bb-count { transition: none; }
      .bb-flat { position: absolute; pointer-events: none; opacity: 0; transition: opacity .5s; }
      .bb-flat.in { opacity: 1; }
      .bb-flat svg { display: block; width: 100%; height: 100%; overflow: visible; }
      .instant .bb-flat { transition: none; }
    `);
    const seg = data.amino_acids.segment;   // tools/prep_amino_acids.py --structure
    const AA = Object.fromEntries(data.amino_acids.amino_acids.map((a) => [a.one, a.class]));
    const pep = data.amino_acids.peptide;
    const R = CHAIN.width / pep.size[0];  // --u per drawing pixel, as on the alphabet slide
    frame.innerHTML = `
      <div class="bb-scene"></div>
      <div class="bb-flat" style="left:calc(${CHAIN.x} * var(--u)); top:calc(${CHAIN.y} * var(--u));
        width:calc(${CHAIN.width} * var(--u)); height:calc(${pep.size[1] * R} * var(--u))">${paintChain(P, pep.svg)}</div>
      <div class="bb-labels">
        ${seg.residues.map((r) => `<div class="bb-res"><span class="bb-one" style="color:${P.classes[AA[r.one]] || P.fg}">${
          esc(r.one)}</span><span class="bb-unknown">?</span><span class="bb-num">${esc(r.three)}${r.num}</span></div>`).join('')}
        ${seg.residues.map(() => '<div class="bb-unit"></div>').join('')}
        ${['N', 'Cα', 'C', 'O'].map((n) => `<div class="bb-tag">${n}</div>`).join('')}
      </div>
      <h2 class="deck-heading reveal-in in">${esc(BACKBONE.heading)}</h2>
      <div class="bb-source reveal-in" style="--i:1">Residues ${seg.residues[0].num}–${seg.residues.at(-1).num} of
        ubiquitin (PDB ${esc(seg.source)})</div>
      <div class="bb-count reveal-in" style="--i:1"></div>
      <button class="bb-switch" aria-pressed="true"><i></i>side chains</button>
      <div class="bb-caption">${BACKBONE.captions.map((c) => `<div>${esc(c)}</div>`).join('')}</div>`;
    const host = frame.querySelector('.bb-scene');
    const resLabels = [...frame.querySelectorAll('.bb-res')];
    const units = [...frame.querySelectorAll('.bb-unit')];
    const tags = [...frame.querySelectorAll('.bb-tag')];
    const captions = [...frame.querySelectorAll('.bb-caption div')];
    const count = frame.querySelector('.bb-count');
    const intro = [...frame.querySelectorAll('.reveal-in')];
    const flatDrawing = frame.querySelector('.bb-flat');

    const scene = new M.ThreeDScene(host, {
      backgroundOpacity: 0, phi: Math.PI / 2, theta: -Math.PI / 2, distance: VIEW.distance, fov: VIEW.fov,
      enableOrbitControls: false,
    });
    const look = Deck.molstar(scene, { fog: [VIEW.distance - 1, VIEW.distance + 4] });
    const cam = scene.camera3D.getCamera();
    const mol = new M.Molecule3D({
      atoms: seg.atoms.map((a, i) => ({ element: a.el, position: toScene(seg.xyz[i]) })),
      bonds: seg.bonds.map(([from, to, order]) => ({ from, to, order })),
      colors: P.cpk, radiusScheme: 'covalent', radiusScale: 0.42, bondRadius: 0.11, sphereResolution: 16,
    });
    const xs = seg.xyz.map((p) => p[0]), ys = seg.xyz.map((p) => p[1]);
    const s = Math.min(FIT.width / (Math.max(...xs) - Math.min(...xs)), FIT.height / (Math.max(...ys) - Math.min(...ys)));
    look.scale(s);
    let molOpacity = 0, molIn = false;
    function fadeMol(a) {
      molOpacity = a;
      if (a > 0 && !molIn) { scene.add(mol); molIn = true; }
      if (a <= 0 && molIn) { scene.remove(mol); molIn = false; }
      if (molIn) { mol.opacity = a; if (sideLevel < 1) setSide(sideLevel); }  // opacity resets every part
    }
    // The side chain is everything but N, Cα, C, O; its bonds include Cα-Cβ. (Looked up when needed: the
    // lift rebuilds the bonds.)
    const sideParts = () => [
      ...seg.atoms.map((a, i) => (a.bb ? null : [mol.getAtoms()[i].sphere, mol.atomsGroup])).filter(Boolean),
      ...mol.getBonds().filter((b) => !seg.atoms[b.from].bb || !seg.atoms[b.to].bb)
        .flatMap((b) => b.sticks.map((m) => [m, mol.bondsGroup]))];
    // a = 1 shows the side chains; at 0 they stay as a faint ghost. Faded ones stop writing depth, so the
    // Mol*-style outline and shading treat them as see-through.
    const FAINT = 0.12;
    let sideLevel = 1;
    function setSide(a) {
      sideLevel = a;
      const op = FAINT + (1 - FAINT) * a;
      for (const [m] of sideParts()) {
        m.opacity = op;
        m.getThreeObject().traverse((o) => { if (o.material) o.material.depthWrite = op > 0.99; });
      }
    }
    // Flat: each atom where the alphabet slide drew it. The frame is 16 x 9 scene units at the chain's depth,
    // so a point on the drawing maps straight into the scene; divided by s and offset by FIT.z, it is in the
    // model's own coordinates. morph 0 is the drawing, 1 the real shape (the model is built at 1).
    const flat = seg.atoms.map((a) => {
      const [px, py] = pep.atoms[`${a.res} ${a.name}`];
      const x = ((CHAIN.x + px * R) - 50) * 16 / 100, z = (28.125 - (CHAIN.y + py * R)) * 9 / 56.25;
      return [x / s, 0, (z - FIT.z) / s];
    });
    let morph = 1, built = 1;
    function applyMorph() {
      if (morph === built) return;
      mol.setAtomPositions(seg.xyz.map((p, i) => toScene(p).map((v, c) => flat[i][c] + (v - flat[i][c]) * morph)));
      if (molIn) { mol.opacity = molOpacity; if (sideLevel < 1) setSide(sideLevel); }  // rebuilt bonds start opaque
      built = morph;
    }

    let theta = 0, tilt = TILT, base = 0, phase = 0, held = false, resume = 0, rocking = false;
    const euler = new M.THREE.Euler();
    const world = (i) => new M.THREE.Vector3(...toScene(seg.xyz[i])).multiplyScalar(s).applyEuler(euler)
      .add(new M.THREE.Vector3(0, 0, FIT.z));
    const project = (v) => {
      const p = v.clone().project(cam);
      return [(p.x + 1) / 2 * host.clientWidth, (1 - p.y) / 2 * host.clientHeight];
    };
    // HTML on the scene: residue labels under each Cα, a box round each residue's backbone, atom names on one.
    function place() {
      if (!host.clientWidth) return;
      cam.updateMatrixWorld();
      seg.ca.forEach((i, k) => { resLabels[k].style.left = `${project(world(i))[0]}px`; });
      const pad = host.clientWidth * 0.009;
      seg.residues.forEach((_, k) => {
        const pts = seg.atoms.map((a, i) => (a.res === k && a.bb ? project(world(i)) : null)).filter(Boolean);
        const x0 = Math.min(...pts.map((p) => p[0])) - pad, x1 = Math.max(...pts.map((p) => p[0])) + pad;
        const y0 = Math.min(...pts.map((p) => p[1])) - pad, y1 = Math.max(...pts.map((p) => p[1])) + pad;
        Object.assign(units[k].style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
      });
      // the middle residue's atom names, each pushed out from the middle of its unit
      const mid = Math.floor(seg.residues.length / 2);
      const unit = ['N', 'CA', 'C', 'O'].map((n) => project(world(seg.atoms.findIndex((a) => a.res === mid && a.name === n))));
      const cx = unit.reduce((a, p) => a + p[0], 0) / 4, cy = unit.reduce((a, p) => a + p[1], 0) / 4;
      unit.forEach(([x, y], j) => {
        const d = Math.hypot(x - cx, y - cy) || 1, push = host.clientWidth * 0.02;
        Object.assign(tags[j].style, { left: `${x + (x - cx) / d * push}px`, top: `${y + (y - cy) / d * push}px` });
      });
    }
    let dead = false, active = false, dirty = true;
    function render() {
      if (dead) return;
      applyMorph();
      euler.set(tilt, 0, theta);
      mol.position.set(0, 0, FIT.z);
      mol.scaleVector.set(s, s, s);
      mol.rotation.copy(euler);
      mol._markDirty();
      scene.render();
      place();
    }
    let prev = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (active && rocking && !held) {
        phase += ROCK.speed * dt;
        theta = base + ROCK.amp * Math.sin(phase);
        dirty = true;
      }
      if (dirty) { dirty = false; render(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    let skip = false;
    const tween = (ms, fn) => (skip ? (fn(1), Promise.resolve()) : new Promise((done) => {
      const t0 = performance.now();
      const go = (now) => {
        if (dead) return done();
        const t = skip ? 1 : Math.min(1, (now - t0) / ms);
        fn(ease(t));
        dirty = true;
        if (t < 1) requestAnimationFrame(go); else done();
      };
      requestAnimationFrame(go);
    }));

    const counts = [`<b>${seg.all_atom}</b> heavy atoms`, `<b>${seg.backbone}</b> heavy atoms (backbone)`];
    function showText(k, animate) {
      frame.classList.toggle('instant', !animate);
      void frame.offsetWidth;
      intro.forEach((el) => el.classList.add('in'));
      captions.forEach((c, j) => c.classList.toggle('in', j === k - 1));
      flatDrawing.classList.toggle('in', k === 1);
      frame.classList.toggle('bb-flatstate', k === 1);
      frame.classList.toggle('bb-units', k >= 4);
      showSide();
    }
    // The side chains are on until step 3 hides them; from step 2 the switch can flip them either way.
    let sideOn = true;
    const toggle = frame.querySelector('.bb-switch');
    function showSide() {
      frame.classList.toggle('bb-hidden', !sideOn);
      count.innerHTML = counts[sideOn ? 0 : 1];
      toggle.setAttribute('aria-pressed', String(sideOn));
    }
    // apply(k) jumps straight to step k.
    function apply(k) {
      fadeMol(k >= 2 ? 1 : 0);
      setSide(sideOn || k === 1 ? 1 : 0);  // after the fade, which resets every part's opacity
      morph = k >= 2 ? 1 : 0;
      rocking = k >= 2;
      if (k === 1) { theta = 0; tilt = 0; base = 0; phase = 0; } else if (step <= 1) tilt = TILT;
    }
    let step = 0;
    async function go(target, animate) {
      const way = animate && !skip && target === step + 1;
      const back = animate === 'back' && !skip && target === step - 1;
      const wasOn = sideOn;
      sideOn = target < 3;
      showText(target, way || (animate && target === 1));
      if (way && target === 2) {
        // the drawing gives way to its atoms, still flat, which then lift into the chain's real shape
        theta = 0; base = 0; phase = 0; rocking = false;
        await tween(500, (t) => fadeMol(t));
        await tween(1900, (t) => { morph = t; tilt = TILT * t; });
        rocking = true;
      } else if (way && target === 3 && wasOn) await tween(800, (t) => setSide(1 - t));
      else if (back && target === 1) {
        // one click back: the chain settles flat onto the drawing again, then gives way to it
        rocking = false;
        const th = theta, ti = tilt;
        await tween(900, (t) => { morph = 1 - t; tilt = ti * (1 - t); theta = th * (1 - t); });
        await tween(300, (t) => fadeMol(1 - t));
        apply(target);
      } else if (back && target === 2 && !wasOn) await tween(450, (t) => setSide(t));
      else apply(target);
      step = target;
      dirty = true;
    }

    toggle.addEventListener('click', async () => {
      toggle.blur();  // keep the arrow keys and space for the deck
      if (step < 2 || busy) return;
      sideOn = !sideOn;
      showSide();
      const on = sideOn;
      busy = true;
      try { await tween(600, (t) => setSide(on ? t : 1 - t)); } finally { busy = false; }
    });

    // Drag to turn the chain; it rocks on by itself 1.5 s after you let go.
    let drag = null;
    host.addEventListener('pointerdown', (e) => {
      if (step < 2) return;
      const box = host.getBoundingClientRect();
      held = true;
      clearTimeout(resume);
      drag = { x: e.clientX, y: e.clientY, k: 0.01 * host.clientWidth / box.width };
      host.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', (e) => {
      if (!drag) return;
      theta += (e.clientX - drag.x) * drag.k;
      tilt = Math.min(1.4, Math.max(-1.4, tilt + (e.clientY - drag.y) * drag.k));
      Object.assign(drag, { x: e.clientX, y: e.clientY });
      dirty = true;
    });
    const release = () => {
      if (!drag) return;
      drag = null;
      resume = setTimeout(() => { held = false; base = theta - ROCK.amp * Math.sin(phase); }, 1500);
    };
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);

    const resize = new ResizeObserver(() => { dirty = true; });
    resize.observe(frame);
    let queue = Promise.resolve(), busy = false, waiting = 0;
    return {
      enter(target, animate) {
        active = true;
        if (busy) skip = true;
        waiting++;
        queue = queue.then(async () => {
          waiting--;
          skip = waiting > 0;
          busy = true;
          try { await go(target, animate); } finally { busy = false; }
        });
        return queue;
      },
      leave() { active = false; },
      freeze() { render(); },
      destroy() {
        dead = true;
        active = false;
        cancelAnimationFrame(raf);
        clearTimeout(resume);
        resize.disconnect();
        scene.dispose();
      },
      get step() { return step; },
    };
  },
});
}
