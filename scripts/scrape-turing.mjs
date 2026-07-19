#!/usr/bin/env node
// Scrapes Turing's public jobs API. Note: /api/jobs/all only returns the
// small "suggested" subset (~10 roles) without auth — the full catalog
// lives behind /api/jobs (POST), which requires a real session token we
// are not attempting to forge or bypass.
//
// Run: node scripts/scrape-turing.mjs

import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'turing-ai-advancement-work';
const API_URL = 'https://work.turing.com/api/jobs/all';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchTuringJobs() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)',
      referer: 'https://work.turing.com/jobs',
    },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Turing API returned ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error('Turing API returned success=false');
  return data.jobs;
}

async function main() {
  const jobs = await fetchTuringJobs();
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(job.id),
    title: job.title,
    description: stripHtml(job.description).slice(0, 2000),
    pay_text: job.referralReward ? `Referral: $${job.referralReward}` : null,
    location: job.locationType ?? null,
    category: job.roleGroup ?? null,
    apply_url: `https://work.turing.com/jobs/${job.jobCode ?? job.id}`,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
