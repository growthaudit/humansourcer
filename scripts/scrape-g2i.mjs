#!/usr/bin/env node
// G2i is Ashby-hosted (board "g2i"), via Ashby's public posting-api.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'g2i-talent';
const BOARD = 'g2i';
const API_URL = `https://api.ashbyhq.com/posting-api/job-board/${BOARD}`;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Ashby API returned ${res.status}`);
  const { jobs } = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.id,
    title: job.title,
    description: stripHtml(job.descriptionHtml).slice(0, 2000),
    pay_text: null,
    location: job.location ?? null,
    category: job.department ?? job.team ?? null,
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
