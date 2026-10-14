import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile(new URL('../investing/rolling.html', import.meta.url), 'utf8');
const source = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
for (const hostname of ['desicoder99.github.io', 'voidstar99.netlify.app', 'localhost']) {
  test(`price endpoint selection for ${hostname}`, async () => {
    let requested;
    const context = vm.createContext({
      location: { hostname }, URLSearchParams, AbortSignal,
      document: { addEventListener() {} },
      fetch: async (url, options) => { requested = { url, options }; return Response.json({ prices: [{ date: '2020-01-01', close: 100 }] }); },
    });
    vm.runInContext(source, context);
    const prices = await vm.runInContext("fetchYahooFinanceData('^GSPC', '2000-01-01', '2026-01-01')", context);
    const prefix = hostname === 'desicoder99.github.io' ? 'https://voidstar99.netlify.app' : '';
    assert(requested.url.startsWith(`${prefix}/.netlify/functions/rolling-prices?`));
    assert.equal(new URL(requested.url, 'https://example.test').searchParams.get('ticker'), '^GSPC');
    assert.equal(requested.options.credentials, 'omit');
    assert.equal(prices[0].close, 100);
  });
}
