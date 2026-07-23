#!/usr/bin/env node
// Datamundi's /open-positions/ page (distinct from its /community/ vendor-
// registration funnel, which has no discrete listings) is powered by a
// public BambooHR careers board. The list endpoint gives titles/locations
// only; each job's /detail endpoint adds the real description and share
// URL, found via network inspection of the public careers page (no API key,
// no login).
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'datamundi-freelance-vendor-applications';
const LIST_URL = 'https://datamundi.bamboohr.com/careers/list';
const DETAIL_URL = (id) => `https://datamundi.bamboohr.com/careers/${id}/detail`;
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Datamundi BambooHR API ${url} returned ${res.status}`);
  return res.json();
}

function locationFor(job) {
  const ats = job.atsLocation ?? {};
  return [ats.city, ats.country].filter(Boolean).join(', ') || null;
}

async function main() {
  const list = await fetchJson(LIST_URL);
  const jobs = list.result ?? [];
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} open positions.`);

  const details = await Promise.all(
    jobs.map((j) => fetchJson(DETAIL_URL(j.id)).then((d) => d.result.jobOpening)),
  );

  const now = new Date().toISOString();
  const rows = details.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(job.id ?? job.jobOpeningShareUrl.split('/').pop()),
    title: stripHtml(job.jobOpeningName) || null,
    description: stripHtml(job.description).slice(0, 2000) || null,
    pay_text: null,
    location: locationFor(job),
    category: job.departmentLabel || null,
    apply_url: job.jobOpeningShareUrl,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
