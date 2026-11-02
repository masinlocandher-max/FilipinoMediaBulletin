import { fingerprint, isHttps, parseFeed, cleanText } from './lib.mjs';

const MAX_FEED_BYTES = 2_000_000;
const MAX_INBOX_ITEMS = 1500;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const REVIEW_MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;
const STOPWORDS = new Set('a an and are at as by for from in into is its of on or the to with after before amid over under about new says said philippines philippine world news update latest'.split(' '));

export function publicFeedUrl(value) {
  if (!isHttps(value)) return false;
  const hostname = new URL(value).hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
  if (hostname === '[::1]' || hostname === '[::]' || hostname.endsWith('.onion')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
  return true;
}

export function normalizedUrl(value) {
  if (!isHttps(value)) return '';
  const url = new URL(value);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function tokens(title) {
  return new Set(cleanText(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ')
    .filter(x => x.length > 2 && !STOPWORDS.has(x)));
}

export function suggestSimilarEvent(candidate, items) {
  const words = tokens(candidate.title);
  if (words.size < 3) return null;
  let best = null;
  let highest = 0;
  for (const item of items.slice(0, 350)) {
    if (item.id === candidate.id || item.source_id === candidate.source_id) continue;
    const age = Math.abs(Date.parse(item.published_at) - Date.parse(candidate.published_at));
    if (!Number.isFinite(age) || age > 3 * 24 * 60 * 60 * 1000) continue;
    const other = tokens(item.title);
    if (other.size < 3) continue;
    const common = [...words].filter(x => other.has(x)).length;
    const score = common / (words.size + other.size - common);
    if (score > highest) { highest = score; best = item.id; }
  }
  return highest >= 0.68 ? { candidate_id: best, title_similarity: Number(highest.toFixed(2)) } : null;
}

async function boundedResponseText(response) {
  const reported = Number(response.headers.get('content-length') || 0);
  if (reported > MAX_FEED_BYTES) throw new Error('Feed exceeds the 2 MB limit');
  if (!response.body) throw new Error('Feed has no response body');
  const chunks = [];
  let length = 0;
  for await (const piece of response.body) {
    length += piece.byteLength;
    if (length > MAX_FEED_BYTES) throw new Error('Feed exceeds the 2 MB limit');
    chunks.push(piece);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const piece of chunks) { bytes.set(piece, offset); offset += piece.byteLength; }
  return new TextDecoder('utf-8').decode(bytes);
}

export async function pollSources({ sources, inbox = [], feedState = {}, now = new Date(), scheduled = false, fetchImpl = fetch }) {
  if (!Array.isArray(sources) || !Array.isArray(inbox) || !feedState || typeof feedState !== 'object') throw new Error('Invalid monitor inputs');
  const at = new Date(now).toISOString();
  const timestamp = Date.parse(at);
  const eligible = sources.filter(s => {
    if (!s.enabled || !publicFeedUrl(s.feed)) return false;
    if (!scheduled) return true;
    const reviewedAt = Date.parse(`${s.access_reviewed_at}T00:00:00Z`);
    return s.automation_approved === true && Number.isFinite(reviewedAt)
      && reviewedAt <= timestamp && timestamp - reviewedAt <= REVIEW_MAX_AGE_MS;
  });
  if (scheduled && eligible.length === 0) throw new Error('No sources are approved for scheduled access; verify feed terms and approve sources first');
  const nextState = structuredClone(feedState);
  const nextInbox = [...inbox];
  const known = new Set(inbox.map(x => x.id));
  const knownUrls = new Set(inbox.map(x => `${x.source_id}:${normalizedUrl(x.url)}`));
  const reports = [];
  let added = 0;
  let failed = 0;
  for (const source of eligible) {
    const past = nextState[source.id] || {};
    const current = { ...past, checked_at: at, url: source.feed };
    try {
      const headers = {
        'User-Agent': 'FilipinoMediaBulletinResearch/0.2 (+https://github.com/masinlocandher-max/FilipinoMediaBulletin)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9'
      };
      if (past.etag && past.url === source.feed) headers['If-None-Match'] = past.etag;
      if (past.last_modified && past.url === source.feed) headers['If-Modified-Since'] = past.last_modified;
      const response = await fetchImpl(source.feed, { headers, redirect: 'error', signal: AbortSignal.timeout(12000) });
      if (response.status === 304) {
        Object.assign(current, { status: 'unchanged', consecutive_failures: 0, error: null, successful_at: at });
        reports.push({ source_id: source.id, result: 'unchanged', new_items: 0 });
      } else {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (response.url && normalizedUrl(response.url) !== normalizedUrl(source.feed)) throw new Error('Unexpected feed redirect');
        const xml = await boundedResponseText(response);
        const entries = parseFeed(xml, source);
        let sourceAdded = 0;
        for (const entry of entries) {
          const canonical = normalizedUrl(entry.url);
          if (!canonical) continue;
          const published = entry.published_at ? Date.parse(entry.published_at) : NaN;
          if (Number.isFinite(published) && (timestamp - published > MAX_AGE_MS || published > timestamp + MAX_FUTURE_MS)) continue;
          const id = fingerprint(source.id, canonical);
          if (known.has(id) || knownUrls.has(`${source.id}:${canonical}`)) continue;
          const item = {
            id, source_id: source.id, source_name: source.name,
            title: cleanText(entry.title).slice(0, 240), url: canonical,
            published_at: entry.published_at, discovered_at: at, status: 'discovered'
          };
          const suggestion = suggestSimilarEvent(item, nextInbox);
          if (suggestion) item.possible_related = suggestion;
          nextInbox.push(item);
          known.add(id);
          knownUrls.add(`${source.id}:${canonical}`);
          sourceAdded++;
          added++;
        }
        Object.assign(current, {
          status: 'ok', successful_at: at, error: null, consecutive_failures: 0,
          etag: response.headers.get('etag') || null,
          last_modified: response.headers.get('last-modified') || null,
          entries_read: entries.length
        });
        reports.push({ source_id: source.id, result: 'ok', new_items: sourceAdded, entries_read: entries.length });
      }
    } catch (error) {
      failed++;
      Object.assign(current, { status: 'failed', error: String(error.message).slice(0, 180), consecutive_failures: (past.consecutive_failures || 0) + 1 });
      reports.push({ source_id: source.id, result: 'failed', error: current.error });
    }
    nextState[source.id] = current;
  }
  const ordered = nextInbox.sort((a,b) => (b.published_at || b.discovered_at || '').localeCompare(a.published_at || a.discovered_at || ''));
  const finalInbox = [
    ...ordered.filter(x => x.status !== 'discovered'),
    ...ordered.filter(x => x.status === 'discovered')
  ].slice(0, MAX_INBOX_ITEMS);
  return { inbox: finalInbox, feedState: nextState, health: { ran_at: at, scheduled, eligible_sources: eligible.length, added, failed, inbox_size: finalInbox.length, reports } };
}
