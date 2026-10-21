// The deck's standard way of walking through a picture: the figure on the left (.deck-figure), a numbered
// column of points on the right (Deck.points -> .deck-col), and each click adds a point and the part of the
// figure it talks about. The figure here is plain SVG with data-from on its parts, so Deck.show reveals the
// figure and the points together; any drawing works the same way (an <img>, a canvas, a manim-web stage).
//
// Steps: 1 the heading and the first box · 2 the second box and its arrow · 3 the third.
{
const POINTS = [
  { title: 'A slide is a module', sub: 'one JS file in slides/ that draws into a 16:9 frame', from: 1 },
  { title: 'Steps are clicks', sub: 'enter(step) shows steps 1..step; mark elements with data-from', from: 2 },
  { title: 'The deck does the rest', sub: 'footer, themes, notes, overview, and freeing WebGL off-screen', from: 3 },
];

Deck.slide('figure-points', {
  steps: 3,
  notes: 'A figure and a column of points that build up together. The layout comes from the design language '
    + '(.deck-figure, .deck-col in web/deck.css), so every slide of this kind lines up the same way. A slide '
    + 'moves the column with three variables: --col-left, --col-top, --col-gap.',
  mount(frame, { palette: P, css, esc }) {
    css(`
      .fp-col { --col-top: 22%; --col-gap: calc(2.2 * var(--u)); }
      .fp-fig text { font-family: Lato, sans-serif; }
      .fp-fig .reveal-in { transform: none; }  /* SVG parts fade in place rather than slide */
    `);
    const box = (x, y, label, from) => `
      <g class="reveal-in" data-from="${from}">
        <rect x="${x}" y="${y}" width="230" height="90" rx="14" fill="${P.accent}" fill-opacity=".12"
          stroke="${P.accent}" stroke-width="2.5"/>
        <text x="${x + 115}" y="${y + 55}" font-size="28" text-anchor="middle" fill="${P.fg}">${esc(label)}</text>
      </g>`;
    const arrow = (x1, y1, x2, y2, from) => `<path class="reveal-in" data-from="${from}" d="M${x1},${y1} L${x2},${y2}"
      stroke="${P.muted}" stroke-width="3" marker-end="url(#fp-head)"/>`;
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">A figure and its points</h2>
      <div class="deck-figure fp-fig"><svg viewBox="0 0 640 460">
        <defs><marker id="fp-head" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <path d="M0,0 L10,4 L0,8 z" fill="${P.muted}"/></marker></defs>
        ${box(40, 40, 'slides/*.js', 1)}
        ${arrow(270, 85, 360, 200, 2)}
        ${box(370, 185, 'enter(step)', 2)}
        ${arrow(485, 275, 330, 345, 3)}
        ${box(90, 330, 'Deck runtime', 3)}
      </svg></div>
      ${Deck.points(POINTS, { className: 'fp-col' })}
      <p class="deck-caption reveal-in" data-from="3">Captions sit on one line along the bottom, above the footer.</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
