// Calculations and formatting. No DOM code here, so everything can be tested in Node.
// Run the tests with:  node tests/analysis.test.js

const METRICS = {
  gdp:    { label: 'GDP', unit: 'current US$', format: 'money', logOk: true },
  gdppc:  { label: 'GDP per person', unit: 'current US$', format: 'money', logOk: true },
  growth: { label: 'Annual change in GDP', unit: '% per year, nominal US$', format: 'percent', logOk: false },
  share:  { label: 'Share of world GDP', unit: '% of world total', format: 'percent', logOk: true },
};

// Value of one metric for one country in one year (null if the data is missing).
// GDP is stored in millions of US$.
function metricValue(country, metric, year, data) {
  const i = year - data.firstYear;
  const gdp = country.gdp[i];
  if (gdp == null) return null;

  switch (metric) {
    case 'gdp':
      return gdp * 1e6;
    case 'gdppc': {
      const pop = country.pop[i];
      return pop ? (gdp * 1e6) / pop : null;
    }
    case 'growth': {
      const prev = i > 0 ? country.gdp[i - 1] : null;
      return prev ? (gdp / prev - 1) * 100 : null;
    }
    case 'share': {
      const world = data.world[i];
      return world ? (gdp / world) * 100 : null;
    }
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}

// [{ year, value }] for a range of years (value can be null).
function series(country, metric, from, to, data) {
  const points = [];
  for (let year = from; year <= to; year++) {
    points.push({ year, value: metricValue(country, metric, year, data) });
  }
  return points;
}

// Compound annual growth rate, as a percent: how fast something grew per year on average.
function cagr(startValue, endValue, years) {
  if (!startValue || !endValue || years <= 0 || startValue < 0 || endValue < 0) return null;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

// The closest year with data, searching from `year` toward `towards` (used when a year is missing).
function nearestYearWithData(country, metric, year, towards, data) {
  const step = towards >= year ? 1 : -1;
  for (let y = year; step > 0 ? y <= towards : y >= towards; y += step) {
    if (metricValue(country, metric, y, data) != null) return y;
  }
  return null;
}

// Summary numbers for one country across [from, to].
function summarize(country, from, to, data) {
  const startYear = nearestYearWithData(country, 'gdp', from, to, data);
  const endYear = nearestYearWithData(country, 'gdp', to, from, data);
  if (startYear == null || endYear == null) return null;

  const startGdp = metricValue(country, 'gdp', startYear, data);
  const endGdp = metricValue(country, 'gdp', endYear, data);
  return {
    startYear,
    endYear,
    gdp: endGdp,
    gdppc: metricValue(country, 'gdppc', endYear, data),
    share: metricValue(country, 'share', endYear, data),
    cagr: endYear > startYear ? cagr(startGdp, endGdp, endYear - startYear) : null,
    multiple: startGdp ? endGdp / startGdp : null,
  };
}

// Countries ranked by a metric in one year, biggest first. Countries with no data are left out.
function rankCountries(data, metric, year, region = 'All') {
  return data.countries
    .filter((c) => region === 'All' || c.region === region)
    .map((c) => ({ country: c, value: metricValue(c, metric, year, data) }))
    .filter((row) => row.value != null)
    .sort((a, b) => b.value - a.value)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

// ---------- Formatting ----------

// 27360935000000 -> '$27.36T'
function formatMoney(value, { compact = true, trim = false } = {}) {
  if (value == null || Number.isNaN(value)) return '–';
  const sign = value < 0 ? '-' : '';
  const n = Math.abs(value);
  if (!compact || n < 1e5) return `${sign}$${Math.round(n).toLocaleString('en-US')}`;
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const x = n / size;
      const digits = suffix === 'T' ? 2 : x >= 100 ? 0 : x >= 10 ? 1 : 2;
      const text = x.toFixed(digits);
      return `${sign}$${trim ? String(Number(text)) : text}${suffix}`; // trim: '30.00' -> '30' for axis labels
    }
  }
  return `${sign}$${n.toFixed(0)}`;
}

function formatPercent(value, { signed = false, digits = 1 } = {}) {
  if (value == null || Number.isNaN(value)) return '–';
  const s = value.toFixed(digits);
  return `${signed && value > 0 ? '+' : ''}${s}%`;
}

function formatMetric(value, metric, options = {}) {
  return METRICS[metric].format === 'money'
    ? formatMoney(value, options)
    : formatPercent(value, { signed: metric === 'growth', ...options });
}

// ---------- Axis ticks ----------

// Round, evenly spaced tick values covering [min, max], e.g. 0, 5, 10, 15, 20.
function niceTicks(min, max, count = 5) {
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / count;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

// Powers of ten for a log scale, e.g. 1e9, 1e10, 1e11 ...
function logTicks(min, max) {
  const ticks = [];
  for (let p = Math.floor(Math.log10(min)); p <= Math.ceil(Math.log10(max)); p++) ticks.push(Math.pow(10, p));
  return ticks;
}

if (typeof module !== 'undefined') {
  module.exports = {
    METRICS, metricValue, series, cagr, nearestYearWithData, summarize, rankCountries,
    formatMoney, formatPercent, formatMetric, niceTicks, logTicks,
  };
}
