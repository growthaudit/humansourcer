#!/usr/bin/env node
// Meridial is Greenhouse-hosted (board token "agency"), using Greenhouse's
// standard public job-board API — no auth, well-documented, stable.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'meridial';
const BOARD_TOKEN = 'agency';
const API_URL = `https://boards-api.greenhouse.io/v1/boards/${BOARD_TOKEN}/jobs?content=true`;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Greenhouse API returned ${res.status}`);
  const { jobs } = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(job.id),
    title: job.title,
    description: stripHtml(job.content).slice(0, 2000),
    pay_text: null,
    location: job.location?.name ?? null,
    category: job.departments?.[0]?.name ?? null,
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
