#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'afterquery-experts';
const API_URL = 'https://experts.afterquery.com/api/jobs/listings';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`AfterQuery API returned ${res.status}`);
  const { jobs } = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.docId ?? String(job.id),
    title: job.title,
    description: (job.description ?? '').slice(0, 2000),
    pay_text: job.salary ?? null,
    location: null,
    category: job.department ?? null,
    apply_url: `https://experts.afterquery.com/apply/${job.link}`,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
