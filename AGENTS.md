# AGENTS.md — working in this repo

Instructions for coding agents (Claude Code, Codex, and others) and for people. `CLAUDE.md` points here; keep
one copy of the rules, in this file.

## What this is

A template for **live slide decks**: every slide is a small JavaScript module that draws itself in the
browser while you present — HTML and SVG for text and diagrams, [manim-web](https://github.com/maloyan/manim-web)
(a TypeScript port of manim) for anything that animates, and an optional 3D add-on for molecules. Reveal.js
supplies only navigation, click-steps and speaker notes. No build step, no rendered video: edit a file,
refresh the browser. Decks work offline and straight from disk (`file://`).

## Layout

| Path | What it is |
| --- | --- |
| `web/deck.js` | The runtime: slide registry, steps, section footer, themes, laser pointer, click navigation, WebGL budget. Also `Deck.show` and `Deck.points`. |
| `web/deck.css` | **The design language**: type scale, colours, layout grid, footer, step reveals, points column, chart layout. |
| `web/manim.js` | `Deck.manim`: a manim-web scene that plays one step per click. |
| `web/plots.js` | `Deck.groupedBars`: the one bar-chart layout. |
| `web/addons/` | The 3D add-on: `molstar.js` (a Mol*-like look), `cartoon.js` (protein cartoons), `turntable.js` (drag/zoom/rock stage with camera moves), `atoms.js` (ball-and-stick, target cages). Only talks that show molecules load these. |
| `talks/<name>/` | One talk: `index.html` (the slide order), `slides/*.js`, `data/*.js`. `talks/example/` shows every feature. |
| `tools/` | `check_deck.py` (headless check of a deck), `build_site.sh` (the published site), `deploy_pages.sh` (manual upload to Cloudflare Pages), `prep_protein.py` (structure → cartoon data), `prep_amino_acids.py` (the alphabet slides' RDKit drawings and 3D stretch), `vendor_manim_web.sh`. |
| `vendor/` | manim-web, Reveal.js, the Lato font — each with its licence. Never load anything from a CDN. |

## The slide contract

```js
Deck.slide('name', {
  steps: 3,                 // clicks on this slide (default 1); step 1 is what shows on arrival
  notes: 'speaker notes',   // press S
  interactive: true,        // the slide takes drags/wheel (3D); no swipe navigation on touch
  before: 'other-name',     // optional: insert ahead of an already registered slide
  mount(frame, { theme, palette, data, M, css, esc }) {
    // build into `frame` (16:9; 1em = 1/100 of its width)
    return {
      enter(step, animate) {},   // show steps 1..step. animate=false: jump there (arrived from a later slide)
      leave() {},                // optional: off screen, stop loops
      freeze() {},               // optional: redraw canvases now so the deck can picture them
      destroy() {},              // optional: free WebGL/listeners (slides > 2 away are unmounted)
    };                           // enter may return a Promise; the busy dot pulses until it settles
  },
});
```

- `enter` must be **idempotent and jump-safe**: `enter(4, false)` straight after mount must give exactly the
  picture you get by clicking through 1→4. Write state per step, not deltas.
- Wrap a module's constants in `{ ... }` (a block) so names don't collide across files.
- `ctx.css(text)` adds a style once; prefix a slide's classes with a short slide-specific prefix (`fp-`, `ms-`).
- The order of slides is the order of `<script>` tags in the talk's `index.html`. `Deck.section(n)` before a
  group of tags puts those slides in footer section n; `Deck.section(null)` for title/closing slides.
  `Deck.hide('name')` after the tags takes a slide out without deleting it.

## The design language — use it, don't reinvent it

Everything is sized in `--u` (1/100 of the frame width), so slides scale to any screen. **Never use px or ad
hoc font sizes for slide text**; use the tokens:

| Token | Use |
| --- | --- |
| `--t-display` | title slide's title (`.deck-title`) |
| `--t-heading` | slide heading (`<h2 class="deck-heading">`, accent colour, top left) |
| `--t-lead` | list items, key statements, outline rows |
| `--t-body` | running text, point titles |
| `--t-small` | secondary text, point sub-lines |
| `--t-caption` | legends, labels, captions |
| `--t-micro` | hints |

Layout grid: margins 4.2% left/right; heading at the top; content between ~15% and ~85% of the height;
one caption line at 87% (`.deck-caption`); the section footer below. Components:

- **Figure + points**: `.deck-figure` (left ~52%) plus `Deck.points([{title, sub, from}], {className})`
  (`.deck-col`). Move the column only through `--col-left`, `--col-top`, `--col-title`, `--col-gap`.
- **Lead line** under the heading: `.deck-lead`. **Code**: `<code class="deck-code">`. **Keys**: `<kbd>F</kbd>`.
- **Emphasis**: `.deck-accent` (accent colour), `<mark class="deck-mark">` (highlighter), `.deck-muted`,
  `.deck-detail` (credits, data sources — quieter than muted).
- **Charts**: `Deck.groupedBars` only (`web/plots.js`); one series is a plain bar chart. Don't hand-build charts.
- **Step reveals**: give elements `class="reveal-in" data-from="k"` (or `data-show="1 3"`) and call
  `Deck.show(frame, step, animate)` from `enter`. `--i` on siblings staggers them.
- **Title / closing**: `.deck-title`, `.deck-subtitle`, `.deck-byline`.

**Colours**: CSS uses `var(--fg)`, `var(--muted)`, `var(--accent)`, `var(--detail)`, `var(--plot-1..5)`.
Canvas, SVG and manim-web code uses `palette` (`P.fg`, `P.muted`, `P.accent`, `P.series[i]`, `P.ss`, `P.cpk`),
which mirrors the CSS. **Never hard-code white/black or a hex colour in a slide** — both themes must work:
light is the default, dark is `T` or `?theme=dark`. If you change a theme colour, change it in both `deck.css` and `PALETTES` in
`deck.js`.

## manim-web animation (the click-step centrepiece)

```js
const stage = Deck.manim(frame.querySelector('.deck-stage'), {
  build: ({ M, P }) => ({ circle: new M.Circle({ color: P.accent }), square: new M.Square({ color: P.fg }) }),
  steps: [
    ({ circle }, { M }) => [new M.Create(circle)],                          // step 1, plays on arrival
    async ({ circle, square }, { M, play, wait }) => {                      // step 2: several plays in sequence
      await play(new M.Transform(circle, square)); await wait(0.3); await play(new M.Indicate(circle));
    },
  ],
});
return { enter(step, animate) { Deck.show(frame, step, animate); return stage.go(step, animate); },
         freeze: stage.freeze, destroy: stage.dispose };
```

- `build` must create **fresh objects** every call: going back a step rebuilds the scene and replays steps
  instantly. Never keep mobjects in module-level variables.
- A step returns animations to play together, or calls `play()`/`wait()`/`add()` itself. In the instant
  path `play` applies animations at their end state and `wait` is a no-op, so the same code serves both.
- The scene is transparent and spans the frame: 16 × 9 world units, origin at the centre, y up. Keep shapes
  clear of the heading (y > ~3.3) and of any HTML column on the right.
- `Transform` morphs point to point; between unlike shapes (rectangles → area, shape → text) fade one out
  and the other in, or manim-web throws "mismatched point counts".
- Text: `M.Text({ fontFamily: 'Lato', ... })` for words, `M.MathTex({ latex })` for maths (KaTeX is bundled
  and works offline). Prefer HTML for long text; keep manim text for things that move.
- The manim-web API mirrors Python manim (camelCase: `getRiemannRectangles`, `moveTo`, `nextTo`). Its type
  declarations are in the npm package (`npm pack manim-web@0.39.4`) when you need an exact signature.

## The 3D add-on

Load `web/addons/{molstar,cartoon,turntable,atoms}.js` in the talk's `index.html`. Pattern (see
`talks/example/slides/molecule.js`, `protein.js`, `design_check.js`):

- `const view = Deck.turntable(host, { radius, scale })` — `radius` in scene units (the model's half-size),
  `scale` = scene units per Å. Drag turns, wheel zooms, idle rock; a plain click still steps the deck.
- Add `M.Molecule3D` (positions **and radii** scaled by `scale`) or three.js meshes with `view.add`.
- `Deck.cartoon(data, { color } | { ss: P.ss })` builds in **Å**; scale its mesh (`mesh.scale.setScalar(scale)`),
  never the Cα coordinates (ribbon widths are Å, so scaling coordinates makes fat ribbons).
- `view.model` is a group in Å (scaled by `scale`): put three.js content there. `await view.focus(pointÅ, zoom, ms)`
  moves the camera's turning point and zoom (the close-up / pan / zoom-out transitions); `view.project(pointÅ)`
  gives screen pixels for HTML labels, placed in `view.onRender`. Fade the context (cartoon) in close-ups, or it
  fills the view.
- `Deck.ballStick(points, colours, bonds)` and `Deck.cages(points)` (`atoms.js`): instanced, fade as one. Cages
  mark where atoms were asked to be.
- Protein data: `python tools/prep_protein.py my.cif talks/<talk>/data/my_protein.json [--atoms]` → load
  `data/my_protein.js`, read `data.my_protein`.
- On/off over a figure: `<button class="deck-switch" aria-pressed="true"><i></i>label</button>` (deck.css).
- Mark 3D slides `interactive: true`; wire `leave: view.stop`, `freeze: view.render`, `destroy: view.dispose`.
- Browsers keep ~16 WebGL contexts; the deck keeps only slides within 2 of the current one alive and
  pictures the rest. Always implement `destroy`.

## Data

Slides read `ctx.data.<name>` from `window.DATA`, filled by `talks/<talk>/data/<name>.js` files loaded with
`<script>` tags (browsers won't `fetch` JSON from `file://`). Generate these with a script in `tools/` that
writes both `.json` and `.js`; don't hand-type large data into slides. Record where data came from in the
prep script's docstring and in the slide's notes or a `.deck-detail` credit.

## Checking your work

```bash
pip install playwright && playwright install chromium     # once
python tools/check_deck.py talks/example                  # every slide and step, dark and light
python tools/check_deck.py talks/example --slide manim-graph --back   # one slide, also stepping backwards
```

It fails on any console error or warning and writes a picture per slide (at its last step) to
`talks/<talk>/check/` (git-ignored). **Look at the pictures** in both themes — text overlapping a figure,
something under the heading, or a colour invisible in one theme are the usual faults and are not
console errors. For live work: `python -m http.server 8000` in the repo root, then open
`http://localhost:8000/talks/<talk>/index.html` (add `?theme=dark`, `#/5` for slide 5).

## Publishing

The Cloudflare Pages project is connected to the GitHub repo: **every push to `main` publishes the site**
(`tools/build_site.sh`: front page, `talks/`, `web/`, `vendor/` only). So pushing is publishing: push only when the
person asks, and run `check_deck.py` first. `tools/deploy_pages.sh` uploads by hand (e.g. uncommitted work). A new talk
appears at `/talks/<name>/`; link it from the root `index.html` if it should be findable.

## Conventions

- Keep the template generic: talk-specific content lives under `talks/<name>/`, never in `web/`.
- A new reusable component goes in `web/` with a usage comment at the top of the file (like `plots.js`),
  styles in `deck.css`, and a demo in `talks/example/`. Update this file's tables.
- Comments explain *why* and what a step shows; every slide file starts with a short comment listing its steps.
- Upgrading manim-web: `tools/vendor_manim_web.sh <version>`, then run `check_deck.py` on every talk.
- Don't add CDN links, npm builds or frameworks; the deck must open offline from disk.

## Keys while presenting

→/← or left/right click: step · S: speaker notes · O: overview · F: fullscreen · T: dark/light · L: laser
pointer · Esc: leave overview. URL `#/n` jumps to slide n.
