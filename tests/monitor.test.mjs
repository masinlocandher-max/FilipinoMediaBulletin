import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedUrl, publicFeedUrl, suggestSimilarEvent, pollSources } from '../scripts/monitor.mjs';

const now = new Date('2026-11-02T14:00:00.000Z');
const sample = (name, url, approved = false) => ({
  id: name, name, feed: url, enabled: true,
  automation_approved: approved, access_reviewed_at: approved ? '2026-11-01' : null
});
const rss = (title = 'Philippines bank announces policy change today', url = 'https://publisher.example/story?utm_source=rss') =>
  `<rss><channel><item><title>${title}</title><link>${url.replace('&','&amp;')}</link><pubDate>Mon, 02 Nov 2026 12:00:00 GMT</pubDate><description>FULL COPYRIGHTED ARTICLE MUST NOT BE COPIED</description></item></channel></rss>`;

test('tracking parameters and URL fragments do not create duplicate leads', async () => {
  assert.equal(normalizedUrl('https://EXAMPLE.com/news/?utm_source=home&fbclid=1#top'), 'https://example.com/news');
  const source = sample('news', 'https://publisher.example/feed');
  const first = await pollSources({ sources:[source], now, fetchImpl: async()=>new Response(rss(), {status:200,headers:{etag:'"abc"'}}) });
  assert.equal(first.health.added,1);
  assert.equal(first.inbox[0].description,undefined);
  assert.equal(first.inbox[0].url,'https://publisher.example/story');
  const second = await pollSources({ sources:[source], inbox:first.inbox, feedState:first.feedState, now, fetchImpl:async(url, options)=> {
    assert.equal(options.headers['If-None-Match'], '"abc"');
    return new Response(null, {status:304});
  }});
  assert.equal(second.health.added,0);
  assert.equal(second.health.reports[0].result,'unchanged');
});

test('source HTTP failures do not delete prior leads and produce monitor health', async () => {
  const source = sample('news', 'https://publisher.example/feed');
  const prior = [{id:'old',source_id:'news',url:'https://publisher.example/old',title:'Older item',status:'discovered',discovered_at:'2026-11-01T10:00:00.000Z'}];
  const result = await pollSources({sources:[source],inbox:prior,now,fetchImpl:async()=>new Response('oops',{status:503})});
  assert.equal(result.health.failed,1);
  assert.equal(result.inbox.length,1);
  assert.equal(result.feedState.news.consecutive_failures,1);
  assert.match(result.feedState.news.error,/HTTP 503/);
});

test('scheduled monitor fails closed until source permission review is recorded', async () => {
  await assert.rejects(() => pollSources({sources:[sample('unverified','https://publisher.example/feed')],scheduled:true,now}), /No sources are approved/);
  const source=sample('approved','https://publisher.example/feed',true);
  const result=await pollSources({sources:[source],scheduled:true,now,fetchImpl:async()=>new Response(rss(),{status:200})});
  assert.equal(result.health.eligible_sources,1);
  assert.equal(result.health.added,1);
});

test('similarities are only suggested, never automatically merged or fact checked', async () => {
  const one = {id:'a',source_id:'one',title:'Central bank announces interest rate decision for Philippines today',published_at:now.toISOString()};
  const two = {id:'b',source_id:'two',title:'Central bank announces interest rate decision for Philippines today',published_at:now.toISOString()};
  const suggestion=suggestSimilarEvent(two,[one]);
  assert.equal(suggestion?.candidate_id,'a');
  assert.equal(suggestSimilarEvent(two,[{...one,source_id:'two'}]),null);
});

test('oversized feed is rejected before publication; no source entry becomes a bulletin', async () => {
  const source=sample('news','https://publisher.example/feed');
  const result=await pollSources({sources:[source],now,fetchImpl:async()=>new Response('x'.repeat(300),{status:200,headers:{'content-length':'2000001'}})});
  assert.equal(result.health.failed,1);
  assert.equal(result.inbox.length,0);
  assert.match(result.health.reports[0].error,/2 MB/);
});

test('manual review status survives source monitoring', async () => {
  const source=sample('news','https://publisher.example/feed');
  const prior=[{id:'reviewed',source_id:'news',title:'Lead in review',url:'https://publisher.example/reviewed',status:'researching',discovered_at:now.toISOString()}];
  const result=await pollSources({sources:[source],inbox:prior,now,fetchImpl:async()=>new Response(rss(),{status:200})});
  assert.equal(result.inbox.find(x=>x.id==='reviewed')?.status,'researching');
  assert.equal(result.health.added,1);
});

test('source monitor rejects local/private address feeds', () => {
  assert.equal(publicFeedUrl('https://localhost/feed'),false);
  assert.equal(publicFeedUrl('https://192.168.1.3/rss'),false);
  assert.equal(publicFeedUrl('https://news.example.com/rss'),true);
});
