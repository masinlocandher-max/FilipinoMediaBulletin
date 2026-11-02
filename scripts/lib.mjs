import { createHash } from 'node:crypto';

export const SECTIONS = ['philippines', 'world'];
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slugify = value => String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 76);
export const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export const isHttps = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; } catch { return false; }
};
export const fingerprint = (sourceId, url) => createHash('sha256').update(`${sourceId}:${url}`).digest('hex').slice(0, 24);
export const isCurrent = (date, now = Date.now()) => {
  const t = Date.parse(date);
  return Number.isFinite(t) && t <= now && now - t < WINDOW_MS;
};
export const formatPHT = date => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(date));

export function validateBulletin(item, { forPublication = false } = {}) {
  const errors = [];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ['Bulletin must be an object'];
  if (!SECTIONS.includes(item.section)) errors.push('section must be philippines or world');
  for (const field of ['headline', 'summary', 'why_it_matters', 'what_to_watch']) {
    if (typeof item[field] !== 'string' || cleanText(item[field]).length < 12) errors.push(`${field} must have at least 12 characters`);
  }
  if (cleanText(item.headline).length > 120) errors.push('headline must be <= 120 characters');
  if (!Array.isArray(item.sources) || item.sources.length === 0) errors.push('At least one attributable source is required');
  else {
    item.sources.forEach((source, i) => {
      if (!cleanText(source?.name)) errors.push(`sources[${i}].name is required`);
      if (!isHttps(source?.url)) errors.push(`sources[${i}].url must be HTTPS`);
    });
  }
  if (!['normal', 'contested', 'high'].includes(item.risk)) errors.push('risk must be normal, contested, or high');
  if (item.risk === 'contested' && new Set((item.sources || []).filter(s => isHttps(s.url)).map(s => new URL(s.url).hostname.replace(/^www\./, ''))).size < 2) errors.push('Contested claims require at least two distinct source domains and human corroboration');
  if (forPublication) {
    if (!cleanText(item.editor)) errors.push('Approving editor required');
    if (!item.evidence_checked) errors.push('Editor must explicitly confirm evidence was checked');
    if (!item.rights_checked) errors.push('Editor must explicitly confirm content and media rights');
    if (item.risk === 'high' && !cleanText(item.senior_editor)) errors.push('High-risk claims require a senior editor');
    if (item.risk === 'high' && cleanText(item.senior_editor).toLowerCase() === cleanText(item.editor).toLowerCase()) errors.push('Senior editor must be different from approving editor');
  }
  return errors;
}

const decodeXml = value => String(value ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (match, numeric, named) => {
  if (numeric) { const n = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()] || match;
}).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function tag(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}
export function parseFeed(xml, source) {
  if (typeof xml !== 'string' || !/<(?:rss|feed|rdf:RDF)\b/i.test(xml.slice(0, 1200))) throw new Error('Unrecognized XML news feed');
  const atom = /<feed\b/i.test(xml.slice(0, 1200));
  const blocks = [...xml.matchAll(atom ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  return blocks.slice(0, 70).map(([, block]) => {
    const atomLink = atom && block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
    const url = atomLink ? decodeXml(atomLink[1]) : tag(block, 'link');
    const published = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    return { id: fingerprint(source.id, url), source_id: source.id, source_name: source.name, title: tag(block, 'title'), url, published_at: Number.isFinite(Date.parse(published)) ? new Date(published).toISOString() : null };
  }).filter(x => x.title && isHttps(x.url));
}
