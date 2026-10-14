# GDP Analyzer

An interactive web app for comparing the size and growth of 212 economies from 1960 to 2023, using World Bank data.

Built with plain HTML, CSS and JavaScript. The line chart is drawn by hand with SVG, with no chart library.

## What you can do
- **Compare up to 5 countries** on one chart, across four measures:
  - GDP (current US$)
  - GDP per person
  - Annual change in GDP
  - Share of world GDP
- **Pick any range of years**, and switch to a **log scale** to compare economies of very different sizes
- **Hover the chart** to read exact values for every country in a given year
- **Comparison table** with GDP, GDP per person, share of world GDP, average yearly growth (CAGR) and total growth over the chosen years
- **Rankings for any year**: drag the year slider or press play to watch countries move up and down. Filter by region and see each country's rank change since the year before. Click a country in the rankings to add it to the chart.
- **Shareable links**: the URL keeps your countries, measure and years, so a copied link opens the same view
- Works on phones and desktops, in light and dark mode

## Run it
Double-click `index.html`. No install needed. (The Archivo font loads from Google Fonts when you're online.)

Run the tests:
```
node tests/analysis.test.js
```

## Data
| File | Source |
|---|---|
| `data/raw/gdp_current_usd.csv` | World Bank, GDP (current US$), indicator NY.GDP.MKTP.CD, via [datasets/gdp](https://github.com/datasets/gdp) |
| `data/raw/population.csv` | World Bank, total population, via [datasets/population](https://github.com/datasets/population) |
| `data/raw/country_codes.csv` | ISO country codes and UN regions, via [datasets/country-codes](https://github.com/datasets/country-codes) |

`data/build_data.py` (Python + pandas) cleans these files and writes `js/data.js`:
- removes World Bank groups such as "Euro area" and "High income", keeping only countries with a UN region
- keeps the World total for the "share of world" calculation
- converts the long tables (one row per country per year) into one row per country
- shortens official names for the chart legend ("Republic of Korea" becomes "South Korea")
- stores GDP in millions of dollars to keep the file small (about 210 KB)

To rebuild it: `cd data && python3 build_data.py`

## How the numbers are calculated
- **GDP per person** = GDP ÷ population
- **Annual change** = GDP this year ÷ GDP last year − 1
- **Share of world GDP** = country GDP ÷ World GDP
- **Average growth per year (CAGR)** = (end GDP ÷ start GDP)^(1 ÷ years) − 1. If a country has no data for the first or last year chosen, the nearest year with data is used and noted in the table.

All values are in **current US dollars**, which are not adjusted for inflation. "Annual change" therefore includes price changes and exchange-rate moves as well as real growth. For example, a country whose currency falls against the dollar can show a drop even if its economy grew.

## Files
| File | What it does |
|---|---|
| `index.html` | Page structure |
| `css/styles.css` | Layout, colors, light and dark mode |
| `js/data.js` | The cleaned dataset (generated) |
| `js/analysis.js` | Calculations and number formatting, no page code |
| `js/chart.js` | The SVG line chart: scales, axes, lines, hover tooltip |
| `js/app.js` | State, rendering, controls, shareable links, play button |
| `tests/analysis.test.js` | Tests for the calculations |
| `data/build_data.py` | Data cleaning script |

## Ideas for later
- Inflation-adjusted (real) GDP and purchasing power parity (PPP) comparisons
- Export the current comparison as CSV
- A map view colored by the selected measure
