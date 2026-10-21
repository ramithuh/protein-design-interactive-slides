// The talk's sections, the footer along the bottom of every slide, and the outline slide.
//
// OUTLINE is the single list of sections: the outline slide shows it, and Deck.sections() puts it in the
// footer (FOOTER gives shorter footer names where a heading is long). TOPICS splits a section into topics,
// each covering some slides: the footer shows a dot per topic of the current section, filled as you get
// through them. Deck.expand(n) gives section n the whole footer while you are in it, its topics spread out
// as segments n.1, n.2, ... that fill like a progress bar; use it for the dense part of a talk.
//
// For a section divider that shows the whole outline with one section lit, register another copy, e.g. in
// the file that opens section 2:  Deck.slide('outline-2', outlineSlide({ highlight: '2' }));
const OUTLINE = [
  ['1', 'Building blocks: figures, points, charts'],
  ['2', 'Animation with manim-web', [
    ['2.1', 'Shapes and transforms'],
    ['2.2', 'Graphs and equations'],
  ]],
  ['3', 'Molecules: 2D drawings and the 3D add-on'],
];

const FOOTER = { 1: 'Building blocks', 2: 'Animation', 3: 'Molecules' };
Deck.sections(OUTLINE.map(([num, heading]) => [num, FOOTER[num] || heading]));

// [title, the slides that cover it, one line on what it is]
Deck.topics({
  1: [
    ['Figure and points', ['figure-points'], 'a figure on the left, numbered points on the right'],
    ['Charts', ['chart'], 'bar charts that grow in a group or a series at a time'],
  ],
  2: [
    ['Shapes and transforms', ['manim-shapes'], 'Create, Transform, LaggedStart, one click at a time'],
    ['Graphs and equations', ['manim-graph'], 'axes, a plotted function, MathTex'],
  ],
  3: [
    ['The protein alphabet', ['alphabet', 'backbone'], '20 amino acids joined into a chain, then lifted into 3D'],
    ['Small molecules', ['molecule'], 'ball and stick with a Mol*-like look'],
    ['Proteins', ['protein'], 'a cartoon from any PDB or mmCIF file'],
    ['Checking a design', ['design-task', 'design-clash'], 'an enzyme design against its request: zoom in, out, and elsewhere'],
  ],
});
Deck.expand('2');

function outlineSlide({ highlight = null } = {}) {
  return {
    steps: highlight ? 1 : 1 + OUTLINE.length,
    notes: highlight ? `Next: section ${highlight}.` : 'The outline: one section per click.',
    mount(frame, { css, esc }) {
      css(`
        .o-list { position: absolute; left: 6.5%; top: 20%; }
        .o-group { margin-bottom: 1.25em; }
        .o-group.dim { opacity: .3; }
        .o-row { display: flex; align-items: baseline; font-size: var(--t-lead); }
        .o-num { width: 1.45em; font-weight: 700; color: var(--accent); }
        .o-sub { display: flex; align-items: baseline; font-size: var(--t-small); color: var(--muted);
          margin: .2em 0 0 2em; }
        .o-sub .o-num { width: 2em; font-weight: 400; color: var(--muted); }
      `);
      // a section's sub-items stagger in just behind it (--i); step 1 is the heading alone
      frame.innerHTML = `<h2 class="deck-heading reveal-in" data-from="1">Outline</h2>
        <div class="o-list">${OUTLINE.map(([num, heading, subs = []], i) => `
          <div class="o-group${highlight && highlight !== num ? ' dim' : ''}">
            <div class="o-row reveal-in" data-from="${highlight ? 1 : i + 2}"><span class="o-num">${esc(num)}</span>${esc(heading)}</div>
            ${subs.map(([n, h], j) => `<div class="o-sub reveal-in" data-from="${highlight ? 1 : i + 2}" style="--i:${j + 1}">
              <span class="o-num">${esc(n)}</span>${esc(h)}</div>`).join('')}
          </div>`).join('')}</div>`;
      return { enter: (step, animate) => Deck.show(frame, step, animate) };
    },
  };
}

Deck.slide('outline', outlineSlide());
