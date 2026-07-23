#!/usr/bin/env node
// Shaip's careers page is WordPress with a custom "jobs" post type exposed
// via the standard WP REST API (found via /wp-json/wp/v2/types). Fields are
// flattened ACF meta on the post itself (position_*), not a nested acf
// object — position_description/position_job_location/
// position_employment_type carry the real content.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'shaip-careers';
const API_URL = 'https://www.shaip.com/wp-json/wp/v2/jobs?per_page=100';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Shaip jobs API returned ${res.status}`);
  const jobs = await res.json();
  const published = jobs.filter((j) => j.status === 'publish');
  console.log(`[${PROVIDER_SLUG}] fetched ${published.length} published roles.`);

  const now = new Date().toISOString();
  const rows = published.map((j) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(j.id),
    title: stripHtml(j.title?.rendered ?? j.position_title) || null,
    description: stripHtml(j.position_description).slice(0, 2000) || null,
    pay_text: null,
    location: j.position_job_location || null,
    category: (j.position_employment_type ?? []).join(', ') || null,
    apply_url: j.link,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
