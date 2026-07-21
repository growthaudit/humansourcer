#!/usr/bin/env node
// Mercor's marketing site (www.mercor.com) disallows /_next/data/ in
// robots.txt, and its homepage data endpoint only ever exposes ~10 "latest"
// roles anyway. The real worker-facing job board lives on a separate
// subdomain, work.mercor.com, whose robots.txt does NOT disallow /jobs/ or
// /_next/data/ (only auth/application paths) and ships a sitemap listing
// every individual job page — that's the sanctioned, crawlable surface.
//
// Approach: read the sitemap for the full list of /jobs/{listingId}/{slug}
// URLs, then fetch each one's lightweight _next/data JSON (not the full
// HTML) for the real title/description/pay/location — this is ~6x smaller
// per request than scraping the rendered page and stays within what the
// site's own robots.txt permits.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'mercor-experts';
const SITE = 'https://work.mercor.com';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';
const CONCURRENCY = 8;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getBuildId() {
  const res = await fetch(`${SITE}/`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`work.mercor.com homepage returned ${res.status}`);
  const html = await res.text();
  const match = html.match(/"buildId":"([a-zA-Z0-9_-]+)"/);
  if (!match) throw new Error('Could not find Next.js buildId on work.mercor.com');
  return match[1];
}

async function getJobPaths() {
  const res = await fetch(`${SITE}/sitemap.xml`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`work.mercor.com sitemap returned ${res.status}`);
  const xml = await res.text();
  const paths = [];
  const re = /<loc>https:\/\/work\.mercor\.com(\/jobs\/list_[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) paths.push(m[1]);
  return [...new Set(paths)];
}

async function fetchRole(buildId, path) {
  const url = `${SITE}/_next/data/${buildId}${path}.json`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) return null;
  const { pageProps } = await res.json();
  return pageProps?.role ?? null;
}

// Bounded-concurrency map — same shape as check-links.mjs's worker pool.
async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function buildPayText(min, max, unit) {
  const perUnit = unit === 'hourly' ? 'hr' : unit ?? 'hr';
  if (min != null && max != null && min !== max) return `$${min}-${max}/${perUnit}`;
  if (min != null) return `$${min}/${perUnit}`;
  return null;
}

async function main() {
  const buildId = await getBuildId();
  const paths = await getJobPaths();
  console.log(`[${PROVIDER_SLUG}] found ${paths.length} job pages in the sitemap.`);

  const roles = await mapWithConcurrency(paths, CONCURRENCY, (path) => fetchRole(buildId, path));
  const active = roles
    .map((role, idx) => (role ? { role, path: paths[idx] } : null))
    .filter((entry) => entry && entry.role.status === 'active' && !entry.role.deletedAt);
  console.log(`[${PROVIDER_SLUG}] fetched ${active.length} active roles (of ${paths.length} pages).`);

  const now = new Date().toISOString();
  const rows = active.map(({ role, path }) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: role.listingId,
    title: role.title,
    description: (role.description ?? '').slice(0, 2000) || null,
    pay_text: buildPayText(role.rateMin, role.rateMax, role.payRateFrequency),
    pay_min: role.rateMin ?? null,
    pay_max: role.rateMax ?? null,
    pay_currency: role.rateMin != null || role.rateMax != null ? 'USD' : null,
    pay_unit: role.payRateFrequency ?? null,
    location: role.location ?? null,
    category: null,
    apply_url: `${SITE}${path}`,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
