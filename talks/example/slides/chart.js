// A grouped bar chart (web/plots.js) that grows in a group per click. Every chart in a deck shares one layout,
// so a chart slide is the heading, the data and one call. The numbers here are made up for the template.
//
// Steps: 1 the first group · 2 the second · 3 the third, highlighted.
Deck.slide('chart', {
  steps: 3,
  notes: 'Illustrative numbers only. Values are [count, of] pairs drawn as percentages; for plain numbers pass '
    + 'max (and optionally format) to Deck.groupedBars. Put the steps on the series instead of the groups to '
    + 'add one colour to every group per click.',
  mount(frame, { esc }) {
    frame.innerHTML = `<h2 class="deck-heading reveal-in in">${esc('A chart, a group at a time')}</h2>`;
    const plot = Deck.groupedBars(frame, {
      series: [
        { key: 'base', label: 'Baseline' },
        { key: 'ours', label: 'New method' },
      ],
      groups: [
        { key: 'easy', label: ['Easy', 'cases'], step: 1, values: { base: [61, 100], ours: [72, 100] } },
        { key: 'mid', label: ['Medium', 'cases'], step: 2, values: { base: [38, 100], ours: [55, 100] } },
        { key: 'hard', label: ['Hard', 'cases'], step: 3, highlight: true, values: { base: [9, 100], ours: [31, 100] } },
      ],
      strong: 'ours',
      footnote: ['Illustrative numbers for the template · 100 cases per group'],
    });
    return { enter: (step, animate) => plot.show(step, animate) };
  },
});
