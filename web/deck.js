// Runtime for live decks: every slide is a module that draws into its own 16:9 frame (HTML, SVG, and
// manim-web scenes via window.ManimWeb), and Reveal.js only supplies navigation, steps and speaker notes.
//
// A slide module registers itself:
//
//   Deck.slide('outline', {
//     steps: 2,                        // click-steps on the slide (default 1)
//     notes: 'speaker notes',
//     interactive: true,               // the slide takes drags/scrolls (no swipe-to-navigate on touch)
//     mount(frame, ctx) {              // build into `frame`; ctx = {theme, palette, data, M, css, esc}
//       return {
//         enter(step, animate) {},     // show steps 1..step; animate unless jumping back from later on
//         leave() {},                  // off screen: stop anything running
//         freeze() {},                 // optional: redraw canvases now, so the deck can picture them
//         destroy() {},                // unmounted to stay under the browser's WebGL context limit
//       };                             // (enter may return a Promise that settles when the step is shown)
//     },
//   });
//
// and the deck page lists the modules in order, then calls Deck.start({title}). Press T to switch theme,
// L for a laser pointer; left click steps forward, right click back.
//
// Helpers for slides: Deck.show(frame, step, animate) reveals the elements marked data-from="k" (shown from
// step k on) or data-show="1 3" (shown on exactly those steps); Deck.points([...]) writes a numbered column
// (.deck-col in deck.css); Deck.manim (web/manim.js) runs a manim-web scene a click at a time.
//
// The section footer: Deck.sections([[num, name], ...]) names the talk's sections (outline.js does), and a
// Deck.section(num) between the page's script tags puts the slides listed after it in that section. Every
// slide in a section shows the numbered sections along the bottom, its own lit; click one to go there.
// Deck.topics({num: [[title, [slide names], blurb], ...]}) splits a section into topics: the current
// section then shows a dot per topic (solid when done, accent for the one you are in, hollow ahead), and
// Deck.topicsOf(num) gives them to a checklist slide. Deck.expand(num) gives a dense section the whole
// footer while you are in it: the sections before it shrink to their numbers, and its topics spread along
// the bar as numbered segments (num.1, num.2, ... in topic order) that fill like a progress bar.
(function () {
  'use strict';

  // Mol*'s element colours (Jmol's CPK set), for atoms drawn with Deck.molstar (web/addons/molstar.js).
  const CPK = { C: '#909090', N: '#3050f8', O: '#ff0d0d', S: '#ffff30', P: '#ff8000', other: '#ff1493' };
  // The drawing palettes: the same colours as the CSS variables in web/deck.css, for canvases and SVG that
  // cannot read CSS. Keep the two in step. `series` matches --plot-1.. (charts and manim-web figures alike);
  // `neutral` is the grey for whatever is context rather than the point; `ligand` and `metal` colour small
  // molecules' carbons and metal ions in 3D; `ss` and `el` are for the 3D add-ons
  // (helix / strand / coil, and element colours for flat drawings). Lit 3D surfaces read darker than flat 2D
  // strokes, so the light theme's 3D greys are lifted.
  const PALETTES = {
    dark: {
      bg: '#0f1218', fg: '#e8eaed', muted: '#9aa0a6', detail: '#6e747c', accent: '#7aa2f7', done: '#5cc98a',
      series: ['#7d8aa0', '#d9a93f', '#7aa2f7', '#5cc98a', '#ef6b6b'],
      rainbow: ['#3b5bdb', '#15aabf', '#40c057', '#fab005', '#fd7e14', '#e03131'],
      neutral: '#9aa0a6', ligand: '#6fdc8c', metal: '#c79bf2', ss: { H: '#e8575c', E: '#f2c14e', C: '#8a9099' },
      el: { C: '#b8bec7', N: '#6c8cff', O: '#ef6b6b', S: '#f2c14e', P: '#ff9f43', other: '#c79bf2' },
      ambient: 0.35, cpk: CPK,
    },
    light: {
      bg: '#fbfaf8', fg: '#1d2129', muted: '#5c6370', detail: '#9ba1aa', accent: '#2f55d4', done: '#1f9d55',
      series: ['#98a6bc', '#dfaa3e', '#2f55d4', '#1f9d55', '#cf3434'],
      rainbow: ['#2f4ac0', '#0b8ea6', '#2b9a46', '#d39200', '#e8590c', '#c92a2a'],
      neutral: '#b4bac3', ligand: '#1f8a3c', metal: '#8a4fd0', ss: { H: '#d6334a', E: '#c98a00', C: '#8b919b' },
      el: { C: '#7d848f', N: '#3a5bd9', O: '#cf3434', S: '#c98a00', P: '#e67700', other: '#8a4fd0' },
      ambient: 1.1, cpk: CPK,
    },
  };
  // Most browsers keep about 16 WebGL contexts and silently drop the oldest beyond that; each manim-web
  // scene holds one. Slides further than this from the current one are unmounted, and rebuilt on return.
  // 3 keeps at most 7 slides live, well under the limit, so stepping back rarely meets a rebuilt slide.
  const KEEP = 3;

  // light by default; ?theme=dark (or T while presenting) for the dark theme
  const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  const slides = [];
  const styled = new Set();
  let sections = [], part = null;  // the footer's sections, and the one slides are being added to
  let topics = {};                 // section number -> [[title, [slide names], blurb], ...]
  const expanded = new Set();      // sections whose topics spread along the footer (Deck.expand)

  function css(text) {
    if (styled.has(text)) return;
    styled.add(text);
    const el = document.createElement('style');
    el.textContent = text;
    document.head.append(el);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function start({ title }) {
    document.title = title;
    const container = document.querySelector('.reveal .slides');
    for (const s of slides) {
      // The frame lives inside Reveal's section, so Reveal places, fades and thumbnails it (overview).
      const section = document.createElement('section');
      section.dataset.slide = s.name;
      if (s.def.interactive) section.dataset.preventSwipe = '';
      s.frame = Object.assign(document.createElement('div'), { className: 'deck-frame' });
      section.append(s.frame);
      for (let i = 1; i < (s.def.steps || 1); i++) {
        section.append(Object.assign(document.createElement('span'), { className: 'fragment deck-step' }));
      }
      if (s.def.notes) {
        section.append(Object.assign(document.createElement('aside'), { className: 'notes', textContent: s.def.notes }));
      }
      container.append(section);
      Object.assign(s, { section, state: 'empty', ctrl: null, shots: null });
    }

    Reveal.initialize({
      width: '100%', height: '100%', margin: 0, center: false,
      // no arrows, except on touch screens: there the 3D slides take swipes to turn what they show
      controls: matchMedia('(pointer: coarse)').matches, progress: true, slideNumber: 'c', hash: true,
      transition: 'fade', transitionSpeed: 'fast', backgroundTransition: 'none',
      plugins: window.RevealNotes ? [window.RevealNotes] : [],
    });
    Reveal.addKeyBinding({ keyCode: 84, key: 'T', description: 'Switch dark / light theme' }, () => {
      const q = new URLSearchParams(location.search);
      q.set('theme', theme === 'light' ? 'dark' : 'light');
      location.href = `${location.pathname}?${q}${location.hash}`;
    });
    // A laser pointer for the talk: L toggles a dot that follows the mouse. The dot is pointer-events: none,
    // so the draggable 3D slides still take their drags, and it only appears once the mouse has moved. This
    // takes L over from Reveal, which binds it to navigate-right alongside the right arrow; the arrow stays.
    const laser = Object.assign(document.createElement('div'), { className: 'deck-laser' });
    document.body.append(laser);
    const trackLaser = (e) => {
      laser.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      laser.classList.add('on');
    };
    const dropLaser = (e) => { if (!e.relatedTarget) laser.classList.remove('on'); };
    Reveal.addKeyBinding({ keyCode: 76, key: 'L', description: 'Laser pointer on / off' }, () => {
      const on = !document.documentElement.classList.contains('deck-lasing');
      document.documentElement.classList.toggle('deck-lasing', on);
      laser.classList.remove('on');  // wait for the first move, so it never flashes in the corner
      const bind = on ? addEventListener : removeEventListener;
      bind('pointermove', trackLaser);
      bind('pointerout', dropLaser);
    });
    // Click to turn the page, like a clicker: left forward, right back. Three things are not that click: a
    // press that moved is a drag on one of the 3D slides, a press on a control belongs to that control, and
    // in the overview a click picks a slide, which Reveal does itself. The 3D hosts capture the pointer, so
    // their pointerup still arrives here and the distance test is what keeps a turned model on its slide.
    // The context menu is suppressed over the deck, or the right click would open it instead of going back.
    const CONTROLS = 'button, a, input, select, textarea, label, [role="button"]';
    const stage = document.querySelector('.reveal');
    let press = null;
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    stage.addEventListener('pointerdown', (e) => {
      press = e.button === 0 || e.button === 2 ? { x: e.clientX, y: e.clientY, button: e.button } : null;
    });
    stage.addEventListener('pointerup', (e) => {
      const from = press;
      press = null;
      if (!from || e.button !== from.button || Reveal.isOverview()) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 6) return;
      if (e.target.closest && e.target.closest(CONTROLS)) return;
      if (e.button === 0) Reveal.next(); else Reveal.prev();
    });
    ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden', 'overviewhidden'].forEach((e) => Reveal.on(e, sync));
    if (sections.length) {
      const light = footer();
      ['ready', 'slidechanged'].forEach((e) => Reveal.on(e, light));
      if (Reveal.isReady()) light();
    }
    Reveal.on('overviewshown', (e) => {
      sync(e);
      // The overview shows slides complete (Reveal's convention): jump live ones to their last step.
      for (const s of slides) {
        if (s.state === 'live') Promise.resolve(s.ctrl.enter(s.def.steps || 1, false)).then(() => s.ctrl && s.ctrl.leave && s.ctrl.leave());
      }
      fillOverview();
    });
    if (Reveal.isReady()) sync();
  }

  // The footer lives outside the slides, so it stays put while they fade; it returns the function that lights
  // the current slide's section (and hides the footer on slides in none, like the title).
  function footer() {
    const nav = Object.assign(document.createElement('nav'), { className: 'deck-footer' });
    nav.innerHTML = sections.map(([num, name]) => {
      const list = topics[num] || [];
      // an expanded section also carries a segment per topic, shown in place of its name and dots
      const subs = expanded.has(num) && list.length ? `<span class="deck-subs">${list.map(([title], i) =>
        `<span class="deck-sub" data-i="${i}"><b>${esc(num)}.${i + 1}</b>${esc(title)}</span>`).join('')}</span>` : '';
      return `<a data-num="${esc(num)}"><b>${esc(num)}</b><span class="deck-name">${esc(name)}</span>${
        list.length ? `<span class="deck-dots">${list.map(() => '<i></i>').join('')}</span>` : ''}${subs}</a>`;
    }).join('');
    document.querySelector('.reveal').append(nav);
    const items = [...nav.children];
    const firstOf = (names) => slides.findIndex((s) => names.includes(s.name));
    for (const a of items) {
      const first = slides.findIndex((s) => s.part === a.dataset.num);
      if (first < 0) a.classList.add('empty'); else a.addEventListener('click', () => Reveal.slide(first));
      // each segment is its own link, to its topic's first slide rather than the section's
      a.querySelectorAll('.deck-sub').forEach((el) => {
        const to = firstOf(topics[a.dataset.num][+el.dataset.i][1]);
        if (to >= 0) el.addEventListener('click', (e) => { e.stopPropagation(); Reveal.slide(to); });
      });
    }
    const indexOf = (name) => slides.findIndex((x) => x.name === name);
    return () => {
      const h = Reveal.getIndices().h, s = slides[h];
      const here = s ? s.part : null;
      nav.classList.toggle('on', here !== null);
      for (const a of items) a.classList.toggle('current', a.dataset.num === here);
      // the topic this slide belongs to: those before it are done. A slide named in no topic belongs to the
      // last topic that has begun by now, so one slipped in mid-topic does not blank the bar; a slide before
      // any topic begins, like a checklist that opens the section, has done none.
      const list = topics[here] || [];
      let at = s ? list.findIndex(([, names]) => names.includes(s.name)) : -1;
      if (s && at < 0) list.forEach(([, names], i) => { if (Math.min(...names.map(indexOf).filter((p) => p >= 0)) <= h) at = i; });
      // how far through a topic this slide is: its slides shown so far, counting by position, out of those
      // actually in the deck (a topic may name a slide that is switched off, which must not stop it filling)
      const through = (names) => {
        const at = names.map(indexOf).filter((p) => p >= 0);
        return at.length ? at.filter((p) => p <= h).length / at.length : 0;
      };
      nav.classList.toggle('wide', expanded.has(here) && list.length > 0);
      const dots = here === null ? [] : nav.querySelectorAll(`a[data-num="${here}"] .deck-dots i`);
      dots.forEach((d, i) => { d.className = i < at ? 'done' : i === at ? 'now' : ''; });
      // the segments fill like a progress bar: done ones whole, the current one as far as this slide
      // within its topic, the rest empty
      const segs = here === null ? [] : nav.querySelectorAll(`a[data-num="${here}"] .deck-sub`);
      segs.forEach((el, i) => {
        const names = list[i][1];
        el.className = `deck-sub${i < at ? ' done' : i === at ? ' now' : ''}`;
        el.style.setProperty('--fill', i < at ? 1 : i === at ? through(names) : 0);
      });
    };
  }

  // A slide is 'empty' (never built), 'live' (its module is running) or 'still' (its WebGL freed and its
  // canvases replaced by pictures of their last frame, so the overview still has a thumbnail).
  function mount(s) {
    s.frame.replaceChildren();
    s.ctrl = s.def.mount(s.frame, { theme, palette: PALETTES[theme], data: window.DATA || {}, M: window.ManimWeb, css, esc });
    s.state = 'live';
  }

  // Picture every canvas while the slide is laid out. A WebGL canvas can only be read in the task that
  // drew it, so the module's freeze() redraws first. Taken after each step, because by the time a slide
  // is unmounted Reveal may already have hidden it (display: none leaves nothing to read).
  function capture(s) {
    if (s.state !== 'live' || !s.frame.getClientRects().length) return;
    if (s.ctrl.freeze) s.ctrl.freeze();
    const box = s.frame.getBoundingClientRect();
    s.shots = [...s.frame.querySelectorAll('canvas')].map((c) => {
      let src = null;
      try { src = c.toDataURL('image/webp', 0.9); } catch (err) { /* lost context */ }
      const r = c.getBoundingClientRect();
      return { src, left: (r.left - box.left) / box.width, top: (r.top - box.top) / box.height,
               width: r.width / box.width, height: r.height / box.height };
    }).filter((shot) => shot.src && shot.width > 0);
  }

  function freeze(s) {
    if (s.state !== 'live') return;
    if (s.ctrl.leave) s.ctrl.leave();
    if (s.ctrl.destroy) s.ctrl.destroy();
    s.ctrl = null;
    s.frame.querySelectorAll('canvas').forEach((c) => c.remove());
    for (const shot of s.shots || []) {
      const img = Object.assign(new Image(), { src: shot.src, className: 'deck-still' });
      Object.assign(img.style, { left: `${shot.left * 100}%`, top: `${shot.top * 100}%`,
                                 width: `${shot.width * 100}%`, height: `${shot.height * 100}%` });
      s.frame.append(img);
    }
    s.state = 'still';
  }

  // While a slide is still animating (its enter() returned a promise not yet settled), a dot pulses by the slide
  // number, so you can tell a step that is still running from one that is waiting for your click. Shown only
  // after 150 ms, so steps that settle at once don't flash it.
  let busyRun = 0, busyTimer = 0;
  function busy(result) {
    if (!result || typeof result.then !== 'function') return result;
    const run = ++busyRun, root = document.documentElement;
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => { if (run === busyRun) root.classList.add('deck-busy'); }, 150);
    const done = () => { if (run === busyRun) { clearTimeout(busyTimer); root.classList.remove('deck-busy'); } };
    result.then(done, done);
    return result;
  }

  function sync(event) {
    const current = Reveal.getIndices().h;
    const overview = Reveal.isOverview();
    slides.forEach((s, i) => {
      if (Math.abs(i - current) > KEEP) { freeze(s); return; }
      if (i !== current || overview) {
        if (s.ctrl && s.ctrl.leave) s.ctrl.leave();
        return;
      }
      // Built on arrival, when the frame has a size, so nothing runs until it is needed.
      if (s.state !== 'live') mount(s);
      const step = 1 + s.section.querySelectorAll('.deck-step.visible').length;
      // Animate going forward; jump straight to the step when arriving from a later slide.
      const forward = !event || event.type === 'ready' || event.type === 'fragmentshown'
        || (event.type === 'slidechanged' && step === 1);
      Promise.resolve(busy(s.ctrl.enter(step, forward))).then(() => {
        if (Reveal.getIndices().h === i && !Reveal.isOverview()) capture(s);
      });
    });
    // The next slide is built ahead, so it has drawn its opening frame before you arrive: crossfading into a
    // frame that is still building reads as a cut, and breaks hand-offs that continue one picture onto the next.
    const ahead = (s) => {
      if (!s || Reveal.isOverview() || s.state === 'live' || !s.section.getClientRects().length) return;
      mount(s);
      if (s.ctrl.leave) s.ctrl.leave();
    };
    if (!overview) ahead(slides[current + 1]);
    // The previous slide is built too, so stepping back lands on a slide that is ready rather than one that
    // builds (3D setup takes a moment) as you arrive. It waits a little, so its setup does not hold up the
    // step you are watching, and only if you are still on this slide.
    clearTimeout(behindTimer);
    if (!overview) behindTimer = setTimeout(() => { if (Reveal.getIndices().h === current) ahead(slides[current - 1]); }, 400);
  }
  let behindTimer = 0;

  // The overview shows every slide's frame; build the ones never visited, one at a time and at their last
  // step, then freeze them, so thumbnails exist without holding a WebGL context per slide.
  let filling = false;
  async function fillOverview() {
    if (filling) return;
    filling = true;
    const current = Reveal.getIndices().h;
    for (const [i, s] of slides.entries()) {
      if (!Reveal.isOverview()) break;
      if (s.state !== 'empty' || !s.section.getClientRects().length) continue;
      mount(s);
      await s.ctrl.enter(s.def.steps || 1, false);
      capture(s);
      if (Math.abs(i - current) > KEEP) freeze(s); else s.ctrl.leave && s.ctrl.leave();
      await new Promise(requestAnimationFrame);
    }
    filling = false;
  }

  // Step reveals, the deck's usual way of building a slide up a click at a time: an element with
  // data-from="k" is shown from step k on, one with data-show="1 3" on exactly those steps. Showing is adding
  // the class `in`; .reveal-in (deck.css) fades and slides in on it, and a slide may style `.in` its own way.
  // animate=false (arriving from a later slide) skips the transitions.
  function show(frame, step, animate = true) {
    frame.classList.toggle('instant', !animate);
    void frame.offsetWidth;  // flush styles, so a fresh mount fades in from the hidden state
    for (const el of frame.querySelectorAll('[data-from], [data-show]')) {
      const on = el.dataset.show ? el.dataset.show.split(/\s+/).map(Number).includes(step)
        : step >= Number(el.dataset.from);
      el.classList.toggle('in', on);
    }
  }

  // A numbered column of points (.deck-col in deck.css), each revealed on its own step:
  //   Deck.points([{ title: 'Idea', sub: 'the line under it', from: 2 }, ...], { className: 'my-col' })
  // Titles and subs are text (escaped); pass `html: true` on a point to use markup instead.
  function points(list, { className = '' } = {}) {
    const text = (p, s) => (p.html ? s : esc(s));
    return `<div class="deck-col ${className}">${list.map((p, i) => `
      <div class="deck-point reveal-in" data-from="${p.from || i + 1}">
        <div class="deck-point-t"><span>${p.num || i + 1}</span>${text(p, p.title)}</div>
        ${p.sub ? `<div class="deck-point-s">${text(p, p.sub)}</div>` : ''}
      </div>`).join('')}</div>`;
  }

  window.Deck = {
    theme, palette: PALETTES[theme], PALETTES, esc, css, start, show, points,
    // def.before: put this slide just ahead of an already registered one (its section is still the one current
    // here), for a slide whose neighbours live in another module
    slide(name, def) {
      const at = def.before ? slides.findIndex((s) => s.name === def.before) : -1;
      if (def.before && at < 0) console.warn(`Deck.slide('${name}'): no slide '${def.before}' to go before`);
      slides.splice(at < 0 ? slides.length : at, 0, { name, def, part });
    },
    sections(list) { sections = list.map(([num, name]) => [String(num), name]); },
    section(num) { part = num === null ? null : String(num); },
    topics(map) { topics = Object.fromEntries(Object.entries(map).map(([k, v]) => [String(k), v])); },
    expand(...nums) { nums.forEach((n) => expanded.add(String(n))); },
    // Take slides out of the talk without touching their code: call it after their files load and before
    // Deck.start. Un-hiding is deleting the call. A topic may still name a hidden slide; the footer skips it.
    hide(...names) {
      for (const name of names) {
        const at = slides.findIndex((s) => s.name === name);
        if (at < 0) console.warn(`Deck.hide('${name}'): no such slide`);
        else slides.splice(at, 1);
      }
    },
    topicsOf(num) { return topics[String(num)] || []; },
    // The running controller of a slide (null unless it is live): handy for tests and the console.
    controller(name) { const s = slides.find((x) => x.name === name); return s ? s.ctrl : null; },
  };
})();
