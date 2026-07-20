#!/usr/bin/env node
// Content-SUPPLY gap scanner, not a search-demand tool — it answers "what
// could the site's own inventory support right now that it doesn't yet
// serve a dedicated page for," which is a different (and narrower) signal
// than "what do people actually search for." Pair its output with real
// keyword-demand research (see docs/keyword-opportunities.md) rather than
// treating role-count alone as a priority signal.
//
// Re-run this any time providers.json or the Supabase roles table changes —
// it's meant to keep surfacing new gaps as the site's own dataset grows,
// same spirit as scripts/check-links.mjs for link rot.
//
// Requires TS type-stripping to import src/lib/*.ts directly (no separate
// copy of the classification logic to keep in sync).
// Usage: node --experimental-strip-types --env-file=.env.local scripts/keyword-opportunity-scan.mjs [--json]

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { taskType, locationBucket, payBand, TASK_TYPE_LABELS, LOCATION_BUCKET_LABELS } from '../src/lib/role-taxonomy.ts';
import { geographyScope, DOMAIN_TAG_LABELS } from '../src/lib/taxonomy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVIDERS_PATH = path.join(__dirname, '../src/data/providers.json');
const PAGES_ROOT = path.join(__dirname, '../src/pages');
const AS_JSON = process.argv.includes('--json');

const ALL_DOMAIN_TAGS = Object.keys(DOMAIN_TAG_LABELS);
const ALL_TASK_TYPES = Object.keys(TASK_TYPE_LABELS);

async function loadEligibleRoles() {
  const providers = JSON.parse(await readFile(PROVIDERS_PATH, 'utf-8'));
  const expertBySlug = new Map(providers.filter((p) => p.audienceTier === 'expert').map((p) => [p.slug, p]));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — run with --env-file=.env.local');
  }
  const supabase = createClient(url, key);

  const PAGE_SIZE = 1000;
  const rows = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('roles')
      .select('provider_slug, title, location, pay_text, pay_min, pay_max, pay_unit, source_role_id')
      .eq('is_active', true)
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const eligible = [];
  for (const role of rows) {
    const provider = expertBySlug.get(role.provider_slug);
    if (provider) eligible.push({ role, provider });
  }
  return { eligible, providers, expertProviders: [...expertBySlug.values()] };
}

