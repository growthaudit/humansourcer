#!/usr/bin/env node
// TELUS Digital AI's homepage "Top opportunities" widget calls a real JSON
// API (found in the client bundle's APAPI_URL + listJobPosts route):
// POST https://api.telusinternational.ai/apapi/v1/list-job-posts
// A body of {} defaults to a plausible-looking but geo-scoped view; passing
// is_global:true returns the same total either way, confirming the total is
// genuinely global rather than filtered — paged with limit:100.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'telus-international-ai-community-portal';
const API_URL = 'https://api.telusinternational.ai/apapi/v1/list-job-posts';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';
const PAGE_SIZE = 100;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllJobs() {
  const all = [];
  let page = 1;
  for (;;) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'user-agent': UA, 'content-type': 'application/json' },
      body: JSON.stringify({ is_global: true, page, limit: PAGE_SIZE }),
    });
    if (!res.ok) throw new Error(`TELUS list-job-posts returned ${res.status}`);
    const { data, pagination } = await res.json();
    all.push(...data);
    if (page >= pagination.pages) break;
    page += 1;
  }
  return all;
}

function buildPayText(compensation) {
  if (!compensation?.amount) return null;
  const unit = compensation.unit === 'per_hour' ? '/hr' : compensation.unit === 'per_unit' ? '/unit' : '';
  return `$${compensation.amount}${unit}`;
}

async function main() {
  const jobs = await fetchAllJobs();
  const active = jobs.filter((j) => j.status === 'active');
  console.log(`[${PROVIDER_SLUG}] fetched ${active.length} active roles (of ${jobs.length} returned).`);

  const now = new Date().toISOString();
  const rows = active.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(job.id),
    title: job.title,
    description: stripHtml(job.description).slice(0, 2000) || null,
    pay_text: buildPayText(job.compensation),
    pay_min: job.compensation?.amount ?? null,
    pay_max: job.compensation?.amount ?? null,
    pay_currency: job.compensation?.currency ?? null,
    pay_unit: job.compensation?.unit ?? null,
    location: job.job_type === 'remote' ? 'Remote' : null,
    category: job.job_domain ?? null,
    apply_url: `https://www.telusinternational.ai/cmp/public/jobs/available/${job.id}`,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
