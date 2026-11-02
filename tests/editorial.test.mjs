import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escapeHtml, isCurrent, parseFeed, validateBulletin } from '../scripts/lib.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function mock() {
  return {
    section: 'philippines', category: 'Test',
    headline: 'Synthetic news headline for controlled test',
    summary: 'This synthetic description exists only inside a test case, not a public news report.',
    why_it_matters: 'Synthetic test text that describes context without making an actual factual claim.',
    what_to_watch: 'Synthetic follow-up condition that is not presented as a real future event.',
    risk: 'normal', sources: [{ name: 'Fixture source', url: 'https://example.com/source' }]
  };
}
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmb-test-'));
  for (const folder of ['data','scripts','site']) fs.cpSync(path.join(sourceRoot,folder), path.join(dir,folder), {recursive:true});
  const exec = (script, args=[], env={}) => spawnSync(process.execPath, [path.join(dir,'scripts',script), ...args], { encoding:'utf8', env: {...process.env,...env}, cwd:dir });
  const file = (name, val) => fs.writeFileSync(path.join(dir,'data',name+'.json'), JSON.stringify(val));
  return {dir,exec,file,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}

test('HTML escapes unsafe strings and rejects non-HTTPS links', () => {
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  const item = mock(); item.sources[0].url = 'javascript:alert(1)';
  assert.match(validateBulletin(item).join(';'), /HTTPS/);
});
test('verification gate requires editor, evidence and rights review', () => {
  const item = mock();
  assert.equal(validateBulletin(item).length, 0);
  assert.match(validateBulletin(item,{forPublication:true}).join(';'), /editor/i);
  item.editor='Editor';item.evidence_checked=true;item.rights_checked=true;
  assert.deepEqual(validateBulletin(item,{forPublication:true}), []);
});
test('contested report cannot pass with one domain; high risk requires senior editor', () => {
  const item = mock(); item.risk='contested';
  item.sources.push({name:'Mirror',url:'https://example.com/another'});
  assert.match(validateBulletin(item).join(';'), /two distinct/);
  item.sources.push({name:'Separate',url:'https://second.example.org/story'});
  assert.equal(validateBulletin(item).length,0);
  item.risk='high';item.editor='Editor';item.evidence_checked=true;item.rights_checked=true;
  assert.match(validateBulletin(item,{forPublication:true}).join(';'), /senior editor/);
});
test('24-hour current window excludes future and older publication dates', () => {
  const now=Date.parse('2026-11-02T09:00:00Z');
  assert.equal(isCurrent('2026-11-01T10:00:00Z',now),true);
  assert.equal(isCurrent('2026-11-01T08:00:00Z',now),false);
  assert.equal(isCurrent('2026-11-02T10:00:00Z',now),false);
});
test('RSS parses headline metadata, strips markup, never copies descriptions', () => {
  const rss='<rss><channel><item><title><![CDATA[An &amp; B]]></title><link>https://example.com/a</link><description>PRIVATE FULL ARTICLE BODY</description><pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>';
  const items=parseFeed(rss,{id:'test',name:'Test'});
  assert.equal(items.length,1);
  assert.equal(items[0].title,'An & B');
  assert.equal(items[0].description,undefined);
});
test('Atom feeds parse absolute links', () => {
  const items=parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Example event</title><link href="https://example.com/entry"/><updated>2026-11-02T03:00:00Z</updated></entry></feed>',{id:'test',name:'Test'});
  assert.equal(items[0].url,'https://example.com/entry');
});
test('build starts with no articles, disables indexing and renders all pages', () => {
  const f=fixture();
  try { const r=f.exec('build.mjs'); assert.equal(r.status,0,r.stderr); assert.match(fs.readFileSync(path.join(f.dir,'dist/index.html'),'utf8'),/first edition is being prepared/i); assert.ok(fs.readFileSync(path.join(f.dir,'dist/robots.txt'),'utf8').includes('Disallow: /')); assert.equal(fs.existsSync(path.join(f.dir,'dist/sitemap.xml')),false); assert.equal(fs.existsSync(path.join(f.dir,'dist/archive/index.html')),true); }
  finally {f.cleanup();}
});
test('approved story builds article, sitemap and RSS, with escaped content', () => {
  const f=fixture();
  try {
    const item={...mock(), id:'verified-test-event',editor:'Test Editor',evidence_checked:true,rights_checked:true, status:'published',revision:1,published_at:'2026-11-02T08:00:00.000Z',updated_at:'2026-11-02T08:00:00.000Z'};
    f.file('bulletins',[item]);
    const r=f.exec('build.mjs',[],{FMB_LAUNCH:'true',FMB_SITE_URL:'https://example.org/fmb'});
    assert.equal(r.status,0,r.stderr);
    const article=fs.readFileSync(path.join(f.dir,'dist/stories/verified-test-event/index.html'),'utf8');
    assert.match(article,/NewsArticle/);
    assert.match(article,/https:\/\/example.org\/fmb\/stories\/verified-test-event\//);
    assert.match(fs.readFileSync(path.join(f.dir,'dist/sitemap.xml'),'utf8'),/verified-test-event/);
    assert.match(fs.readFileSync(path.join(f.dir,'dist/feed.xml'),'utf8'),/verified-test-event/);
  } finally {f.cleanup();}
});
test('editorial CLI prevents no-review publishing, deduplicates and records a correction', () => {
  const f=fixture();
  try {
    const file=path.join(f.dir,'draft.json');fs.writeFileSync(file,JSON.stringify(mock()));
    assert.equal(f.exec('newsroom.mjs',['submit',file]).status,0);
    assert.notEqual(f.exec('newsroom.mjs',['submit',file]).status,0);
    const id='synthetic-news-headline-for-controlled-test';
    assert.notEqual(f.exec('newsroom.mjs',['approve',id,'Editor']).status,0);
    assert.equal(f.exec('newsroom.mjs',['approve',id,'Editor','--evidence-reviewed','--rights-reviewed']).status,0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'data/bulletins.json'))).length,1);
    const correction=path.join(f.dir,'correct.json');fs.writeFileSync(correction,JSON.stringify({...mock(),summary:'Revised synthetic text with explicitly corrected information in a controlled test.'}));
    assert.equal(f.exec('newsroom.mjs',['correct',id,correction,'Editor','Corrected sample verification wording','--evidence-reviewed','--rights-reviewed']).status,0);
    const updated=JSON.parse(fs.readFileSync(path.join(f.dir,'data/bulletins.json')))[0];
    assert.equal(updated.revision,2);assert.equal(updated.correction_note,'Corrected sample verification wording');
    assert.equal(f.exec('newsroom.mjs',['retract',id,'Editor','Synthetic test entry was retracted for a controlled test']).status,0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'data/bulletins.json')))[0].status,'retracted');
  } finally {f.cleanup();}
});
test('high-risk editorial signoff needs two different editors, including corrections', () => {
  const f=fixture();
  try {
    const draft={...mock(),risk:'high'};
    const draftFile=path.join(f.dir,'high.json');fs.writeFileSync(draftFile,JSON.stringify(draft));
    assert.equal(f.exec('newsroom.mjs',['submit',draftFile]).status,0);
    const id='synthetic-news-headline-for-controlled-test';
    const base=['approve',id,'Editor One','--evidence-reviewed','--rights-reviewed','--corroborated'];
    assert.notEqual(f.exec('newsroom.mjs',[...base,'--senior-editor=Editor One']).status,0);
    assert.equal(f.exec('newsroom.mjs',[...base,'--senior-editor=Editor Two']).status,0);
    const correction=path.join(f.dir,'high-correction.json');
    fs.writeFileSync(correction,JSON.stringify({...draft,summary:'A materially corrected synthetic high-risk fixture for this test only.'}));
    const correct=['correct',id,correction,'Editor One','Corrected the high-risk synthetic source details','--evidence-reviewed','--rights-reviewed','--corroborated'];
    assert.notEqual(f.exec('newsroom.mjs',correct).status,0);
    assert.notEqual(f.exec('newsroom.mjs',[...correct,'--senior-editor=Editor One']).status,0);
    assert.equal(f.exec('newsroom.mjs',[...correct,'--senior-editor=Editor Three']).status,0);
  } finally {f.cleanup();}
});
