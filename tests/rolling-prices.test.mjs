import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/rolling-prices.mjs';
const request = (params = 'ticker=SPY&start=2000-01-01&end=2026-01-01') => new Request(`https://example.test/.netlify/functions/rolling-prices?${params}`);
const chart = indicators => ({ chart: { result: [{ timestamp: [946684800, 947289600, 947894400], indicators }], error: null } });
test('requests only Yahoo; returns adjusted prices and drops missing/nonpositive values', async () => {
  let called;
  const handler = createHandler(async url => { called = url; return Response.json(chart({ adjclose: [{ adjclose: [100, null, -2] }], quote: [{ close: [200, 201, 202] }] })); });
  const result = await handler(request('ticker=%5EGSPC&start=2000-01-01&end=2026-01-01'));
  assert.equal(result.status, 200);
  assert.equal(called.hostname, 'query1.finance.yahoo.com');
  assert.equal(called.searchParams.get('interval'), '1wk');
  assert.deepEqual((await result.json()).prices, [{ date: '2000-01-01', close: 100 }]);
  assert.match(result.headers.get('cache-control'), /max-age=300/);
});
test('invalid symbols, invalid calendar dates, reversed dates and wrong methods never reach upstream', async () => {
  const handler = createHandler(() => { throw Error('Should not fetch'); });
  for (const query of ['ticker=https://bad.test&start=2000-01-01&end=2026-01-01', 'ticker=SPY&start=2025-02-30&end=2026-01-01', 'ticker=SPY&start=2026-01-01&end=2000-01-01', 'ticker=SPY']) assert.equal((await handler(request(query))).status, 400);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST' }))).status, 405);
});
test('never substitutes raw closes for adjusted total returns', async () => {
  const result = await createHandler(async () => Response.json(chart({ quote: [{ close: [100, 101, 102] }] })))(request());
  assert.equal(result.status, 422);
  assert.match((await result.json()).error, /Adjusted/);
});
test('handles missing ticker, throttling, upstream failures, malformed JSON and timeouts', async () => {
  for (const [status, expected] of [[404, 404], [429, 503], [403, 502], [500, 502]]) {
    const result = await createHandler(async () => new Response('', { status }))(request());
    assert.equal(result.status, expected);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await createHandler(async () => new Response('not json'))(request())).status, 502);
  assert.equal((await createHandler(async () => { throw new DOMException('timeout', 'TimeoutError'); })(request())).status, 504);
  assert.equal((await createHandler(async () => Response.json({ chart: { result: null, error: {} } }))(request())).status, 404);
});

test('both site origins receive CORS headers on success and errors; caches vary by origin', async () => {
  for (const origin of ['https://desicoder99.github.io', 'https://voidstar99.netlify.app']) {
    for (const status of [200, 429]) {
      const handler = createHandler(async () => status === 200
        ? Response.json(chart({ adjclose: [{ adjclose: [100, 101, 102] }] }))
        : new Response('', { status }));
      const response = await handler(new Request(request(), { headers: { Origin: origin } }));
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('vary'), 'Origin');
      assert.equal(response.headers.get('access-control-allow-credentials'), null);
      assert.equal(response.status, status === 200 ? 200 : 503);
    }
  }
});
test('preflight succeeds for GET and other origins are rejected before upstream fetch', async () => {
  const handler = createHandler(() => { throw Error('Must not fetch upstream'); });
  const allowed = await handler(new Request(request(), { method: 'OPTIONS', headers: {
    Origin: 'https://desicoder99.github.io', 'Access-Control-Request-Method': 'GET',
  } }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  for (const origin of ['https://evil.example', 'https://desicoder99.github.io.evil.example', 'null']) {
    const blocked = await handler(new Request(request(), { headers: { Origin: origin } }));
    assert.equal(blocked.status, 403);
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  }
});
