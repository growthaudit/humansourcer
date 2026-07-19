#!/usr/bin/env node
// Mindrift is Workable-hosted under the "toloka-ai" account (Toloka's
// contributor work migrated to Mindrift), via Workable's public widget API.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'mindrift';
const ACCOUNT = 'toloka-ai';
const API_URL = `https://apply.workable.com/api/v1/widget/accounts/${ACCOUNT}`;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Workable API returned ${res.status}`);
  const { jobs } = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.shortcode,
    title: job.title,
    description: null,
    pay_text: null,
    location: job.telecommuting ? 'Remote' : (job.city || job.country || null),
    category: job.department ?? null,
    apply_url: job.application_url,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
