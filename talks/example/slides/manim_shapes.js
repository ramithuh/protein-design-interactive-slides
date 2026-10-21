// manim-web, a click at a time (web/manim.js). The scene's objects are built once in build(); each entry of
// steps is what one click plays. Going back a step, or arriving from a later slide, rebuilds the objects and
// applies the steps up to there instantly, so you never have to write the "undo" of an animation.
//
// The points on the right are plain HTML over the transparent scene, revealed on the same steps.
// Steps: 1 Create a circle · 2 Transform it into a square · 3 move it up, then LaggedStart a row of copies ·
// 4 Write a line.
{
const CODE = [
  { title: 'Create', sub: '<code class="deck-code">new M.Create(circle)</code>' },
  { title: 'Transform', sub: '<code class="deck-code">new M.Transform(circle, sq)</code>' },
  { title: 'Shift, then LaggedStart', sub: '<code class="deck-code">new M.LaggedStart([…])</code>' },
  { title: 'Write', sub: '<code class="deck-code">new M.Write(text)</code>' },
].map((p) => ({ ...p, html: true }));

Deck.slide('manim-shapes', {
  steps: 4,
  notes: 'Each click plays one entry of the steps list. Go back a step (left arrow or right click) and the scene '
    + 'is rebuilt at that step instantly; go forward again and the animation replays. Press O for the '
    + 'overview: every slide is pictured at its last step.',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <div class="deck-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('One click, one animation')}</h2>
      ${Deck.points(CODE, { className: 'ms-col' })}`;
    Deck.css(`.ms-col { --col-left: 60%; --col-top: 22%; --col-gap: calc(2.1 * var(--u)); }`);

    // world units: the frame is 16 x 9 with the origin at its centre; the shapes live in its left half
    const X = -3.2, Y = -0.4;
    const stage = Deck.manim(frame.querySelector('.deck-stage'), {
      build: ({ M, P }) => ({
        circle: new M.Circle({ radius: 1.3, color: P.accent, strokeWidth: 6 }).moveTo([X, Y, 0]),
        square: new M.Square({ sideLength: 2.4, color: P.series[1], fillOpacity: 0.25, strokeWidth: 6 }).moveTo([X, Y, 0]),
        copies: [-2.2, 0, 2.2].map((dx, i) => new M.Square({ sideLength: 1.1, color: P.series[i + 2] || P.accent,
          fillOpacity: 0.3, strokeWidth: 5 }).moveTo([X + dx, Y - 2.4, 0])),
        text: new M.Text({ text: 'every click is a step', fontSize: 44, fontFamily: 'Lato', color: P.fg })
          .moveTo([X, Y + 2.3, 0]),
      }),
      steps: [
        ({ circle }, { M }) => [new M.Create(circle, { duration: 1.2 })],
        ({ circle, square }, { M }) => [new M.Transform(circle, square)],
        // two plays in one step: shift the square up, then bring the copies in one after another
        async ({ circle, copies }, { M, play }) => {
          await play(new M.Shift(circle, { direction: [0, 0.6, 0], duration: 0.5 }));
          await play(new M.LaggedStart(copies.map((c) => new M.GrowFromCenter(c)), { lagRatio: 0.35 }));
        },
        ({ text }, { M }) => [new M.Write(text, { duration: 1.2 })],
      ],
    });

    return {
      enter(step, animate) { Deck.show(frame, step, animate); return stage.go(step, animate); },
      freeze: stage.freeze,
      destroy: stage.dispose,
    };
  },
});
}
