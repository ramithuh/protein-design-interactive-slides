// The title slide: no section, so no footer. The title is there on arrival; the byline joins on the second
// click (drop `steps` and the data-from to show everything at once).
Deck.slide('title', {
  steps: 2,
  notes: 'Title slide. Press S for the speaker view (these notes, a timer and the next slide), O for the '
    + 'overview, T to switch theme, L for a laser pointer.',
  mount(frame, { esc }) {
    const TITLE = {
      title: 'Live slides with manim-web',
      subtitle: 'A template: every slide drawn in the browser, a click at a time',
      name: 'Your Name',
      place: 'Your lab · Your institution · Date',
    };
    frame.innerHTML = `
      <h1 class="deck-title reveal-in" data-from="1">${esc(TITLE.title)}</h1>
      <p class="deck-subtitle reveal-in" data-from="1" style="--i:1">${esc(TITLE.subtitle)}</p>
      <div class="deck-byline reveal-in" data-from="2">${esc(TITLE.name)}<span>${esc(TITLE.place)}</span></div>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
