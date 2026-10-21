// The last slide: how to start your own talk from this one. Out of every section, so no footer.
Deck.slide('closing', {
  steps: 1,
  notes: 'Copy talks/example to talks/<your talk>, delete the slides you do not need, and edit. AGENTS.md has '
    + 'the conventions for coding agents working in this repo.',
  mount(frame, { esc }) {
    const STEPS = [
      ['Copy the example', 'cp -r talks/example talks/my_talk'],
      ['Edit or add slides', 'one module per file in slides/, listed in order in index.html'],
      ['Present', 'open index.html, or python -m http.server and browse to it'],
      ['Check', 'python tools/check_deck.py talks/my_talk'],
    ];
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('Make your own')}</h2>
      ${Deck.points(STEPS.map(([title, sub]) => ({ title, sub: `<code class="deck-code">${esc(sub)}</code>`, html: true, from: 1 })),
        { className: 'cl-col' })}`;
    Deck.css(`.cl-col { --col-left: 8%; --col-top: 22%; --col-gap: calc(2.6 * var(--u)); --col-title: var(--t-lead); }`);
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
