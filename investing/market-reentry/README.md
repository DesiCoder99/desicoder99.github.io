# Market Re-entry Lab

Open `investing/market_reentry.html` from a static server. The site uses its existing Netlify deployment for daily price lookup (the new `reentry-prices` function); the rolling-prices endpoint is unchanged. GitHub Pages requests use the same fixed Netlify origin as rolling returns. The new function must be deployed before live ticker lookup works. CSV import and deterministic synthetic demo do not need a backend.

## Data and execution

Yahoo Finance adjusted close / close scales the supplied OHLC series. Reported volume is preserved; vendor split conventions may affect VZO. Missing adjusted prices are not silently substituted; invalid rows are reported. Current exchange-local session excluded. The API requests pre-range history for indicator warm-up. CSV uses Date, Open, High, Low, Close, Volume and optionally Adj Close. Use consistently adjusted data for total-return comparisons. Trading signals use completed daily/weekly bars, fills at the next available daily open. Fractional shares, configurable cash yield and transaction costs; no forced final liquidation. No taxes or liquidity modeling. Cash periods and warnings can be affected by incomplete input history.

Entry criteria are configurable interpretations (VZO recovery, optional prior capitulation, rebound, MACD, price above EMA/SMA); exit rules are research assumptions. Compare to buy-and-hold, weekly EMA/SMA, 200-day SMA, 10-month SMA. No claim of predictive validity. Historical source rights and production availability must be confirmed before public redistribution. No credentials in client code.

## Tests

`node tests/market-reentry-engine.test.cjs`

`node --test tests/reentry-prices.test.mjs`

Live API calls and GitHub Pages/Netlify integration should be verified after deployment.
