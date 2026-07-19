#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'sepal-expert-hub';
const API_URL =
  'https://api.nexus.sepalai.com/trpc/jobs.getPublicJobs?batch=1&input=%7B%220%22%3A%7B%22searchQuery%22%3A%22%22%7D%7D';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Sepal API returned ${res.status}`);
  const body = await res.json();
  const jobs = body[0].result.data;
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.id,
    title: job.jobTitle,
    description: (job.jobDescription ?? '').slice(0, 2000),
    pay_text: null,
    location: null,
    category: job.educationLevelMinimum ?? null,
    apply_url: job.applyUrl,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