async function pagesDirExists(relPath) {
  try {
    await readdir(path.join(PAGES_ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

async function findComparisonPages() {
  const matches = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/vs|compare/i.test(entry.name)) matches.push(path.relative(PAGES_ROOT, full));
    }
  }
  await walk(PAGES_ROOT);
  return matches;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Same-domain overlap = a defensible heuristic for "these two providers are
// plausible competitors" — real relevance still needs a human's judgment
// call, this just narrows the field instead of comparing all 190 pairs.
function suggestComparisonPairs(providers, limit = 8) {
  const pairs = [];
  for (let i = 0; i < providers.length; i++) {
    for (let j = i + 1; j < providers.length; j++) {
      const a = providers[i];
      const b = providers[j];
      const sharedDomains = a.domainTags.filter((t) => b.domainTags.includes(t));
      if (sharedDomains.length >= 2) {
        pairs.push({ a: a.workerBrand, b: b.workerBrand, sharedDomains, score: sharedDomains.length });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score).slice(0, limit);
}

async function main() {
  const { eligible, providers, expertProviders } = await loadEligibleRoles();

  const domainCounts = {};
  const providerCountsByDomain = {};
  for (const { role, provider } of eligible) {
    for (const tag of provider.domainTags) {
      domainCounts[tag] = (domainCounts[tag] ?? 0) + 1;
      (providerCountsByDomain[tag] ??= new Set()).add(provider.workerBrand);
    }
  }

  const taskCounts = countBy(eligible, ({ role }) => taskType(role));

  const locationCounts = countBy(eligible, ({ role, provider }) =>
    locationBucket({ location: role.location }, geographyScope(provider.geography))
  );

  const dormantDomains = ALL_DOMAIN_TAGS.filter((tag) => !domainCounts[tag]);
  const dormantTaskTypes = ALL_TASK_TYPES.filter((t) => t !== 'other' && !taskCounts[t]);

  const hasLocationHub = await pagesDirExists('roles/location');
  const comparisonPages = await findComparisonPages();
  const comparisonCandidates = comparisonPages.length === 0 ? suggestComparisonPairs(expertProviders) : [];

  const providerRoleCounts = countBy(eligible, ({ provider }) => provider.workerBrand);
  const providersWithNoRoles = expertProviders.filter((p) => !providerRoleCounts[p.workerBrand]);

  const gigTierCount = providers.filter((p) => p.audienceTier === 'gig').length;

  const report = {
    generatedAt: new Date().toISOString(),
    totalEligibleRoles: eligible.length,
    domain: ALL_DOMAIN_TAGS.map((tag) => ({
      tag,
      label: DOMAIN_TAG_LABELS[tag],
      roleCount: domainCounts[tag] ?? 0,
      companyCount: providerCountsByDomain[tag]?.size ?? 0,
      hasHub: true, // domain hubs are generated for any tag with >=1 role — dormant tags just never get one, see dormantDomains
    })),
    dormantDomains,
    task: ALL_TASK_TYPES.map((t) => ({ type: t, label: TASK_TYPE_LABELS[t], roleCount: taskCounts[t] ?? 0 })),
    dormantTaskTypes,
    location: Object.keys(LOCATION_BUCKET_LABELS).map((bucket) => ({
      bucket,
      label: LOCATION_BUCKET_LABELS[bucket],
      roleCount: locationCounts[bucket] ?? 0,
    })),
    structuralGaps: [
      !hasLocationHub && {
        gap: 'No /roles/location/[bucket]/ hub page type exists',
        evidence: `Location buckets already computed per-role with real counts: ${Object.entries(locationCounts)
          .map(([k, v]) => `${LOCATION_BUCKET_LABELS[k]}=${v}`)
          .join(', ')}`,
      },
      comparisonPages.length === 0 && {
        gap: 'No provider comparison/"vs" content exists',
        evidence: `${comparisonCandidates.length} same-domain-overlap candidate pairs identified (see comparisonCandidates)`,
      },
      gigTierCount > 0 && {
        gap: `${gigTierCount} gig-tier providers have zero pages (out of current build scope)`,
        evidence: 'Tracked separately in the Phase 2 backlog — noted here only as a supply-side reminder.',
      },
    ].filter(Boolean),
    comparisonCandidates,
    providersWithNoActiveRoles: providersWithNoRoles.map((p) => p.workerBrand),
  };

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Keyword-opportunity content-supply scan — ${report.generatedAt}`);
  console.log(`${report.totalEligibleRoles} active roles across ${expertProviders.length} expert-tier providers.\n`);

  console.log('DOMAIN (role count / companies):');
  for (const d of report.domain) {
    console.log(`  ${d.label.padEnd(24)} ${String(d.roleCount).padStart(5)} roles  ${d.companyCount} companies`);
  }
  if (dormantDomains.length) {
    console.log(`\n  Dormant (zero live roles): ${dormantDomains.map((t) => DOMAIN_TAG_LABELS[t]).join(', ')}`);
  }

  console.log('\nTASK TYPE (role count):');
  for (const t of report.task) {
    console.log(`  ${t.label.padEnd(32)} ${String(t.roleCount).padStart(5)} roles`);
  }
  if (dormantTaskTypes.length) {
    console.log(`\n  Dormant (zero matches from classifier): ${dormantTaskTypes.map((t) => TASK_TYPE_LABELS[t]).join(', ')}`);
  }

  console.log('\nLOCATION BUCKET (role count):');
  for (const l of report.location) {
    console.log(`  ${l.label.padEnd(20)} ${String(l.roleCount).padStart(5)} roles`);
  }

  if (report.structuralGaps.length) {
    console.log('\nSTRUCTURAL GAPS:');
    for (const g of report.structuralGaps) {
      console.log(`  - ${g.gap}`);
      console.log(`    ${g.evidence}`);
    }
  }

  if (comparisonCandidates.length) {
    console.log('\nCOMPARISON PAGE CANDIDATES (same-domain overlap heuristic):');
    for (const c of comparisonCandidates) {
      console.log(`  ${c.a} vs ${c.b}  (shared: ${c.sharedDomains.map((t) => DOMAIN_TAG_LABELS[t]).join(', ')})`);
    }
  }

  if (providersWithNoRoles.length) {
    console.log(`\nEXPERT-TIER PROVIDERS WITH NO ACTIVE ROLES (no scraper yet, or genuinely zero open):`);
    for (const name of report.providersWithNoActiveRoles) console.log(`  ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
