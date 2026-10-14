// A small line chart drawn with SVG (no chart library).
// Usage:
//   const chart = createLineChart(document.getElementById('chart'), { onPickYear });
//   chart.update({ lines, metric, log, from, to, markerYear });
// Each line is { id, name, color, points: [{ year, value }] }.

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function createLineChart(container, { onPickYear } = {}) {
  const svg = svgEl('svg', { class: 'chart-svg', role: 'img' });
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  container.append(svg, tooltip);

  let last = null; // the most recent options, so we can redraw on resize
  let scales = null;

  // Redraw when the container changes size (phone rotation, window resize)
  new ResizeObserver(() => last && draw(last)).observe(container);

  function draw(opts) {
    last = opts;
    const { lines, metric, log, from, to, markerYear } = opts;
    const width = container.clientWidth;
    const height = width < 560 ? 260 : 380;
    const margin = { top: 16, right: 18, bottom: 30, left: width < 560 ? 52 : 64 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('height', height);
    svg.replaceChildren();

    const values = lines.flatMap((l) => l.points.map((p) => p.value)).filter((v) => v != null && (!log || v > 0));
    if (!values.length) {
      const msg = svgEl('text', { x: width / 2, y: height / 2, class: 'chart-empty', 'text-anchor': 'middle' });
      msg.textContent = 'No data for this selection';
      svg.append(msg);
      scales = null;
      return;
    }

    // ----- Scales: turn a year / value into an x / y position -----
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (metric === 'growth') {
      min = Math.min(min, 0); // always show the zero line for growth
      max = Math.max(max, 0);
    } else if (!log) {
      min = 0; // sizes start at zero on a normal scale
    }

    const ticks = log ? logTicks(min, max) : niceTicks(min, max, 5);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const t = (v) => (log ? Math.log10(v) : v);
    const x = (year) => margin.left + ((year - from) / Math.max(1, to - from)) * innerW;
    const y = (v) => margin.top + innerH - ((t(v) - t(yMin)) / (t(yMax) - t(yMin))) * innerH;
    scales = { x, from, to, margin, innerW };

    // ----- Grid lines and y labels -----
    const grid = svgEl('g', { class: 'grid' });
    for (const tick of ticks) {
      const ty = y(tick);
      grid.append(svgEl('line', { x1: margin.left, x2: width - margin.right, y1: ty, y2: ty, class: tick === 0 ? 'zero' : '' }));
      const label = svgEl('text', { x: margin.left - 8, y: ty, dy: '0.32em', 'text-anchor': 'end' });
      const decimals = Math.min(3, (String(tick).split('.')[1] ?? '').length); // 0.5 -> 1 decimal
      label.textContent = formatMetric(tick, metric, { digits: decimals, trim: true });
      grid.append(label);
    }

    // ----- X labels (years) -----
    const yearStep = niceTicks(from, to, width < 560 ? 4 : 7);
    for (const year of yearStep.filter((yr) => yr >= from && yr <= to && Number.isInteger(yr))) {
      const label = svgEl('text', { x: x(year), y: height - 8, 'text-anchor': 'middle' });
      label.textContent = year;
      grid.append(label);
    }
    svg.append(grid);

    // ----- Marker for the year picked in the rankings -----
    if (markerYear >= from && markerYear <= to) {
      svg.append(svgEl('line', {
        x1: x(markerYear), x2: x(markerYear), y1: margin.top, y2: margin.top + innerH, class: 'marker',
      }));
    }

    // ----- Lines (a gap wherever a year is missing) -----
    for (const line of lines) {
      let d = '';
      let penDown = false;
      for (const p of line.points) {
        if (p.value == null || (log && p.value <= 0)) {
          penDown = false;
          continue;
        }
        d += `${penDown ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`;
        penDown = true;
      }
      svg.append(svgEl('path', { d, class: 'line', stroke: line.color }));

      const lastPoint = [...line.points].reverse().find((p) => p.value != null && (!log || p.value > 0));
      if (lastPoint) {
        svg.append(svgEl('circle', { cx: x(lastPoint.year), cy: y(lastPoint.value), r: 3.5, fill: line.color, class: 'end-dot' }));
      }
    }

    // ----- Hover layer -----
    const hoverLine = svgEl('line', { y1: margin.top, y2: margin.top + innerH, class: 'hover-line', visibility: 'hidden' });
    const hoverDots = svgEl('g');
    const overlay = svgEl('rect', { x: margin.left, y: margin.top, width: innerW, height: innerH, class: 'overlay' });
    svg.append(hoverLine, hoverDots, overlay);

    const yearAt = (event) => {
      const rect = svg.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * width;
      const year = Math.round(from + ((px - margin.left) / innerW) * (to - from));
      return Math.min(to, Math.max(from, year));
    };

    overlay.addEventListener('pointermove', (event) => {
      const year = yearAt(event);
      hoverLine.setAttribute('x1', x(year));
      hoverLine.setAttribute('x2', x(year));
      hoverLine.setAttribute('visibility', 'visible');
      hoverDots.replaceChildren();

      const rows = lines
        .map((l) => ({ line: l, value: l.points.find((p) => p.year === year)?.value ?? null }))
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

      for (const { line, value } of rows) {
        if (value == null || (log && value <= 0)) continue;
        hoverDots.append(svgEl('circle', { cx: x(year), cy: y(value), r: 4.5, fill: '#fff', stroke: line.color, 'stroke-width': 2.5 }));
      }

      tooltip.innerHTML = `<p class="tt-year">${year}</p>` + rows.map(({ line, value }) => `
        <p class="tt-row"><span class="tt-key" style="background:${line.color}"></span>
        <span class="tt-name">${escapeHtml(line.name)}</span>
        <span class="tt-value">${formatMetric(value, metric)}</span></p>`).join('');
      tooltip.hidden = false;

      // keep the tooltip inside the chart
      const left = (x(year) / width) * container.clientWidth;
      const flip = left > container.clientWidth * 0.6;
      tooltip.style.left = `${flip ? left - tooltip.offsetWidth - 14 : left + 14}px`;
      tooltip.style.top = `${margin.top}px`;
    });

    overlay.addEventListener('pointerleave', () => {
      hoverLine.setAttribute('visibility', 'hidden');
      hoverDots.replaceChildren();
      tooltip.hidden = true;
    });

    overlay.addEventListener('click', (event) => onPickYear?.(yearAt(event)));

    svg.setAttribute('aria-label', `${METRICS[metric].label} from ${from} to ${to}: ${lines.map((l) => l.name).join(', ')}`);
  }

  return { update: draw };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
