import test from 'node:test';
import assert from 'node:assert/strict';
import {convertDaily,createHandler} from '../netlify/functions/reentry-prices.mjs';
const now=Date.parse('2024-01-05T17:00:00Z');
const fixture={meta:{exchangeTimezoneName:'America/New_York'},timestamp:['2024-01-02','2024-01-03','2024-01-04','2024-01-05'].map(d=>Date.parse(d+'T15:00:00Z')/1000),indicators:{quote:[{open:[100,110,120,130],high:[110,120,130,140],low:[90,100,110,120],close:[100,110,120,130],volume:[1000,2000,3000,4000]}],adjclose:[{adjclose:[50,55,60,65]}]}};
const url='https://voidstar99.netlify.app/.netlify/functions/reentry-prices?ticker=QQQ&start=2024-01-02&end=2024-01-05';
test('adjust all OHLC, preserve volume, exclude current session',()=>{
 const {bars}=convertDaily(fixture,'2024-01-02','2024-01-05',now);
 assert.equal(bars.length,3);
 assert.deepEqual(bars[0],{date:'2024-01-02',open:50,high:55,low:45,close:50,volume:1000});
 assert.throws(()=>convertDaily({...fixture,indicators:{quote:fixture.indicators.quote}},'2024-01-02','2024-01-05',now));
});
test('inclusive range and fixed upstream daily interval; CORS',async()=>{
 let called=0;
 const handler=createHandler(async upstream=>{called++;assert.equal(upstream.hostname,'query1.finance.yahoo.com');assert.equal(upstream.pathname,'/v8/finance/chart/QQQ');assert.equal(upstream.searchParams.get('interval'),'1d');return Response.json({chart:{result:[fixture]}});},()=>now);
 const r=await handler(new Request(url,{headers:{Origin:'https://desicoder99.github.io'}}));
 assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://desicoder99.github.io');assert.equal((await r.json()).bars.length,3);
 assert.equal((await handler(new Request(url,{headers:{Origin:'https://example.com'}}))).status,403);
 assert.equal((await handler(new Request(url.replace('ticker=QQQ','ticker=%2Fbad')))).status,400);
 assert.equal(called,1);
});
test('rate limiting is surfaced without fabricated data',async()=>{
 const handler=createHandler(async()=>new Response('',{status:429}),()=>now);
 assert.equal((await handler(new Request(url))).status,503);
});
