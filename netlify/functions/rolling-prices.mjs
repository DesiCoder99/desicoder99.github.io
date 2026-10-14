// Shared fixed-upstream endpoint for the Netlify and GitHub Pages sites.
const DAY = 86400000;
const ALLOWED_ORIGINS = new Set([
  'https://desicoder99.github.io',
  'https://voidstar99.netlify.app',
]);
function jsonReply(body, status = 200, corsHeaders = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': status === 200 ? 'public, max-age=300, s-maxage=3600' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
    ...corsHeaders,
  } });
}
function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function createHandler(fetchPrices = fetch) {
  return async request => {
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonReply({ error: 'This origin is not allowed.' }, 403);
    }
    const corsHeaders = origin ? { 'Access-Control-Allow-Origin': origin } : {};
    const reply = (body, status = 200) => jsonReply(body, status, corsHeaders);
    if (request.method === 'OPTIONS') {
      const method = request.headers.get('Access-Control-Request-Method');
      if (method && method !== 'GET') return reply({ error: 'Only GET requests are supported.' }, 405);
      return new Response(null, { status: 204, headers: {
        ...corsHeaders, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store',
      } });
    }
    if (request.method !== 'GET') return reply({ error: 'Use GET to request price history.' }, 405);
    const params = new URL(request.url).searchParams;
    const ticker = (params.get('ticker') || '').trim().toUpperCase();
    const start = dateValue(params.get('start'));
    const end = dateValue(params.get('end'));
    if (!/^[A-Z0-9^][A-Z0-9.^=\-]{0,24}$/.test(ticker)) {
      return reply({ error: 'Enter a valid ticker, such as SPY, BRK-B, or ^GSPC.' }, 400);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > Date.now() + DAY) {
      return reply({ error: 'Enter a valid start and end date, with the start before the end.' }, 400);
    }
    const upstream = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
    upstream.search = new URLSearchParams({
      period1: String(start / 1000), period2: String(end / 1000), interval: '1wk', includeAdjustedClose: 'true',
    }).toString();
    try {
      const response = await fetchPrices(upstream, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 404) return reply({ error: `No price history found for ${ticker}. Check the ticker.` }, 404);
      if (response.status === 429) return reply({ error: 'Yahoo Finance is rate-limiting price requests. Please try again later.' }, 503);
      if (!response.ok) return reply({ error: 'Yahoo Finance is temporarily unavailable. Please try again later.' }, 502);
      const data = await response.json();
      if (data.chart?.error || !data.chart?.result?.[0]) return reply({ error: `No price history found for ${ticker}. Check the ticker and dates.` }, 404);
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const adjusted = result.indicators?.adjclose?.[0]?.adjclose;
      // Never silently label unadjusted prices as dividend-adjusted total returns.
      if (!Array.isArray(timestamps) || !Array.isArray(adjusted)) {
        return reply({ error: `Adjusted price history is unavailable for ${ticker}; total returns cannot be calculated.` }, 422);
      }
      const prices = timestamps.flatMap((timestamp, i) => {
        const close = adjusted[i];
        if (!Number.isFinite(timestamp) || !Number.isFinite(close) || close <= 0) return [];
        const date = new Date(timestamp * 1000);
        if (!Number.isFinite(date.getTime())) return [];
        return [{ date: date.toISOString().slice(0, 10), close }];
      }).sort((a, b) => a.date.localeCompare(b.date));
      if (!prices.length) return reply({ error: `No usable adjusted prices found for ${ticker} in this date range.` }, 404);
      return reply({ ticker, prices });
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return reply({ error: 'The price request timed out. Please try again.' }, 504);
      }
      return reply({ error: 'Unable to load price history right now. Please try again later.' }, 502);
    }
  };
}
export default createHandler();
