# HumanSourcer keyword opportunity research

Last researched: 2026-07-20. Re-run `node --experimental-strip-types --env-file=.env.local scripts/keyword-opportunity-scan.mjs` for current content-supply numbers before acting on this — the priority calls below assume the dataset shape as of this date.

## Methodology

No authenticated keyword-volume tool (Ahrefs/SEMrush/GSC) was available for this pass. Volume and Difficulty below are **directional tiers (High/Med/Low), not modeled numbers** — derived from live SERP research (who ranks, what format wins, what SERP features are present) for a representative sample of queries per cluster, cross-referenced against `scripts/keyword-opportunity-scan.mjs`'s content-supply output (what the site's own data could actually support). Treat this as a prioritization starting point, not a final number — refresh with real Ahrefs/GSC data once available (see "Upgrade path" at the bottom).

Two signals are kept deliberately separate throughout: **content supply** (how many roles/providers HumanSourcer's own data has for a topic — a proxy for whether a page would be thin or substantial) and **search demand** (whether people actually search for that topic). A cluster needs both to be a real quick win.

## The most important finding: know your actual competitive set

For nearly every query tested, the SERP was **not** dominated by Indeed/LinkedIn/Glassdoor — those show up, but the pages that consistently rank alongside or above them are a specific cluster of small-to-medium niche sites already doing exactly what HumanSourcer does:

**aitrainer.work, opentrain.ai, wahojobs.com, remowork.life, aigigjobs.com, joinarena.ai, hirefeed.co.in, jobright.ai, selfmadesuccess.com, breakingeven.online, jobsst.com**

Several of these (aitrainer.work, opentrain.ai, wahojobs.com) run near-identical site architectures to HumanSourcer's — domain/task-faceted AI-training-job directories with guide/review content layered on top. This is both a warning and an opportunity: the space is validated (multiple competitors are investing in it, so real demand exists), but parity isn't enough — and importantly, **this competitive set is beatable**. They're blog/directory-tier sites, not enterprise SEO operations. HumanSourcer's real differentiators against them:

- **Evidence-cited ownership/relationship data** — no competitor observed does this; it's a genuine E-E-A-T advantage for "is X legit" queries specifically.
- **Live, daily-scraped role data with `JobPosting` schema** — most competitor content is static blog posts with anecdotal pay figures; HumanSourcer's hub-page stats (pay-band/location distribution) are computed from real current listings.
- **The FAQ content shipped this session** already targets the exact "is X legit" / "what does X pay" query pattern these competitors built dedicated review-blog content for.

## Priority matrix

### Quick wins (low-med difficulty, real demand, buildable now or near-zero new engineering)

| Opportunity | Why | Volume | Difficulty |
|---|---|---|---|
| Sharpen "is [provider] legit" / pay-review phrasing in titles & meta | Competing SERP is small-blog-tier (aitrainer.work, selfmadesuccess.com, breakingeven.online), not enterprise sites. Content already exists (FAQ work) — this is a phrasing/on-page-optimization pass, not new content. | Med (per-provider, long-tail in aggregate across ~20+ providers) | Low |
| Build `/roles/location/[bucket]/` hub pages | Real, confirmed demand ("remote AI training jobs" pulls LinkedIn's 229K+ listings and dedicated ZipRecruiter city pages). `locationBucket` is already computed per role with real counts (Remote=512, Region specific=500, Global=214, US=133) — **zero new classification logic needed**, just a 4th hub route matching the existing domain/company/task pattern. | High (head term) / Med (realistic near-term capture) | High (head term) / Low (long-tail) |
| Relabel the model-evaluation-red-teaming task hub away from "red teaming" phrasing | "AI red teaming jobs" SERP skews full-time cybersecurity careers ($100K–300K salaries, HackTheBox Academy, OpenAI's own red-team page) — a different intent than HumanSourcer's gig/freelance AI-training-evaluation content. "AI evaluator jobs" / "AI model evaluation jobs" phrasing matches actual site content much better. | Med | Med (current phrasing) → Low (retargeted phrasing) |
| "Best AI training platforms to work for in [year]" pillar page | Ranking competitor (remowork.life "Top 25...") is a single blog listicle. HumanSourcer's entire directory already *is* this content, evidence-cited — needs a dedicated pillar page framing, not new data. | Med–High | Low–Med |
| "AI training jobs with no experience required" pillar/filtered view | Strong confirmed demand (Mindrift, Mercor, wahojobs, tripleten.com all have dedicated content). HumanSourcer's existing `accessModelCategory` taxonomy (open/application/selective/waitlist, `src/lib/taxonomy.ts`) maps almost directly onto "beginner-friendly" — the classification already exists, just needs a dedicated landing page. | Med–High | Low–Med |

### Gaps (real demand, not yet served, competitors already active here)

| Opportunity | Why | Volume | Difficulty |
|---|---|---|---|
| Provider comparison / "vs" pages | Confirmed real demand — at least 3 competitors run **dedicated comparison tools** (joinarena.ai `/compare/`, hirefeed.co.in `/compare`, aitrainer.work `/alternatives/`). HumanSourcer has zero comparison content today. `scripts/keyword-opportunity-scan.mjs` already surfaces 8 same-domain-overlap candidate pairs (e.g. Mercor vs Vetto, Mercor vs Meridial) as a starting list. | Med | Med — niche competitors, not giants, but they have a head start |
| Gig-tier section (data annotation / labeling content) | "Data annotation jobs remote" is the single highest-volume query tested, but it's dominated by DataAnnotation.tech itself plus large established aggregators (LXT, Upwork, Arc) — **and** it maps to HumanSourcer's gig-tier providers, which are entirely out of scope for the current build (Phase 2 backlog). Zero current content-supply for this cluster. | High | High |
| "How much do AI training jobs pay" data-driven pillar | CBS News and Glassdoor both rank — high-authority competition. But HumanSourcer's hub pages already compute real live pay-band distributions per domain/task/company (`computeHubStats` in `src/lib/role-faq.ts`) — most competitor content cites static/anecdotal figures. A dedicated pillar aggregating this real data is a genuine, defensible differentiation angle, not a quick build. | High | High |

### Long-term (high volume, high difficulty, needs sustained authority-building)

- Head terms: "remote AI training jobs", "AI trainer salary", "data annotation jobs" — dominated by LinkedIn (hundreds of thousands of listings), Indeed, and the providers' own marketing homepages (Mindrift, Mercor). Not winnable near-term; realistic path is long-tail capture (domain × location × task combinations) plus accumulated internal-linking authority over time, which the `/roles/` hub architecture already supports structurally.
- General "AI training platforms" / "AI trainer" category authority — the niche competitive set identified above (aitrainer.work, opentrain.ai, wahojobs.com) has a head start; closing that gap is a sustained content/backlink effort, not a single build.

## Content-supply snapshot (from `scripts/keyword-opportunity-scan.mjs`, 2026-07-20)

1,359 active roles across 20 expert-tier providers.

**By domain** (role count / companies): Coding 1148/6, Linguistics 1063/3, Finance 837/3, Law 831/2, Science/STEM 831/2, Safety 829/2, Reasoning/Agents 356/3, Writing/Creative 169/2, Generalist 96/2, Medicine 16/2, Consulting/Ops 16/2, Voice/Speech 10/1. No dormant domains — every canonical tag has live supply.

**By task type**: Model evaluation/red-teaming 444, Translation/linguistics 248, Other 219, Coding/SWE 177, Voice/audio 78, Data annotation/labeling 75, Customer support/ops 71, Research/analysis 43, Writing/editing 4 (thin — watch this one; either genuinely low-supply or a classifier miss worth spot-checking).

**By location bucket**: Remote 512, Region-specific 500, Global 214, US 133, Unspecified 0.

**Structural gaps confirmed by the scanner**: no `/roles/location/` hub type exists; no comparison/"vs" content exists; 32 gig-tier providers remain unbuilt (tracked separately, noted here as the reason the highest-volume query cluster tested — data annotation — currently has zero content supply).

## Upgrade path

Once Ahrefs (or another keyword tool) is authorized, or a GSC/Ahrefs export is available: re-run the same query list against real volume/KD data and replace the directional tiers above with numbers. The cluster list and competitive-set findings don't need to be redone — only the volume/difficulty scoring.
