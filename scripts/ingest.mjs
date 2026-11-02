import fs from 'node:fs/promises';
import { parseFeed } from './lib.mjs';

const sources = JSON.parse(await fs.readFile(new URL('../data/sources.json', import.meta.url), 'utf8'));
const inboxFile = new URL('../data/inbox.json', import.meta.url);
let inbox = [];
try { inbox = JSON.parse(await fs.readFile(inboxFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const existing = new Set(inbox.map(item => item.id));
let added = 0; let failures = 0;
for (const source of sources.filter(x => x.enabled && x.feed)) {
  try {
    const res = await fetch(source.feed, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'FilipinoMediaBulletinResearch/0.1 (+https://github.com/masinlocandher-max/FilipinoMediaBulletin)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    if (xml.length > 2_000_000) throw new Error('Feed exceeds 2MB safety limit');
    const items = parseFeed(xml, source);
    for (const item of items) if (!existing.has(item.id)) {
      inbox.push({ ...item, discovered_at: new Date().toISOString(), status: 'discovered' });
      existing.add(item.id); added++;
    }
    console.log(`${source.name}: ${items.length} valid entries`);
  } catch (error) { failures++; console.error(`${source.name}: ${error.message}`); }
}
inbox.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
// Metadata only; no article text, images, or third-party prose is copied.
await fs.writeFile(inboxFile, JSON.stringify(inbox.slice(0, 1500), null, 2) + '\n');
console.log(`${added} new discovery items; ${failures} feeds failed. Editorial approval is always separate.`);
if (failures) process.exitCode = 1;
