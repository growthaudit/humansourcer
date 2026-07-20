#!/usr/bin/env node
// SME Careers (sme.careers) is a Next.js App Router site that bails out to
// full client-side rendering — no scrapeable data in the static HTML at all
// (confirmed via curl: the page ships a BAILOUT_TO_CLIENT_SIDE_RENDERING
// marker and no job content). The real data comes from a public JSON API at
// api.sme.careers (found in the page's Content-Security-Policy connect-src
// allowlist), which needs no auth: GET https://api.sme.careers/v1/jobs.
// That endpoint returns one row per (role x country/state) combination —
// e.g. "Assamese Team Lead" appears 7 times, once per eligible country/state
// — so we de-dupe by externalKey (the stable per-role id) and merge the
// country list into `location`. hourlyRateMin/Max are genuine structured
// numeric pay from the source, so they're passed through to pay_min/pay_max.
// There is no per-role deep-link on the site — the "Take interview" button
// on each card opens an unrelated third-party AI-interview vendor page, not
// a job-specific URL — so apply_url falls back to the general jobs listing.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'sme-careers';
const API_URL = 'https://api.sme.careers/v1/jobs';
const JOBS_PAGE_URL = 'https://sme.careers/jobs';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function buildPayText(min, max) {
  if (min != null && max != null && min !== max) return `$${min}-${max}/hr`;
  if (max != null) return `Up to $${max}/hr`;
  if (min != null) return `From $${min}/hr`;
  return null;
}

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`SME Careers API returned ${res.status}`);
  const { data } = await res.json();
  const jobs = (data?.jobs ?? []).filter((j) => j.status === 'open');
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} open (role x country) rows from the API.`);

  // Merge per-country rows into one role per externalKey.
  const byKey = new Map();
  for (const job of jobs) {
    const key = job.externalKey;
    if (!byKey.has(key)) {
      byKey.set(key, { ...job, countries: new Set() });
    }
    if (job.country?.name) byKey.get(key).countries.add(job.country.name);
  }

  const now = new Date().toISOString();
  const rows = [...byKey.values()].map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.externalKey,
    title: job.title,
    description: (job.description ?? '').slice(0, 2000) || null,
    pay_text: buildPayText(job.hourlyRateMin, job.hourlyRateMax),
    pay_min: job.hourlyRateMin ?? null,
    pay_max: job.hourlyRateMax ?? null,
    pay_currency: job.hourlyRateMin != null || job.hourlyRateMax != null ? (job.currencyCode ?? 'USD') : null,
    pay_unit: job.hourlyRateMin != null || job.hourlyRateMax != null ? 'hour' : null,
    location: [...job.countries].sort().join(', ') || null,
    category: null,
    apply_url: JOBS_PAGE_URL,
    last_seen_at: now,
    is_active: true,
  }));

  console.log(`[${PROVIDER_SLUG}] de-duped to ${rows.length} unique roles.`);
  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
