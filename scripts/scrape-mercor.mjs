#!/usr/bin/env node
// Mercor's data lives behind a Next.js _next/data endpoint keyed by a
// build ID that changes on every deploy — so we re-derive it from the
// homepage on every run rather than hardcoding it.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'mercor-experts';
const PAGE_URL = 'https://www.mercor.com/experts/';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getBuildId() {
  const res = await fetch(PAGE_URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Mercor page returned ${res.status}`);
  const html = await res.text();
  const match = html.match(/"buildId":"([a-zA-Z0-9_-]+)"/);
  if (!match) throw new Error('Could not find Next.js buildId on Mercor page');
  return match[1];
}

async function main() {
  const buildId = await getBuildId();
  const dataUrl = `https://www.mercor.com/_next/data/${buildId}/experts.json`;
  const res = await fetch(dataUrl, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Mercor data endpoint returned ${res.status}`);
  const { pageProps } = await res.json();
  const jobs = pageProps.latestJobs ?? [];
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles (of ${pageProps.jobStats?.totalUniqueJobs ?? '?'} total unique listings site-wide).`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.listingId,
    title: job.title,
    description: null,
    pay_text:
      job.rateMin && job.rateMax && job.rateMin !== job.rateMax
        ? `$${job.rateMin}-${job.rateMax}/${job.payRateFrequency ?? 'hr'}`
        : job.rateMin
          ? `$${job.rateMin}/${job.payRateFrequency ?? 'hr'}`
          : null,
    location: null,
    category: null,
    apply_url: 'https://www.mercor.com/experts/',
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
