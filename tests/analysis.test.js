// Run with:  node tests/analysis.test.js
const assert = require('assert');
const {
  metricValue, cagr, summarize, rankCountries, formatMoney, formatPercent, niceTicks, logTicks,
} = require('../js/analysis.js');

// A tiny made-up dataset so the expected answers are easy to check by hand.
// GDP is in millions of US$, like the real data file.
const data = {
  firstYear: 2000,
  lastYear: 2003,
  world: [1000, 1100, 1200, 1300],
  countries: [
    { code: 'AAA', name: 'Alpha', region: 'Europe', gdp: [100, 110, null, 121], pop: [10, 10, 10, 11] },
    { code: 'BBB', name: 'Beta', region: 'Asia', gdp: [200, 180, 190, 200], pop: [100, 100, 100, 100] },
    { code: 'CCC', name: 'Gamma', region: 'Asia', gdp: [null, null, 50, 60], pop: [5, 5, 5, 5] },
  ],
};
const [alpha, beta, gamma] = data.countries;
const close = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} != ${expected}`);

const tests = {
  'GDP is converted from millions to dollars': () => {
    assert.strictEqual(metricValue(alpha, 'gdp', 2000, data), 100e6);
  },
  'GDP per person divides by population': () => {
    assert.strictEqual(metricValue(alpha, 'gdppc', 2003, data), 121e6 / 11);
  },
  'annual change compares with the year before': () => {
    close(metricValue(alpha, 'growth', 2001, data), 10, 'growth 2001');
    close(metricValue(beta, 'growth', 2001, data), -10, 'negative growth');
  },
  'annual change is missing when either year is missing': () => {
    assert.strictEqual(metricValue(alpha, 'growth', 2000, data), null); // no year before
    assert.strictEqual(metricValue(alpha, 'growth', 2003, data), null); // 2002 missing
  },
  'share of world GDP': () => {
    close(metricValue(beta, 'share', 2000, data), 20, 'share');
  },
  'CAGR: 100 -> 121 over 2 years is 10% a year': () => {
    close(cagr(100, 121, 2), 10, 'cagr');
    assert.strictEqual(cagr(0, 100, 5), null);
    assert.strictEqual(cagr(100, 200, 0), null);
  },
  'summary skips missing years at the edges of the range': () => {
    const s = summarize(gamma, 2000, 2003, data);
    assert.strictEqual(s.startYear, 2002); // first year with data
    assert.strictEqual(s.endYear, 2003);
    close(s.cagr, 20, 'cagr');
    close(s.multiple, 1.2, 'multiple');
  },
  'ranking: biggest first, missing data left out, region filter works': () => {
    assert.deepStrictEqual(rankCountries(data, 'gdp', 2000).map((r) => r.country.code), ['BBB', 'AAA']);
    assert.deepStrictEqual(rankCountries(data, 'gdp', 2003, 'Asia').map((r) => [r.country.code, r.rank]), [['BBB', 1], ['CCC', 2]]);
  },
  'money formatting': () => {
    assert.strictEqual(formatMoney(27360935e6), '$27.36T');
    assert.strictEqual(formatMoney(412.3e9), '$412B');
    assert.strictEqual(formatMoney(85000), '$85,000');
    assert.strictEqual(formatMoney(81695.2, { compact: false }), '$81,695');
    assert.strictEqual(formatMoney(null), '–');
    assert.strictEqual(formatMoney(30e12, { trim: true }), '$30T');
    assert.strictEqual(formatMoney(2.5e12, { trim: true }), '$2.5T');
  },
  'percent formatting': () => {
    assert.strictEqual(formatPercent(3.456), '3.5%');
    assert.strictEqual(formatPercent(3.456, { signed: true }), '+3.5%');
    assert.strictEqual(formatPercent(-2, { signed: true }), '-2.0%');
  },
  'axis ticks are round numbers that cover the data': () => {
    assert.deepStrictEqual(niceTicks(0, 23, 5), [0, 5, 10, 15, 20, 25]);
    assert.deepStrictEqual(niceTicks(-3.2, 7.9, 5), [-5, 0, 5, 10]);
    assert.deepStrictEqual(niceTicks(0, 0.9, 4), [0, 0.5, 1]);
    assert.deepStrictEqual(logTicks(3e9, 2e12), [1e9, 1e10, 1e11, 1e12, 1e13]);
  },
};

let passed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}\n     ${err.message.split('\n')[0]}`);
  }
}
console.log(`\n${passed}/${Object.keys(tests).length} passing`);
