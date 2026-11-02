# Editorial handbook and sourcing policy

## Source tiers

**Primary:** official laws, data releases, court records, transcripts, advisories, named firsthand accounts. They establish what the issuing authority said or recorded, not necessarily the ultimate truth of a disputed matter.

**Independent reporting:** established newsrooms and specialists providing corroboration, interviews, on-the-ground evidence and independent scrutiny. Compare independent origins; multiple rewrites of one press release do **not** count as independent confirmations.

**Discovery:** social posts, trend monitors, aggregator pages, search results and RSS metadata. These create candidate leads, never automatic publication authority.

Initial feeds are listed in `data/sources.json`. `enabled` represents an ingestion toggle, not a license or a promise of uptime. A non-feed source may require manual monitoring until an authorized endpoint is established.

## News verification requirements

Before publication, a human editor must verify: original dates/time zones, names, quantities, place and scope, the authority of each primary document, any direct quotations, and whether the story is still current. Record evidence URLs, contradictions, uncertainties and the reason the story deserves coverage.

Contested claims require at least two independently originated corroborating sources **plus human judgment**, not just two URLs. High-risk allegations involving identifiable people, emergencies, crimes, medical claims or financial outcomes require senior editorial review and, where appropriate, specialist/legal advice. Do not identify private individuals unless public-interest criteria and legal review justify it.

Editors should label unverified or conflicting elements clearly. If the evidence is insufficient, withhold publication. Never translate an official statement into a claim of proven fact.

## Rights and originality

Write independent concise summaries; do not copy protected article bodies, subscriber-only text, images, logos or multimedia from publishers. A source link and credit are **not** a substitute for a license. Use original, licensed or appropriately authorized images only. No AI-generated imitation of documentary photographs. A source's RSS availability is not permission for republication or bulk redistribution.

## Story priority

Rank candidates on likely Filipino impact (35%), public significance (25%), timeliness (15%), practical usefulness (15%) and community relevance (10%). This is a **proposed internal triage heuristic**, not an objective truth score, and it never overrides safety or accuracy. Critical global stories remain newsworthy even without an immediate direct Filipino impact.

## Tone

Short sentences, active verbs when warranted, exact nouns and direct explanations. Use natural English with accessible Filipino wording where clearer. Avoid dramatic headlines, false balance, political advocacy in straight news, and artificial Filipino relevance. The reader should know what is confirmed, what is contested and why the issue matters.

## Corrections, retractions and history

A correction uses the `correct` command with a written reason. Original publication time is retained; new modification time, editor and reason appear in the public story. The audit record stores the previous version. If a story must be retracted, retain its URL and a clear reason; remove it from active feeds. Do not quietly delete or rewrite history. Correction requests should have a public accessible path before commercial launch; GitHub Issues is only a temporary implementation route.

## Independence

Commercial contracts, sponsors, PR engagements and the personal interests of staff cannot dictate news placement or coverage. Label all sponsorships separately. Maintain a conflict register before publishing coverage of any related business, institution or client. If impartial review is not possible, recuse the editor or decline coverage.
