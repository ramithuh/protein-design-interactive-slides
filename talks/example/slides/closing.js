// The last slide: how to start your own talk from this one, and where to get it. Out of every section, so no
// footer. Links are clickable while presenting; the deck does not step on a click on a link.
Deck.slide('closing', {
  steps: 1,
  notes: 'Copy talks/example to talks/<your talk>, delete the slides you do not need, and edit. AGENTS.md has '
    + 'the conventions for coding agents working in this repo.',
  mount(frame, { esc }) {
    const REPO = 'https://github.com/ramithuh/protein-design-interactive-slides';   // in your own talk: your repo, or drop the line
    const STEPS = [
      ['Get the template', `git clone ${REPO}`],
      ['Copy the example and edit it', 'cp -r talks/example talks/my_talk  ·  one module per slide in slides/'],
      ['Present', 'open index.html, or python -m http.server and browse to it'],
      ['Check', 'python tools/check_deck.py talks/my_talk'],
    ];
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('Make your own')}</h2>
      ${Deck.points(STEPS.map(([title, sub]) => ({ title, sub: `<code class="deck-code">${esc(sub)}</code>`, html: true, from: 1 })),
        { className: 'cl-col' })}
      <p class="cl-credits deck-detail">Built with <a href="https://github.com/maloyan/manim-web">manim-web</a>,
        <a href="https://threejs.org">three.js</a> and <a href="https://revealjs.com">Reveal.js</a> · cartoons and look
        after <a href="https://molstar.org">Mol*</a> · structures from the <a href="https://www.rcsb.org">PDB</a> (1UBQ,
        1OS7) via <a href="https://gemmi.readthedocs.io">gemmi</a> · drawings with <a href="https://www.rdkit.org">RDKit</a></p>
      <p class="deck-caption cl-repo"><a href="${esc(REPO)}">${esc(REPO.replace(/^https:\/\//, ''))}</a></p>`;
    Deck.css(`.cl-col { --col-left: 8%; --col-top: 19%; --col-gap: calc(1.9 * var(--u)); --col-title: var(--t-lead); }
      .deck-frame .cl-repo { left: 8%; font-size: var(--t-body); }
      .deck-frame .cl-credits a { color: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 40%, transparent); }
      .deck-frame .cl-credits { position: absolute; left: 8%; right: 4.2%; top: 82.5%; margin: 0; font-size: var(--t-micro);
        white-space: nowrap; }
      .deck-frame .cl-repo a { color: var(--accent); text-decoration: none; }`);
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
