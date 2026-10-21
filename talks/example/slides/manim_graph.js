// Axes, a plotted function and an equation, built up a click at a time with manim-web (web/manim.js): the
// classic manim walk from rectangles to the area under a curve. MathTex renders offline (KaTeX is bundled).
//
// Steps: 1 the axes · 2 the curve · 3 coarse rectangles · 4 finer ones (a Transform) · 5 the area and the
// integral. Transform needs shapes it can morph point to point (a VGroup of rectangles into another); between
// unlike shapes, fade one out and the other in.
{
const f = (x) => 0.2 * x * x - 1.1 * x + 2.8;   // stays inside the axes' 0..4 on 0..6

Deck.slide('manim-graph', {
  steps: 5,
  notes: 'A function, Riemann sums that refine into the area, and the integral. Every object is made in build(); '
    + 'axes.plot, axes.getRiemannRectangles and axes.getArea come from manim-web, and match manim\'s Python API.',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <div class="deck-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('Graphs and equations')}</h2>
      <p class="deck-caption reveal-in" data-from="4">${esc('Transform turns the coarse rectangles into the fine ones; going back a step rebuilds them.')}</p>`;

    const stage = Deck.manim(frame.querySelector('.deck-stage'), {
      build: ({ M, P }) => {
        const axes = new M.Axes({
          xRange: [0, 6, 1], yRange: [0, 4, 1], xLength: 8, yLength: 5, color: P.muted,
        }).moveTo([-2.4, -0.7, 0]);
        const graph = axes.plot(f, { color: P.accent, strokeWidth: 5 });
        const rects = (dx) => axes.getRiemannRectangles(graph, {
          xRange: [1, 5], dx, color: P.series[1], fillOpacity: 0.35, strokeWidth: 1.5, strokeColor: P.series[1],
        });
        return {
          axes, graph,
          labels: axes.getAxisLabels({ xLabel: new M.MathTex({ latex: 'x', color: P.muted }),
                                       yLabel: new M.MathTex({ latex: 'f(x)', color: P.muted }) }),
          coarse: rects(0.5),
          fine: rects(0.1),
          area: axes.getArea(graph, [1, 5], { color: P.series[1], opacity: 0.45 }),
          eq: new M.MathTex({ latex: '\\int_1^5 f(x)\\,dx', color: P.fg, fontSize: 60 }).moveTo([4.7, 1.2, 0]),
        };
      },
      steps: [
        ({ axes, labels }, { M }) => [new M.Create(axes, { duration: 1.2 }), new M.FadeIn(labels)],
        ({ graph }, { M }) => [new M.Create(graph, { duration: 1.4 })],
        ({ coarse }, { M }) => [new M.FadeIn(coarse)],
        ({ coarse, fine }, { M }) => [new M.Transform(coarse, fine, { duration: 1.2 })],
        // the rectangles and the area have different shapes, so this crossfades rather than morphs
        ({ coarse, area, eq }, { M }) => [new M.FadeOut(coarse), new M.FadeIn(area), new M.Write(eq, { duration: 1.2 })],
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
