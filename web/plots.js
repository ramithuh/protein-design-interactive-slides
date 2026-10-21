// Charts for the live decks, laid out one way everywhere (the rules are in web/deck.css, under "Plots"):
// the slide heading; a small legend centred under it with room to breathe; a compact chart with wide side
// margins; each group's label hung under its own bars, so it is centred on them; a small light-grey footnote
// at the bottom. With nothing at the bottom (no caption), the chart drops lower, clear of the title.
//
//   const plot = Deck.groupedBars(frame, {
//     series: [{ key: 'a', label: 'Method A' }, { key: 'b', label: 'Method B' }],   // colours: --plot-1, -2, ...
//     groups: [{ key: 'small', label: ['Small', 'inputs'], step: 2, highlight: false,
//                values: { a: [59, 144], b: [80, 144] } }, ...],   // [count, of], drawn as a percentage
//     strong: 'b',                 // optional: the series whose values are set in bold
//     footnote: ['Source: ...'],
//     captioned: false,            // true when the slide puts a caption under it (the chart then sits higher)
//   });
//   plot.show(step, animate);      // groups whose step <= step grow in; call it from the slide's enter()
//
// Values are [count, of] pairs, drawn as percentages with ticks every 25%. For plain numbers instead, give
// `max` (the top of the axis) and optionally `ticks` (default 4 intervals) and `format` (value -> label):
//
//   Deck.groupedBars(frame, { max: 40, format: (v) => `${v} ms`, series, groups: [{ ..., values: { a: 12 } }] })
//
// A series may carry a `step` instead, and then the chart builds up a series at a time with every group on
// screen from the start: one colour joins each group on each click, rather than one group arriving whole.
// Give the steps to the groups or to the series, not to both. A single series is a plain bar chart.
(function () {
  'use strict';

  const esc = window.Deck.esc;
  const pct = (k, n) => `${(100 * k / n).toFixed(k === 0 || k === n ? 0 : 1)}%`;

  function groupedBars(frame, { series, groups, strong = null, footnote = [], captioned = false,
                                max = null, ticks = 4, format = null }) {
    // [count, of] pairs, or plain numbers on a 0..max axis
    const fraction = (v) => (max === null ? v[0] / v[1] : v / max);
    const label = (v) => (max === null ? pct(v[0], v[1]) : (format ? format(v) : String(v)));
    const tickLabel = (f) => (max === null ? `${Math.round(100 * f)}%` : (format ? format(+(f * max).toFixed(6)) : String(+(f * max).toFixed(6))));
    const tickAt = Array.from({ length: ticks + 1 }, (_, i) => i / ticks);

    const root = document.createElement('div');
    const bySeries = series.some((s) => s.step);
    root.className = `deck-plot${captioned ? ' captioned' : ''}${bySeries ? ' by-series' : ''}`;
    root.innerHTML = `
      <div class="deck-plot-key">${series.length > 1 ? series.map((s, i) => `<span><i style="background:var(--plot-${i + 1})"></i>${esc(s.label)}</span>`).join('') : ''}</div>
      <div class="deck-plot-chart">
        ${tickAt.map((f) => `<div class="deck-plot-grid" style="bottom:${100 * f}%"><span>${esc(tickLabel(f))}</span></div>`).join('')}
        <div class="deck-plot-groups">${groups.map((g) => `
          <div class="deck-plot-group${g.highlight ? ' highlight' : ''}" data-step="${g.step || 1}">${series.map((s, i) => {
            const v = g.values[s.key];
            const h = 100 * Math.min(1, fraction(v));
            return `<div class="deck-plot-bar" data-step="${s.step || 1}" title="${esc(label(v))}"><div class="deck-plot-fill" style="height:${h}%; background:var(--plot-${i + 1})"></div>
              <span class="deck-plot-val${s.key === strong ? ' strong' : ''}" style="bottom:${h}%">${esc(label(v))}</span></div>`;
          }).join('')}
            <div class="deck-plot-label">${[].concat(g.label).map(esc).join('<br>')}</div>
          </div>`).join('')}</div>
      </div>
      <div class="deck-plot-foot deck-detail">${footnote.map(esc).join('<br>')}</div>`;
    frame.append(root);
    const items = [...root.querySelectorAll('.deck-plot-group')];
    // when the series carry the steps, the groups are all in from the start and the bars come in instead
    const bars = bySeries ? [...root.querySelectorAll('.deck-plot-bar')] : [];
    const firstStep = Math.min(...series.map((s) => s.step || 1));
    return {
      root,
      show(step, animate = true) {
        root.classList.toggle('instant', !animate);
        void root.offsetWidth;  // flush styles, so a fresh mount grows the bars from zero
        if (bySeries) {
          items.forEach((el) => el.classList.toggle('in', step >= firstStep));
          bars.forEach((el) => el.classList.toggle('in', step >= Number(el.dataset.step)));
        } else {
          items.forEach((el) => el.classList.toggle('in', step >= Number(el.dataset.step)));
        }
      },
    };
  }

  window.Deck.groupedBars = groupedBars;
})();
