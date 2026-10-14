// ---------- Setup ----------
const DATA = window.GDP_DATA;
const COLORS = ['#2450d3', '#e0582f', '#119a8b', '#8a4fd8', '#b8860b'];
const MAX_COUNTRIES = COLORS.length;
const TOP_N = 15;
const REGIONS = ['All', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

const byCode = new Map(DATA.countries.map((c) => [c.code, c]));
const byName = new Map(DATA.countries.map((c) => [c.name.toLowerCase(), c]));

// Everything the page shows comes from this one object.
const state = {
  selected: [], // [{ code, color }]
  metric: 'gdp',
  log: false,
  from: 1990,
  to: DATA.lastYear,
  year: DATA.lastYear, // year shown in the rankings
  region: 'All',
  showAll: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  chart: $('chart'),
  chartNote: $('chartNote'),
  fromYear: $('fromYear'),
  toYear: $('toYear'),
  logScale: $('logScale'),
  addForm: $('addForm'),
  addInput: $('addInput'),
  addError: $('addError'),
  countryList: $('countryList'),
  slotsLeft: $('slotsLeft'),
  selectedList: $('selectedList'),
  compareBody: $('compareBody'),
  compareRange: $('compareRange'),
  gdpHeading: $('gdpHeading'),
  bigYear: $('bigYear'),
  rankSub: $('rankSub'),
  yearSlider: $('yearSlider'),
  playBtn: $('playBtn'),
  playIcon: $('playIcon'),
  regionTabs: $('regionTabs'),
  rankBody: $('rankBody'),
  valueHeading: $('valueHeading'),
  showAll: $('showAll'),
};

const chart = createLineChart(els.chart, { onPickYear: (year) => setState({ year }) });

// ---------- State changes ----------
function setState(changes) {
  Object.assign(state, changes);
  if (!METRICS[state.metric].logOk) state.log = false;
  render();
  saveToUrl();
}

function addCountry(code) {
  if (state.selected.some((s) => s.code === code)) return 'Already on the chart.';
  if (state.selected.length >= MAX_COUNTRIES) return `You can compare up to ${MAX_COUNTRIES} countries.`;
  const used = new Set(state.selected.map((s) => s.color));
  const color = COLORS.find((c) => !used.has(c));
  setState({ selected: [...state.selected, { code, color }] });
  return null;
}

function removeCountry(code) {
  setState({ selected: state.selected.filter((s) => s.code !== code) });
}

// ---------- Rendering ----------
function render() {
  renderControls();
  renderChart();
  renderSelected();
  renderCompare();
  renderRankings();
}

function renderControls() {
  document.querySelector(`input[name="metric"][value="${state.metric}"]`).checked = true;
  els.logScale.checked = state.log;
  els.logScale.disabled = !METRICS[state.metric].logOk;
  els.fromYear.value = state.from;
  els.toYear.value = state.to;

  const left = MAX_COUNTRIES - state.selected.length;
  els.slotsLeft.textContent = left ? `${left} more can be added` : 'Remove one to add another';
  els.addInput.disabled = left === 0;
}

function renderChart() {
  const lines = state.selected.map(({ code, color }) => {
    const c = byCode.get(code);
    return { id: code, name: c.name, color, points: series(c, state.metric, state.from, state.to, DATA) };
  });
  chart.update({ lines, metric: state.metric, log: state.log, from: state.from, to: state.to, markerYear: state.year });

  const m = METRICS[state.metric];
  els.chartNote.textContent = `${m.label}, ${m.unit}${state.log ? ', log scale' : ''}. Hover to compare, click to rank that year.`;
}

// Side list: one row per selected country with its value for the current measure
function renderSelected() {
  if (!state.selected.length) {
    els.selectedList.innerHTML = '<li class="empty-note">Add a country to start comparing.</li>';
    return;
  }
  els.selectedList.innerHTML = state.selected.map(({ code, color }) => {
    const c = byCode.get(code);
    const value = metricValue(c, state.metric, state.year, DATA);
    return `
      <li style="--series:${color}">
        <span class="swatch" aria-hidden="true"></span>
        <span class="sel-name">${escapeHtml(c.name)}</span>
        <span class="sel-value" title="${METRICS[state.metric].label}, ${state.year}">${formatMetric(value, state.metric)}</span>
        <button type="button" class="remove" data-remove="${c.code}" aria-label="Remove ${escapeHtml(c.name)}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </li>`;
  }).join('');
}

// Comparison table: summary numbers for the chosen range of years
function renderCompare() {
  els.compareRange.textContent = `${state.from}–${state.to}`;
  els.gdpHeading.textContent = `GDP, ${state.to}`;

  if (!state.selected.length) {
    els.compareBody.innerHTML = '<tr><td colspan="6" class="empty-note">No countries selected.</td></tr>';
    return;
  }

  els.compareBody.innerHTML = state.selected.map(({ code, color }) => {
    const c = byCode.get(code);
    const s = summarize(c, state.from, state.to, DATA);
    const name = `<th scope="row"><span class="swatch" style="--series:${color}" aria-hidden="true"></span>${escapeHtml(c.name)}</th>`;
    if (!s) return `<tr>${name}<td colspan="5" class="empty-note">No GDP data for these years</td></tr>`;

    // Footnote when a country's data starts or ends inside the chosen range
    const partial = s.startYear !== state.from || s.endYear !== state.to
      ? `<span class="years">data ${s.startYear}–${s.endYear}</span>` : '';
    const growthClass = s.cagr == null ? '' : s.cagr >= 0 ? 'up' : 'down';
    return `
      <tr>
        ${name}
        <td class="num">${formatMoney(s.gdp)}</td>
        <td class="num">${formatMoney(s.gdppc, { compact: false })}</td>
        <td class="num">${formatPercent(s.share, { digits: s.share < 1 ? 2 : 1 })}</td>
        <td class="num ${growthClass}">${formatPercent(s.cagr, { signed: true })}</td>
        <td class="num">${s.multiple ? `${s.multiple.toFixed(1)}×` : '–'}${partial}</td>
      </tr>`;
  }).join('');
}

function renderRankings() {
  const ranked = rankCountries(DATA, state.metric, state.year, state.region);
  const lastYear = new Map(
    rankCountries(DATA, state.metric, state.year - 1, state.region).map((r) => [r.country.code, r.rank])
  );
  const selectedColor = new Map(state.selected.map((s) => [s.code, s.color]));

  // Always show the selected countries, even when they are outside the top 15
  const rows = state.showAll
    ? ranked
    : ranked.filter((r) => r.rank <= TOP_N || selectedColor.has(r.country.code));

  const max = Math.max(...ranked.map((r) => Math.abs(r.value)), 0);

  els.bigYear.textContent = state.year;
  els.yearSlider.value = state.year;
  els.valueHeading.textContent = METRICS[state.metric].label;
  els.rankSub.textContent = ranked.length
    ? `${ranked.length} ${state.region === 'All' ? 'countries' : `countries in ${state.region}`} with data in ${state.year}`
    : `No data for ${state.year}`;
  els.showAll.hidden = ranked.length <= TOP_N;
  els.showAll.textContent = state.showAll ? `Show top ${TOP_N}` : `Show all ${ranked.length}`;

  let previousRank = 0;
  els.rankBody.innerHTML = rows.map((r) => {
    const gap = r.rank > previousRank + 1 ? '<tr class="gap" aria-hidden="true"><td colspan="4">⋮</td></tr>' : '';
    previousRank = r.rank;

    const color = selectedColor.get(r.country.code);
    const before = lastYear.get(r.country.code);
    // Rank changes are meaningful for size, not for growth rates that jump around every year
    const move = before && state.metric !== 'growth' ? before - r.rank : 0;
    const moveCell = move > 0
      ? `<span class="move up" title="Up ${move} since ${state.year - 1}">▲${move}</span>`
      : move < 0
        ? `<span class="move down" title="Down ${-move} since ${state.year - 1}">▼${-move}</span>`
        : '';
    const width = max ? (Math.abs(r.value) / max) * 100 : 0;

    return `${gap}
      <tr class="${color ? 'is-selected' : ''}" style="${color ? `--series:${color}` : ''}" data-code="${r.country.code}">
        <td class="col-rank">${r.rank}</td>
        <td class="col-country">
          <button type="button" class="row-add" data-add="${r.country.code}"
            aria-label="${color ? `${escapeHtml(r.country.name)} is on the chart` : `Add ${escapeHtml(r.country.name)} to the chart`}">
            ${escapeHtml(r.country.name)}
          </button>
        </td>
        <td class="col-move">${moveCell}</td>
        <td class="col-value">
          <div class="bar-cell">
            <span class="bar-track"><span class="bar ${r.value < 0 ? 'neg' : ''}" style="width:${width.toFixed(1)}%"></span></span>
            <span class="num">${formatMetric(r.value, state.metric)}</span>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ---------- Shareable links: the URL remembers the current view ----------
function saveToUrl() {
  const params = new URLSearchParams({
    c: state.selected.map((s) => s.code).join(','),
    m: state.metric,
    from: state.from,
    to: state.to,
    y: state.year,
  });
  if (state.log) params.set('log', '1');
  if (state.region !== 'All') params.set('r', state.region);
  history.replaceState(null, '', `#${params}`);
}

function loadFromUrl() {
  const params = new URLSearchParams(location.hash.slice(1));
  const year = (key, fallback) => {
    const n = Number(params.get(key));
    return Number.isInteger(n) && n >= DATA.firstYear && n <= DATA.lastYear ? n : fallback;
  };
  const codes = (params.get('c') ?? 'USA,CHN,IND,BRA').split(',').filter((code) => byCode.has(code)).slice(0, MAX_COUNTRIES);

  state.selected = codes.map((code, i) => ({ code, color: COLORS[i] }));
  state.metric = METRICS[params.get('m')] ? params.get('m') : 'gdp';
  state.from = year('from', 1990);
  state.to = year('to', DATA.lastYear);
  if (state.from >= state.to) [state.from, state.to] = [1990, DATA.lastYear];
  state.year = year('y', state.to);
  state.log = params.get('log') === '1';
  state.region = REGIONS.includes(params.get('r')) ? params.get('r') : 'All';
}

// ---------- Play through the years ----------
let playTimer = null;

function togglePlay() {
  if (playTimer) return stopPlay();
  if (state.year >= state.to) setState({ year: state.from });
  els.playIcon.setAttribute('d', 'M4 3h3v10H4zM9 3h3v10H9z');
  els.playBtn.setAttribute('aria-label', 'Pause');
  playTimer = setInterval(() => {
    if (state.year >= state.to) return stopPlay();
    setState({ year: state.year + 1 });
  }, 220);
}

function stopPlay() {
  clearInterval(playTimer);
  playTimer = null;
  els.playIcon.setAttribute('d', 'M4 2.5v11l9-5.5z');
  els.playBtn.setAttribute('aria-label', 'Play through the years');
}

// ---------- Event listeners ----------
document.querySelectorAll('input[name="metric"]').forEach((input) =>
  input.addEventListener('change', () => setState({ metric: input.value })));

els.logScale.addEventListener('change', () => setState({ log: els.logScale.checked }));

els.fromYear.addEventListener('change', () => {
  const from = Number(els.fromYear.value);
  setState({ from, to: Math.max(state.to, from + 1), year: Math.max(state.year, from) });
});
els.toYear.addEventListener('change', () => {
  const to = Number(els.toYear.value);
  setState({ to, from: Math.min(state.from, to - 1), year: Math.min(state.year, to) });
});

els.addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const country = byName.get(els.addInput.value.trim().toLowerCase());
  const error = country ? addCountry(country.code) : 'Pick a country from the list.';
  els.addError.textContent = error ?? '';
  if (!error) els.addInput.value = '';
});

els.selectedList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (button) removeCountry(button.dataset.remove);
});

