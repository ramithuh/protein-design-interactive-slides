// The title slide: no section, so no footer. The title is there on arrival; the byline joins on the second
// click (drop `steps` and the data-from to show everything at once).
Deck.slide('title', {
  steps: 2,
  notes: 'Title slide. Press S for the speaker view (these notes, a timer and the next slide), O for the '
    + 'overview, T to switch theme, L for a laser pointer. A click also steps forward, a right-click back.',
  mount(frame, { theme, css, esc }) {
    const TITLE = {
      title: 'Live slides with manim-web',
      subtitle: 'A template: every slide drawn in the browser, a click at a time',
      name: 'Your Name',
      place: 'Your lab · Your institution · Date',
      repo: 'https://github.com/ramithuh/protein-design-interactive-slides',   // in your own talk: your repo or project page, or drop it
    };
    const KEYS = [
      ['→', 'next'], ['←', 'back'], ['F', 'fullscreen'], ['L', 'laser'], ['O', 'overview'], ['S', 'speaker notes'],
      ['T', theme === 'dark' ? 'light mode' : 'dark mode'],
    ];
    frame.innerHTML = `
      <h1 class="deck-title reveal-in" data-from="1">${esc(TITLE.title)}</h1>
      <p class="deck-subtitle reveal-in" data-from="1" style="--i:1">${esc(TITLE.subtitle)}</p>
      <p class="ti-repo reveal-in" data-from="1" style="--i:2"><a href="${esc(TITLE.repo)}">${esc(TITLE.repo.replace(/^https:\/\//, ''))}</a></p>
      <div class="deck-byline reveal-in" data-from="2">${esc(TITLE.name)}<span>${esc(TITLE.place)}</span></div>
      <p class="ti-keys deck-detail reveal-in" data-from="1" style="--i:3">${KEYS.map(([k, what]) =>
        `<span><kbd>${esc(k)}</kbd>${esc(what)}</span>`).join('')}</p>`;
    // the keys, for whoever opens the deck: not part of the talk, so they sit low and quiet
    css(`.ti-repo { position: absolute; left: 8%; top: 59.5%; margin: 0; font-size: var(--t-body); }
      .ti-repo a { color: var(--accent); text-decoration: none; }
      .ti-keys { position: absolute; left: 8%; right: 4.2%; top: 86.5%; margin: 0; display: flex; flex-wrap: wrap;
        gap: .4em 1.3em; font-size: var(--t-caption); }
      .ti-keys kbd { margin-right: .45em; }`);
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
