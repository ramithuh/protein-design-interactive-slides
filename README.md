# Live slides template

Slide decks drawn live in the browser: HTML for text, [manim-web](https://github.com/maloyan/manim-web)
for manim-style animations that play **one step per click**, and an optional 3D add-on that draws molecules
and protein cartoons the way Mol* does. No build step and no rendered video — edit a slide, refresh. Decks
work offline, straight from disk, in a light theme (the default) and a dark one.

![The example talk: manim-web steps, a chart, figure + points, a molecule and a protein](talks/example/preview.png)

## Try it

Open `talks/example/index.html` in Chrome or Firefox (or run `python -m http.server 8000` here and browse to
`http://localhost:8000/talks/example/`). Click or press → to step; ← or right click goes back.

| Key | |
| --- | --- |
| → ← / left, right click | next / previous step |
| S | speaker view (notes, timer, next slide) |
| O | overview |
| F | fullscreen |
| T | dark / light theme (or `?theme=dark`) |
| L | laser pointer |

## Make your own talk

```bash
cp -r talks/example talks/my_talk
# edit talks/my_talk/index.html (slide order, sections) and talks/my_talk/slides/*.js
python tools/check_deck.py talks/my_talk      # every slide and step, both themes; pictures in talks/my_talk/check/
```

A slide is one module:

```js
Deck.slide('hello', {
  steps: 2,
  notes: 'what to say',
  mount(frame, { palette: P, M }) {
    frame.innerHTML = `<h2 class="deck-heading reveal-in in">Hello</h2><div class="deck-stage"></div>`;
    const stage = Deck.manim(frame.querySelector('.deck-stage'), {
      build: () => ({ c: new M.Circle({ color: P.accent }), s: new M.Square({ color: P.fg }) }),
      steps: [({ c }) => [new M.Create(c)], ({ c, s }) => [new M.Transform(c, s)]],
    });
    return { enter: stage.go, freeze: stage.freeze, destroy: stage.dispose };
  },
});
```

[AGENTS.md](AGENTS.md) has the full conventions — the slide contract, the design language (type scale, layout
grid, colours, components), the manim-web stage, the 3D add-on, data files and checking. Point your coding
agent at it.

## Publish

The decks are a static site, so any static host works. For Cloudflare Pages (with `wrangler login` done once):

```bash
tools/deploy_pages.sh [project]     # default project: interactive-slides
```

It publishes `index.html` (the front page, which opens the example talk), `talks/`, `web/` and `vendor/`, and
nothing else from the repo. A custom domain is added once in the Pages project, plus a CNAME to
`<project>.pages.dev` in DNS.

## What's in the box

- `web/deck.js`, `web/deck.css` — runtime and design language: 16:9 frames that scale to any screen, a
  type scale, a section footer with per-topic progress, step reveals, a numbered points column, captions,
  light/dark themes, a laser pointer, and a WebGL budget so many 3D slides don't exhaust the browser.
- `web/manim.js` — `Deck.manim`: write what each click plays; going back rebuilds the scene at that step.
- `web/plots.js` — `Deck.groupedBars`: bar charts that grow a group or a series per click.
- `web/addons/` — `Deck.turntable` (drag/zoom 3D stage, with eased camera moves for close-ups and pans),
  `Deck.molstar` (outlines, ambient occlusion and lighting tuned against Mol*), `Deck.cartoon` (protein
  cartoons built like Mol*'s), `Deck.ballStick` and `Deck.cages` (atoms, and wireframe cages for targets).
- `talks/example/slides/design_check.js` — two slides checking a generated enzyme design against its request:
  target cages, a switch, zooms into the requested residues and out again, then into a clash elsewhere.
- `talks/example/slides/alphabet.js` — the 20 amino acids, flown out of a grid and joined into a chain
  (HTML, SVG and CSS transitions alone), then the chain lifted off the page into its real 3D shape and
  stripped to its backbone (the 3D add-on).
- `tools/prep_protein.py` — any PDB/mmCIF chain → cartoon data. `tools/prep_amino_acids.py` — the alphabet's
  drawings and the 3D stretch (needs RDKit). `tools/check_deck.py` — headless check.

## Requirements

A recent Chrome, Edge or Firefox. Python only for the tools: `pip install playwright gemmi numpy` (and
`playwright install chromium`); `mdtraj` optionally, for DSSP on structures without helix/sheet records.

## Credits

Bundled in `vendor/`, each with its licence: [manim-web](https://github.com/maloyan/manim-web) 0.39.4 (MIT),
[Reveal.js](https://revealjs.com) 6.0.1 (MIT), [Lato](https://www.latofonts.com) (SIL OFL). Example data:
ubiquitin, PDB [1UBQ](https://www.rcsb.org/structure/1UBQ); caffeine, an RDKit conformer.
