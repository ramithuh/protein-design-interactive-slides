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

The decks are a static site, so any static host works. This repo is connected to Cloudflare Pages: every push
to `main` rebuilds and publishes it. To do the same for your own copy, create a Pages project from your GitHub
repo with

| Setting | Value |
| --- | --- |
| Build command | `bash tools/build_site.sh` |
| Build output directory | `site` |

`tools/build_site.sh` assembles `index.html` (the front page, which opens the example talk), `talks/`, `web/`
and `vendor/`, and nothing else from the repo. To upload by hand instead (uncommitted work, or a project not
connected to Git), with `wrangler login` done once: `tools/deploy_pages.sh <project>`.

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

## How proteins are drawn

No protein-viewer library runs in the browser. The 3D slides use three.js, which comes bundled inside
manim-web (`M.THREE`), and code in `web/addons/` written for this repo:

| Piece | What it is |
| --- | --- |
| `cartoon.js` | Protein cartoons (helices, strands with arrows, loops), reimplementing Mol*'s cartoon: the same spline, ribbon facing and sizes. Not Mol* itself. |
| `molstar.js` | A render pass for the Mol* look: outlines, ambient occlusion, matte lighting, depth fog, tuned side by side against Mol*. |
| `atoms.js` | Instanced ball-and-stick and wireframe cages (for requested positions). |
| manim-web `Molecule3D` | Ball-and-stick for small molecules (the caffeine and peptide slides). |

The data those slides read is prepared once, in Python, by the scripts in `tools/`:

| Package | Used for |
| --- | --- |
| [gemmi](https://gemmi.readthedocs.io) | reading PDB/mmCIF: residues, atoms, helix and sheet records |
| numpy | geometry: centring, principal axes, the ribbons' frames |
| [mdtraj](https://www.mdtraj.org) (optional) | secondary structure (DSSP) for files without helix/sheet records, e.g. generated designs |
| [RDKit](https://www.rdkit.org) | the amino-acid drawings and small-molecule conformers |

## Requirements

A recent Chrome, Edge or Firefox. Python only for the tools: `pip install playwright gemmi numpy rdkit` (and
`playwright install chromium`); `mdtraj` optionally, for DSSP on structures without helix/sheet records.

## Credits

**Bundled** in `vendor/`, each with its licence: [manim-web](https://github.com/maloyan/manim-web) 0.39.4 by
Narek Maloyan (MIT), which also brings [three.js](https://threejs.org) (MIT); [Reveal.js](https://revealjs.com)
6.0.1 (MIT); the [Lato](https://www.latofonts.com) font (SIL OFL).

**Proteins and molecules.** The cartoons and the 3D look (`web/addons/cartoon.js`, `molstar.js`) reimplement
the approach of [Mol*](https://molstar.org) (MIT), tuned side by side against it; no Mol* code is bundled. Element
colours are Jmol's. If you use these slides in published work, cite the tools they stand on:

- Mol*: D. Sehnal et al., *Mol\* Viewer: modern web app for 3D visualization and analysis of large biomolecular
  structures*, Nucleic Acids Res. 49, W431–W437 (2021). [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314)
- gemmi: M. Wojdyr, *GEMMI: A library for structural biology*, J. Open Source Softw. 7, 4200 (2022).
  [doi:10.21105/joss.04200](https://doi.org/10.21105/joss.04200)
- MDTraj: R. T. McGibbon et al., *MDTraj: a modern open library for the analysis of molecular dynamics
  trajectories*, Biophys. J. 109, 1528–1532 (2015). [doi:10.1016/j.bpj.2015.08.015](https://doi.org/10.1016/j.bpj.2015.08.015);
  its secondary structure is DSSP: W. Kabsch and C. Sander, Biopolymers 22, 2577–2637 (1983).
  [doi:10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)
- RDKit: open-source cheminformatics, [rdkit.org](https://www.rdkit.org)
- NumPy: C. R. Harris et al., *Array programming with NumPy*, Nature 585, 357–362 (2020).
  [doi:10.1038/s41586-020-2649-2](https://doi.org/10.1038/s41586-020-2649-2)

**Structures**, from the [Protein Data Bank](https://www.rcsb.org) (H. M. Berman et al., Nucleic Acids Res. 28,
235–242 (2000), [doi:10.1093/nar/28.1.235](https://doi.org/10.1093/nar/28.1.235)):

- [1UBQ](https://www.rcsb.org/structure/1UBQ), ubiquitin: S. Vijay-Kumar, C. E. Bugg and W. J. Cook, J. Mol. Biol.
  194, 531–544 (1987). [doi:10.1016/0022-2836(87)90679-6](https://doi.org/10.1016/0022-2836(87)90679-6)
- [1OS7](https://www.rcsb.org/structure/1OS7), TauD with iron, α-ketoglutarate and taurine (the enzyme design
  task): J. R. O'Brien et al., Biochemistry 42, 5547–5554 (2003). [doi:10.1021/bi0341096](https://doi.org/10.1021/bi0341096)

The caffeine coordinates are an RDKit conformer; the enzyme design on the design-check slides is a generated
structure, not a deposited one.
