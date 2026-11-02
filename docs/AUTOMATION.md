# Newsroom automation implementation and roadmap

## Implemented in this build

1. **Ingest (manual command):** enabled approved RSS endpoints -> normalized title, canonical source URL, publication time, source ID and checksum -> private local `data/inbox.json`. No copied text or images. Failures are explicit.
2. **Editorial research:** humans inspect candidate leads, original documents, conflicts and context. Data is not automatically presumed accurate.
3. **Submission:** independently authored JSON -> `data/queue.json`, validated required fields and source URLs.
4. **Approval:** named human editor + explicit evidence/rights flags; risk-specific corroboration and senior-review flags -> `data/bulletins.json`, with timestamp and audit log.
5. **Build:** static pages, current 24-hour bulletin, searchable permanent archive, source links, retraction/correction notices, optional Article JSON-LD/sitemaps/RSS.
6. **Monitoring:** `npm test` and build failures are local, visible operational checks. There is no remotely configured monitor yet.

## Not yet implemented

- Authenticated multi-editor web CMS, publication-role controls, secure dispute handling, or proper correction submission form.
- Continuous source polling, job scheduling, idempotent distributed queues, uptime alerts, remote draft generation, full event clustering or automated social posting.
- Publisher API credentials, licensed wire content, multilingual translation workflow or media rights database.
- Real-user analytics, newsletter consent, sponsor billing or a live domain/deployment.

**Do not represent any of the above as active.** Do not schedule feeds without reviewing publisher usage terms and validating hosting/worker access. Existing GitHub Actions availability should be checked before introducing GitHub-hosted schedules; the MVP does not depend on it.

## Proposed phase-two services

- Source registry with permitted acquisition methods, polling interval, terms verification date, ownership and failure alerts.
- Concurrency-limited poll workers with response size/time limits, ETag, Last-Modified and deduplication keys.
- Structured event clusters; avoid treating repeated syndication as multiple independent confirmations.
- Claim-by-claim provenance and contradicted-claim workflow; editorial board never replaced by probabilistic risk scores.
- Role-based approvals, audit-only revisions, correction SLA, high-risk escalation and reliable non-duplicating publish jobs.
- Human-reviewed newsletter and platform posts, never invented “posted successfully” statuses.
- Health dashboard: failed feeds, latest ingestion, stale source alerts, pending risk reviews, retries, publishing latency and retractions.

## Minimal operating procedure

Morning: run ingestion, review priority sources and source failures, select significant stories, investigate and create drafts. Midday and evening: refresh candidate queue, fact-check changes, update/correct prior stories. Urgent advisories: human escalation with exact issue time and affected area. Nightly: backup reviewed data, inspect audit history and broken links. Actual job scheduling requires selected infrastructure and permissions; this is a runbook, not an active schedule.

## Technical limitations to address before production

The JSON files are single-writer local storage and can conflict under concurrent editors; use a transactional database with approvals and access policies when multiple staff join. Source XML parsing is deliberately limited and should be extended with a tested standards-compliant XML library when Atom/RSS edge cases occur. Static 24-hour filtering is progressively enhanced in the browser, but publication still requires a fresh build. Continuous live news requires an actual host/worker architecture with operational monitoring.
