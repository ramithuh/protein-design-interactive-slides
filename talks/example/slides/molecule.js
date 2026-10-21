// The 3D add-on, part 1: a small molecule in ball and stick, drawn the way Mol* draws it (outlines, ambient
// occlusion, matte lighting: web/addons/molstar.js), on a turntable you can drag and zoom
// (web/addons/turntable.js). The atoms come from data/caffeine.js (an RDKit conformer; any list of elements,
// positions in Å and bonds will do).
//
// Steps: 1 the molecule, rocking · 2 the points beside it.
{
const toScene = ([x, y, z]) => [x, -z, y];   // data: x right, y up, z toward the viewer -> scene: z up
const SCALE = 0.42;                          // scene units per Å

Deck.slide('molecule', {
  steps: 2,
  interactive: true,
  notes: 'Caffeine, 14 heavy atoms. Drag to turn it, scroll to zoom; it rocks gently while idle. The look is '
    + 'tuned to match Mol*, the viewer on the PDB\'s pages: change it for a whole talk with '
    + 'Deck.molstar.configure({...}) on the page, or for one slide in the look option of Deck.turntable.',
  mount(frame, { palette: P, data, M, esc }) {
    const D = data.caffeine;
    frame.innerHTML = `
      <div class="deck-stage turnable mo-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('A small molecule in 3D')}</h2>
      ${Deck.points([
        { title: `${D.name}, ${D.formula}`, sub: `${D.heavy_atoms} heavy atoms · ${Math.round(D.mass)} Da`, from: 2 },
        { title: 'Drag to turn, scroll to zoom', sub: 'a click without moving still steps the deck', from: 2 },
        { title: 'Element colours as in Mol*', sub: 'palette.cpk; hydrogens left out', from: 2 },
      ], { className: 'mo-col' })}`;
    Deck.css(`.mo-col { --col-left: 58%; --col-top: 24%; --col-gap: calc(2.2 * var(--u)); }
      .deck-frame .mo-stage { right: 40%; }`);

    const host = frame.querySelector('.mo-stage');
    const half = Math.max(...D.xyz.flat().map(Math.abs)) * SCALE;
    const view = Deck.turntable(host, { radius: half + 0.6, scale: SCALE, rock: 0.5 });
    view.add(new M.Molecule3D({
      atoms: D.elements.map((element, j) => ({ element, position: toScene(D.xyz[j].map((v) => v * SCALE)) })),
      bonds: D.bonds.map(([from, to, order]) => ({ from, to, order })),
      colors: P.cpk, radiusScheme: 'covalent', radiusScale: 0.42 * SCALE, bondRadius: 0.11 * SCALE,  // radii in Å, scaled too
      sphereResolution: 20,
    }));

    return {
      enter(step, animate) { view.start(); Deck.show(frame, step, animate); },
      leave: view.stop,
      freeze: view.render,
      destroy: view.dispose,
    };
  },
});
}
