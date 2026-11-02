# Filipino Media Bulletin (FMB)

**Know what matters.** A mobile-first, source-linked news briefing focused on the Philippines, the world, and practical Filipino relevance.

> **Status (November 2026): first implementation, not a live newsroom.** No stories have been approved or published, no hosting is configured, and no automatic live-news publishing occurs. The public build intentionally shows an honest first-edition state. GitHub Actions and commercial news licenses are not launch dependencies.

## What is implemented

- Responsive editorial website: Philippines / World, rolling last-24-hour feed, dated story pages, archive search, source directory, editorial principles, privacy page.
- No fabricated articles, photos, live counts, news updates, or publisher endorsements.
- Static HTML per bulletin, Article structured data, optional XML/RSS and sitemap generation when an HTTPS site origin is configured and launch mode is explicitly enabled.
- Source registry and **manual RSS metadata ingestion** for enabled feeds. Titles, source URLs, publication time and IDs only; **no third-party article body or images**.
- Human-controlled review workflow: submit, approve, reject, correct, retract. Publication requires explicit evidence/rights confirmation. Riskier stories require additional corroboration/senior review.
- Audit trail, visible correction/retraction notices, stable URLs and automated tests.

## Quick start

Requires Node.js 20+; no `npm install` dependencies.

```sh
npm test
npm run build
# Preview static output with any local HTTP server, for example:
python3 -m http.server 8080 -d dist
```

Open `http://localhost:8080/`. The initial homepage contains no fictional news; this is expected.

### Discover publisher headlines (not publishable stories)

```sh
npm run ingest
# Inspect local untracked data/inbox.json; this is a research queue only.
```

RSS accessibility varies by publisher. The ingest command reports failures rather than silently claiming success. Before scheduling repeated access, review each source's terms, licensing, robots rules and permitted API use. Research metadata is not FMB reporting.

### Prepare and publish a real bulletin

1. Research the claim and independently write a bulletin JSON file based on `docs/DRAFT_EXAMPLE.json` (a non-news example), including source links and risk category.
2. `node scripts/newsroom.mjs submit ./draft.json`
3. `node scripts/newsroom.mjs list`
4. After evidence and media/wording rights are **actually reviewed**, use:

```sh
node scripts/newsroom.mjs approve <id> "Editor Name" --evidence-reviewed --rights-reviewed
npm run build
```

For contested stories add `--corroborated`; for high-risk stories also supply `--senior-editor="Second Editor"`. Editors must not assert flags without completing the reviews. This tool is **not** an automated fact checker. It saves reviewed JSON locally; publication is delivered only after an authorized deployment of a new static build.

Other commands:

```sh
node scripts/newsroom.mjs reject <id> "Editor Name" "Specific editorial rejection reason"
node scripts/newsroom.mjs correct <id> ./corrected.json "Editor Name" "Explain exactly what was corrected" --evidence-reviewed --rights-reviewed
node scripts/newsroom.mjs retract <id> "Editor Name" "Explain why this bulletin was retracted"
```

Only approved public bulletins should be committed to this public repository. Pending drafts, discovery inbox and editorial audit data remain locally untracked and must be securely backed up outside the public repo. For a correction, the original publication time is preserved; readers see a correction notice and the audit file retains the prior version. Retracted article URLs remain visible with a reason.

## Deployment safeguards

By default, output is **noindex** with `robots.txt` disallowing crawlers. A live publication requires human editorial readiness plus a confirmed deployment URL:

```sh
FMB_SITE_URL=https://your-verified-host.example FMB_LAUNCH=true npm run build
```

The URL above is an example, **not an FMB domain**. Use the actual authorized HTTPS site origin. If deployed under a path such as `/FilipinoMediaBulletin`, include it in `FMB_SITE_URL`. This controls canonical links, asset paths, NewsArticle URLs, regular sitemap, news sitemap (last 48 hours only), and RSS. A `dist/` deployment must be separately configured and verified; this repo does not claim it is live.

## Architecture

```
Authorized RSS feeds --> data/inbox.json (untracked research metadata)
                    --> editor research + independently authored JSON
                    --> data/queue.json (pending)
                    --> review & explicit CLI approval
                    --> data/bulletins.json (canonical published record)
                    --> npm run build --> dist/ --> authorized hosting
                                      + archive, corrections, SEO, RSS
```

The MVP uses static publishing rather than introducing a backend, complex CMS or automation subscriptions before the newsroom process is proven. Concurrent multi-editor workflows, private authentication, push-button live review, alert escalation and scheduled workers belong to the next architectural phase, after infrastructure and ownership decisions are verified. **Do not host the JSON-writing CLI on a public web endpoint.**

## Repository map

- `site/` — design system and progressive enhancement.
- `scripts/build.mjs` — pre-rendered public publication and SEO outputs.
- `scripts/ingest.mjs` — explicitly invoked RSS discovery only.
- `scripts/newsroom.mjs` — editor-controlled lifecycle.
- `scripts/lib.mjs` — validation, escaping, RSS parsing and time rules.
- `data/sources.json` — declared publisher/primary-source registry and enablement.
- `data/queue.json` — private, gitignored local pending editorial drafts.
- `data/bulletins.json` — approved/retracted bulletin records.
- `data/audit.json` — private, gitignored local editorial decisions and correction history; require secure backup.
- `docs/` — product, editorial, automation and operating decisions.

## Release gates

Do not set `FMB_LAUNCH=true` until a designated editor approves the source and correction standards, a working public correction contact is established (the project Issues link is temporary), hosting privacy disclosures are verified, at least one real publish/update/retract flow is exercised, and the public layout has been checked on representative mobile devices. Never treat a successful build as evidence that a live newsroom or social distribution integration is operating.

## Business boundaries

Free public bulletins are the main product. Potential future revenue is separate: clearly labeled sponsorships and genuinely differentiated institutional briefings. No advertiser, client, or communications engagement controls news selection or editorial conclusions. See `docs/PRODUCT.md` and `docs/EDITORIAL.md`.
