import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('approved identity and responsive layout build under the production subpath',()=>{
 const run=spawnSync(process.execPath,['scripts/build.mjs'],{
  cwd:root, encoding:'utf8',
  env:{...process.env,FMB_SITE_URL:'https://francinemariebautista.com/filipinomediabulletin',FMB_LAUNCH:'false'}
 });
 assert.equal(run.status,0,run.stderr);
 const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'dist/editorial.css'),'utf8');
 assert.match(html,/<span class="publication-name">Filipino Media Bulletin/);
 assert.doesNotMatch(html,/>FMB</);
 assert.match(html,/Know what matters/);
 assert.match(html,/id="philippines"/);
 assert.match(html,/id="world"/);
 assert.match(html,/class="bulletin-glass"/);
 assert.match(html,/class="why-panel"/);
 assert.match(html,/href="\/filipinomediabulletin\/editorial.css"/);
 assert.match(html,/noindex, nofollow/);
 assert.match(html,/PRELAUNCH EDITORIAL PREVIEW/);
 assert.match(html,/these images are not evidence|these are coverage themes/i);
 const archive=fs.readFileSync(path.join(root,'dist/archive/index.html'),'utf8');
 const privacy=fs.readFileSync(path.join(root,'dist/privacy/index.html'),'utf8');
 assert.doesNotMatch(archive,/FMB\s*\/\s*THE RECORD|Search FMB/);
 assert.doesNotMatch(privacy,/initial FMB website|for the FMB website/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.doesNotMatch(html,/[\u{1F300}-\u{1FAFF}]/u);
});