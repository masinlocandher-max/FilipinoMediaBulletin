import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml as h, isCurrent, isHttps, validateBulletin, formatPHT, SECTIONS } from './lib.mjs';
import { renderHome, renderLayout } from './editorial.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const bulletins = JSON.parse(await fs.readFile(path.join(root, 'data/bulletins.json'), 'utf8'));
const sources = JSON.parse(await fs.readFile(path.join(root, 'data/sources.json'), 'utf8'));
const launch = process.env.FMB_LAUNCH === 'true';
const siteUrl = (process.env.FMB_SITE_URL || '').trim().replace(/\/$/, '');
if (siteUrl && !isHttps(siteUrl)) throw new Error('FMB_SITE_URL must be an HTTPS URL');
if (launch && !siteUrl) throw new Error('Launching requires FMB_SITE_URL so absolute sitemap/canonical links are accurate');
const site = siteUrl ? new URL(siteUrl) : null;
const base = site?.pathname.replace(/\/$/, '') || '';
const link = route => `${base}${route}`;
const absolute = route => siteUrl ? `${siteUrl}${route}` : route;
const now = Date.now();

for (const item of bulletins) {
  const errors = validateBulletin(item, { forPublication: true });
  if (errors.length) throw new Error(`Invalid published bulletin ${item.id}: ${errors.join('; ')}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) throw new Error(`Invalid slug: ${item.id}`);
  if (!['published', 'retracted'].includes(item.status)) throw new Error(`Invalid publication status: ${item.id}`);
  if (!Number.isFinite(Date.parse(item.published_at)) || !Number.isFinite(Date.parse(item.updated_at))) throw new Error(`Invalid timestamps: ${item.id}`);
}
const ids = bulletins.map(x => x.id);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate published bulletin IDs');
const published = bulletins.filter(x => x.status === 'published').sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
const recent = published.filter(x => isCurrent(x.published_at, now));
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
await fs.copyFile(path.join(root, 'site/styles.css'), path.join(out, 'styles.css'));
await fs.copyFile(path.join(root, 'site/client.js'), path.join(out, 'client.js'));
await fs.copyFile(path.join(root, 'site/editorial.css'), path.join(out, 'editorial.css'));

function layout(props) { return renderLayout({...props,link,h,absolute,launch,now,formatPHT}); }
function articleCard(item, { lead = false } = {}) {
  const url = link(`/stories/${item.id}/`);
  return `<article class="story ${lead ? 'story-lead' : ''}" data-published="${h(item.published_at)}" data-section="${h(item.section)}"><div class="story-top"><span class="story-topic">${h(item.category || (item.section === 'world' ? 'World' : 'Philippines'))}</span><time datetime="${h(item.published_at)}">${h(formatPHT(item.published_at))}</time></div><h3><a href="${h(url)}">${h(item.headline)}</a></h3><p class="story-summary">${h(item.summary)}</p><p class="story-impact"><strong>WHY IT MATTERS</strong> ${h(item.why_it_matters)}</p><a class="text-link" href="${h(url)}">Read the bulletin <span aria-hidden="true">↗</span></a></article>`;
}
function emptyState(isLaunch) { return `<div class="empty-state"><div class="empty-number" aria-hidden="true">01<span>.</span></div><span class="eyebrow">FIRST EDITION</span><h3>${isLaunch ? 'No approved bulletins in the last 24 hours.' : 'Our first edition is being prepared.'}</h3><p>${isLaunch ? 'We publish when information is verified and useful—not to fill a quota. Explore earlier reporting in the archive.' : 'Filipino Media Bulletin will begin publishing after editorial verification and final launch checks. We will not manufacture news or publish placeholder stories.'}</p><a class="text-link" href="${h(link('/standards/'))}">Read our editorial standards <span aria-hidden="true">↗</span></a></div>`; }
const currentPhilippines = recent.filter(x => x.section === 'philippines');
const currentWorld = recent.filter(x => x.section === 'world');
const home = renderHome({currentPhilippines,currentWorld,link,h,launch,now});
async function write(route, html) {
  const dir = path.join(out, route);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), html);
}
await write('', layout({ title:'Filipino Media Bulletin | Know what matters', description:'The Philippines and the world, without the noise. Verified, editor-approved news bulletins explained for Filipinos.', body:home }));

const archiveItems = bulletins.filter(x=>['published','retracted'].includes(x.status)).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
const archiveBody = `<div class="shell subpage"><div class="eyebrow">THE BULLETIN / THE RECORD</div><h1>The archive<span class="heading-point">.</span></h1><p class="subpage-deck">A searchable record of published bulletins, updates and retractions. Stories do not disappear just because they are no longer new.</p><div class="search-area"><label for="archive-search">Search published bulletins</label><input id="archive-search" type="search" placeholder="Search a headline, topic or summary…" autocomplete="off"><p id="search-count" aria-live="polite"></p></div><div id="archive-results">${archiveItems.length ? archiveItems.map(x=>`<div class="archive-entry" data-search="${h(`${x.headline} ${x.summary} ${x.section} ${x.category || ''}`.toLowerCase())}"><span class="archive-meta">${h(x.section.toUpperCase())} / ${h(formatPHT(x.published_at))}${x.status === 'retracted' ? ' / RETRACTED' : ''}</span><h2><a href="${h(link(`/stories/${x.id}/`))}">${h(x.headline)}</a></h2><p>${h(x.status === 'retracted' ? x.retraction_note : x.summary)}</p></div>`).join('') : '<p class="no-results">No published bulletins yet. The archive will grow with verified editorial releases.</p>'}</div></div>`;
await write('archive', layout({title:'Archive | Filipino Media Bulletin',description:'Search Filipino Media Bulletin’s dated and attributable bulletin archive.',active:'/archive/',canonical:'/archive/',body:archiveBody}));
for (const item of archiveItems) {
  const articleUrl = `/stories/${item.id}/`;
  const retract = item.status === 'retracted';
  const sourcesHtml = item.sources.map((source,i) => `<li><span>${String(i+1).padStart(2,'0')}</span><a rel="noopener noreferrer" target="_blank" href="${h(source.url)}">${h(source.name)} <span aria-hidden="true">↗</span></a></li>`).join('');
  const body = `<article class="shell article-page"><div class="article-back"><a href="${h(link('/'))}">← Back to bulletin</a></div><div class="eyebrow">${h(item.section.toUpperCase())} / ${h(item.category || 'GENERAL')}</div><h1>${h(item.headline)}</h1><p class="article-deck">${h(item.summary)}</p><div class="article-meta"><span>By ${h(item.byline || 'Filipino Media Bulletin Editorial')}</span><span>Published <time datetime="${h(item.published_at)}">${h(formatPHT(item.published_at))}</time></span><span>Updated <time datetime="${h(item.updated_at)}">${h(formatPHT(item.updated_at))}</time></span></div>${retract ? `<div class="editorial-notice" role="alert"><strong>RETRACTED</strong><p>${h(item.retraction_note)}</p></div>` : `<div class="article-body"><section><h2>What happened</h2><p>${h(item.summary)}</p></section><section class="article-why"><h2>Why it matters</h2><p>${h(item.why_it_matters)}</p></section><section><h2>What to watch</h2><p>${h(item.what_to_watch)}</p></section></div>`}${item.correction_note ? `<div class="editorial-notice"><strong>Correction · ${h(formatPHT(item.updated_at))}</strong><p>${h(item.correction_note)}</p></div>` : ''}<section class="source-list"><div class="eyebrow">SOURCE TRANSPARENCY</div><h2>Check the sources.</h2><p>These references informed our editorial review. Source links are not an endorsement of every claim a source makes.</p><ol>${sourcesHtml}</ol></section><div class="article-end"><a href="${h(link('/archive/'))}">← Browse the archive</a><a href="${h(link('/standards/'))}">Our standards ↗</a></div></article>`;
  const jsonLd = retract ? null : {'@context':'https://schema.org','@type':'NewsArticle',headline:item.headline,description:item.summary,datePublished:item.published_at,dateModified:item.updated_at,author:{'@type':'Organization',name:item.byline || 'Filipino Media Bulletin'},publisher:{'@type':'Organization',name:'Filipino Media Bulletin'},mainEntityOfPage: siteUrl ? absolute(articleUrl) : undefined};
  await write(`stories/${item.id}`, layout({title:`${item.headline} | Filipino Media Bulletin`,description:item.summary,canonical:articleUrl,body,jsonLd,noIndex:retract}));
}
const sourceBody = `<div class="shell subpage"><div class="eyebrow">SOURCING / TRANSPARENCY</div><h1>Where we look<span class="heading-point">.</span></h1><p class="subpage-deck">Our newsroom monitors official releases and independent reporting. Discovery is not verification; we check material facts before publication.</p><div class="source-directory">${sources.map(source=>`<div class="directory-row"><div><span class="directory-type">${h(source.type.replaceAll('-', ' '))}</span><h2>${h(source.name)}</h2><p>${h(source.rights)}</p></div><a href="${h(source.url)}" target="_blank" rel="noopener noreferrer">Visit source ↗</a></div>`).join('')}</div><p class="small-note">The directory is a research inventory, not a claim that every source is integrated, licensed, monitored continuously or equally reliable. Integration status is maintained in the source registry.</p></div>`;
await write('sources', layout({title:'Our sources | Filipino Media Bulletin',description:'The newsroom research directory and standards for source verification.',active:'/sources/',canonical:'/sources/',body:sourceBody}));
const standardsBody = `<div class="shell subpage"><div class="eyebrow">OUR APPROACH</div><h1>Clarity is a responsibility<span class="heading-point">.</span></h1><p class="subpage-deck">We select news for public significance and usefulness—not volume, outrage or the demands of advertisers.</p><div class="principle-grid"><section><span>01 / THE FACTS</span><h2>Verify before publishing.</h2><p>Stories require attributable evidence and human editorial review. Contradictions and unresolved claims are disclosed, never disguised as certainty.</p></section><section><span>02 / THE CONTEXT</span><h2>Explain without exaggeration.</h2><p>We separate what happened from what might happen. Not every global event has a demonstrable direct impact on Filipinos.</p></section><section><span>03 / THE INDEPENDENCE</span><h2>No purchased headlines.</h2><p>Advertisements and sponsorships must be labeled. Clients, sponsors and business relationships receive no special editorial treatment.</p></section><section><span>04 / THE RECORD</span><h2>Correct openly.</h2><p>Substantive corrections carry an explanation and preserved revision history. Retractions remain accessible with the reason displayed.</p></section></div><div class="principle-contact"><h2>Spot an error?</h2><p>While our dedicated newsroom contact system is not yet configured, submit a correction report through the project repository. A GitHub account is required for that interim method.</p><a class="text-link" href="https://github.com/masinlocandher-max/FilipinoMediaBulletin/issues/new" target="_blank" rel="noopener noreferrer">Submit a correction report ↗</a></div></div>`;
await write('standards', layout({title:'Editorial standards | Filipino Media Bulletin',description:'Filipino Media Bulletin sourcing, corrections, editorial independence and verification principles.',active:'/standards/',canonical:'/standards/',body:standardsBody}));
const privacyBody = `<div class="shell subpage"><div class="eyebrow">READER INFORMATION</div><h1>Privacy<span class="heading-point">.</span></h1><p class="subpage-deck">This initial Filipino Media Bulletin website is designed for reading without creating an account.</p><div class="prose-block"><h2>What this code does</h2><p>The site does not currently install analytics trackers, advertising pixels, cookies or visitor accounts. The archive search operates locally in your browser.</p><h2>Hosting and third-party websites</h2><p>Whichever hosting provider is configured may collect standard access logs. Following links to original news sources takes you to their separate websites and privacy practices.</p><h2>Before commercial launch</h2><p>A complete privacy notice must be updated after the hosting provider, contact method, analytics and any newsletter processor have actually been selected and verified.</p></div></div>`;
await write('privacy',layout({title:'Privacy | Filipino Media Bulletin',description:'Privacy information for the Filipino Media Bulletin website.',canonical:'/privacy/',body:privacyBody}));

await fs.writeFile(path.join(out,'robots.txt'), launch ? `User-agent: *\nAllow: /\nSitemap: ${absolute('/sitemap.xml')}\n` : 'User-agent: *\nDisallow: /\n');
if (launch) {
  const allUrls = ['/', '/archive/', '/sources/', '/standards/', '/privacy/', ...archiveItems.map(x=>`/stories/${x.id}/`)];
  await fs.writeFile(path.join(out,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allUrls.map(x=>`<url><loc>${h(absolute(x))}</loc></url>`).join('')}</urlset>`);
  const fresh = published.filter(x=> now-Date.parse(x.published_at)<48*60*60*1000 && Date.parse(x.published_at)<=now);
  if (fresh.length) await fs.writeFile(path.join(out,'news-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${fresh.map(x=>`<url><loc>${h(absolute(`/stories/${x.id}/`))}</loc><news:news><news:publication><news:name>Filipino Media Bulletin</news:name><news:language>en</news:language></news:publication><news:publication_date>${h(x.published_at)}</news:publication_date><news:title>${h(x.headline)}</news:title></news:news></url>`).join('')}</urlset>`);
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Filipino Media Bulletin</title><link>${h(absolute('/'))}</link><description>News that matters to Filipinos, clearly explained.</description><language>en-PH</language>${published.slice(0,30).map(x=>`<item><title>${h(x.headline)}</title><link>${h(absolute(`/stories/${x.id}/`))}</link><guid isPermaLink="true">${h(absolute(`/stories/${x.id}/`))}</guid><pubDate>${new Date(x.published_at).toUTCString()}</pubDate><description>${h(x.summary)}</description></item>`).join('')}</channel></rss>`;
  await fs.writeFile(path.join(out,'feed.xml'),rss);
}
console.log(`Built ${archiveItems.length} bulletin pages, ${recent.length} current bulletins. Launch indexing: ${launch ? 'enabled' : 'disabled'}. Output: ${out}`);
