// The 3D add-on, part 2: a protein as a cartoon (web/addons/cartoon.js, built the way Mol*'s cartoon is),
// from any PDB or mmCIF file via tools/prep_protein.py. Here ubiquitin, PDB 1UBQ.
//
// Steps: 1 the cartoon in one colour · 2 coloured by secondary structure, with the key.
{
const SCALE = 0.13;   // scene units per Å: ubiquitin's ~24 Å radius is about 3 units

Deck.slide('protein', {
  steps: 2,
  interactive: true,
  notes: 'Ubiquitin (PDB 1UBQ), 76 residues. Step 2 swaps in a cartoon coloured by secondary structure: helices, '
    + 'strands and loops, from the file\'s helix and sheet records. To show your own protein: python '
    + 'tools/prep_protein.py my.cif talks/<talk>/data/my_protein.json, load data/my_protein.js on the page, and '
    + 'pass data.my_protein to Deck.cartoon.',
  mount(frame, { palette: P, data, M, esc }) {
    const D = data.ubiquitin;
    const key = [['H', 'helix'], ['E', 'strand'], ['C', 'loop']].map(([k, name]) =>
      `<span><i style="background:${P.ss[k]}"></i>${name}</span>`).join('');
    frame.innerHTML = `
      <div class="deck-stage turnable pr-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('A protein as a cartoon')}</h2>
      ${Deck.points([
        { title: `Ubiquitin, ${D.ca.length} residues`, sub: `PDB ${D.source.replace(/\..*/, '').toUpperCase()}, chain ${D.chain}`, from: 1 },
        { title: 'Coloured by secondary structure', sub: `<span class="pr-key">${key}</span>`, html: true, from: 2 },
      ], { className: 'pr-col' })}
      <p class="deck-caption deck-detail reveal-in" data-from="1">${esc('Drag to turn, scroll to zoom.')}</p>`;
    Deck.css(`.pr-col { --col-left: 60%; --col-top: 26%; --col-gap: calc(2.4 * var(--u)); }
      .deck-frame .pr-stage { right: 38%; }
      .pr-key { display: inline-flex; gap: 1.2em; }
      .pr-key i { display: inline-block; width: .9em; height: .9em; border-radius: 50%; margin-right: .4em;
        vertical-align: -.1em; }`);

    const view = Deck.turntable(frame.querySelector('.pr-stage'), { radius: D.radius * SCALE, scale: SCALE, rock: 0.45 });
    // the cartoon is built in Å (its ribbon widths are Å), then the meshes are scaled into the scene
    const plain = Deck.cartoon(D, { color: P.accent });
    const bySS = Deck.cartoon(D, { ss: P.ss });
    for (const t of [plain, bySS]) t.mesh.scale.setScalar(SCALE);
    view.add(plain.mesh, bySS.mesh);

    return {
      enter(step, animate) {
        view.start();
        Deck.show(frame, step, animate);
        plain.mesh.visible = step < 2;
        bySS.mesh.visible = step >= 2;
        view.dirty();
      },
      leave: view.stop,
      freeze: view.render,
      destroy() { plain.dispose(); bySS.dispose(); view.dispose(); },
    };
  },
});
}