els.rankBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const error = addCountry(button.dataset.add);
  els.addError.textContent = error && error !== 'Already on the chart.' ? error : '';
});

els.yearSlider.addEventListener('input', () => {
  stopPlay();
  setState({ year: Number(els.yearSlider.value) });
});
els.playBtn.addEventListener('click', togglePlay);

els.regionTabs.addEventListener('change', (event) => setState({ region: event.target.value }));
els.showAll.addEventListener('click', () => setState({ showAll: !state.showAll }));

// ---------- Start ----------
function init() {
  const years = [];
  for (let y = DATA.firstYear; y <= DATA.lastYear; y++) years.push(`<option value="${y}">${y}</option>`);
  els.fromYear.innerHTML = years.join('');
  els.toYear.innerHTML = years.join('');
  els.yearSlider.min = DATA.firstYear;
  els.yearSlider.max = DATA.lastYear;

  els.countryList.innerHTML = [...DATA.countries]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('');
  $('countryCount').textContent = DATA.countries.length;

  loadFromUrl();
  els.regionTabs.innerHTML = REGIONS.map((r) => `
    <label><input type="radio" name="region" value="${r}" ${r === state.region ? 'checked' : ''}><span>${r}</span></label>`).join('');

  render();
  saveToUrl();
}

init();
