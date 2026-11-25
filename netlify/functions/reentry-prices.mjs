// Daily OHLCV endpoint for the re-entry lab. Mirrors rolling-prices CORS/cache conventions.
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

// Yahoo returns split-adjusted quote prices and a dividend-adjusted close series.
// Scale all four quote prices by Adj Close / Close; keep provider-reported volume.
export function convertDaily(result, startDate, endDate, now = Date.now()) {
  const ts = result.timestamp, q = result.indicators?.quote?.[0], adj = result.indicators?.adjclose?.[0]?.adjclose;
  if (!Array.isArray(ts) || !q || !Array.isArray(adj) ||
      !['open','high','low','close','volume'].every(k => Array.isArray(q[k]))) {
    throw new Error('Adjusted daily OHLCV is unavailable for this ticker.');
  }
  const tz = result.meta?.exchangeTimezoneName;
  if (!tz) throw new Error('The provider did not identify the exchange time zone.');
  const fmt = new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});
  const day = time => { const p = Object.fromEntries(fmt.formatToParts(new Date(time)).map(x=>[x.type,x.value])); return p.year+'-'+p.month+'-'+p.day; };
  const today = day(now);
  const bars = [], seen = new Set();
  let omitted = 0;
  for (let i=0;i<ts.length;i++) {
    if (!Number.isFinite(ts[i])) { omitted++; continue; }
    const date = day(ts[i]*1000);
    if (date<startDate || date>endDate || date>=today) continue;
    const o=q.open[i], h=q.high[i], l=q.low[i], c=q.close[i], v=q.volume[i], a=adj[i];
    if (![o,h,l,c,v,a].every(Number.isFinite)||Math.min(o,h,l,c,a)<=0||v<0||h<Math.max(o,c,l)||l>Math.min(o,c,h)||seen.has(date)) { omitted++; continue; }
    const f=a/c;
    bars.push({date,open:o*f,high:h*f,low:l*f,close:a,volume:v});
    seen.add(date);
  }
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  if (bars.length<2) throw new Error('Fewer than two usable adjusted daily bars in the requested range.');
  return {bars,warning:omitted ? omitted+' invalid or incomplete provider row(s) omitted; indicator and return calculations may be affected.' : ''};
}
export function createHandler(fetchPrices = fetch, clock = Date.now) {
  return async request => {
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return jsonReply({error:'This origin is not allowed.'},403);
    const corsHeaders = origin ? {'Access-Control-Allow-Origin':origin} : {};
    const reply = (body,status=200) => jsonReply(body,status,corsHeaders);
    if (request.method==='OPTIONS') {
      const method=request.headers.get('Access-Control-Request-Method');
      if(method&&method!=='GET') return reply({error:'Only GET requests are supported.'},405);
      return new Response(null,{status:204,headers:{...corsHeaders,Vary:'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'600','Cache-Control':'no-store'}});
    }
    if (request.method!=='GET') return reply({error:'Use GET to request price history.'},405);
    const params = new URL(request.url).searchParams;
    const ticker = (params.get('ticker')||'').trim().toUpperCase(), startDate=params.get('start'),endDate=params.get('end');
    const start=dateValue(startDate),end=dateValue(endDate),now=clock();
    if(!/^[A-Z0-9^][A-Z0-9.^=\-]{0,24}$/.test(ticker)) return reply({error:'Enter a valid ticker, such as QQQ, SPY or BRK-B.'},400);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end>now+DAY||end-start>50*366*DAY) return reply({error:'Enter valid dates spanning at most 50 years.'},400);
    const upstream=new URL('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker));
    upstream.search=new URLSearchParams({period1:String(Math.max(0,start-DAY)/1000),period2:String((end+2*DAY)/1000),interval:'1d',includeAdjustedClose:'true'}).toString();
    try {
      const response=await fetchPrices(upstream,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
      if(response.status===404) return reply({error:'No price history found for '+ticker+'. Check the ticker.'},404);
      if(response.status===429) return reply({error:'Yahoo Finance is rate-limiting requests. Try again or use CSV.'},503);
      if(!response.ok) return reply({error:'Yahoo Finance is temporarily unavailable. Try CSV import.'},502);
      const data=await response.json(), result=data.chart?.result?.[0];
      if(data.chart?.error||!result) return reply({error:'No price history found for '+ticker+'.'},404);
      let converted;
      try { converted=convertDaily(result,startDate,endDate,now); } catch(e) { return reply({error:e.message},422); }
      return reply({ticker,source:'Yahoo Finance · adjusted OHLC / reported volume',...converted});
    } catch(error) {
      if(error.name==='TimeoutError'||error.name==='AbortError') return reply({error:'Price request timed out. Try again or use CSV.'},504);
      return reply({error:'Unable to load price history. Try again or use CSV.'},502);
    }
  };
}
export default createHandler();
