#!/usr/bin/env node
// Outlier's public marketing site has no listings, but the worker app at
// app.outlier.ai exposes a public, unauthenticated job board API (found via
// network inspection of app.outlier.ai/opportunities). No auth cookie or
// API key needed. pageSize=100 fits every current opportunity in one page.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'outlier';
const API_URL = 'https://app.outlier.ai/internal/experts/job-board/jobs';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'user-agent': UA, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ page: 1, pageSize: 100 }),
  });
  if (!res.ok) throw new Error(`Outlier job board API returned ${res.status}`);
  const data = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${data.jobs.length} of ${data.totalCount} opportunities.`);

  const now = new Date().toISOString();
  const rows = data.jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(job.id),
    title: stripHtml(job.title) || null,
    description: stripHtml(job.content).slice(0, 2000) || null,
    pay_text: job.maxHourlyRateUsd ? `Up to $${job.maxHourlyRateUsd}/hr` : null,
    pay_min: null,
    pay_max: job.maxHourlyRateUsd ?? null,
    pay_currency: job.maxHourlyRateUsd ? 'USD' : null,
    pay_unit: job.maxHourlyRateUsd ? 'HOURLY' : null,
    location: job.location?.name ?? null,
    category: (job.skillNames ?? []).join(', ') || null,
    apply_url: job.absolute_url,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
