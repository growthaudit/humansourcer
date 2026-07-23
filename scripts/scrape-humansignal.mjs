#!/usr/bin/env node
// HumanSignal's public contributor-community listings live on the same
// Greenhouse board as their corporate hiring (job-boards.greenhouse.io/
// humansignal), reachable via Greenhouse's standard public JSON API. The
// board's `departments` field cleanly separates the two: department id
// 4107655004 ("AI Trainers") is the actual contributor-community work;
// everything else (Human Data Services, Operations) is regular corporate
// hiring and is excluded.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'data-annotation-contributor-community';
const API_URL = 'https://boards-api.greenhouse.io/v1/boards/humansignal/jobs?content=true';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';
const AI_TRAINERS_DEPARTMENT_ID = 4107655004;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Greenhouse API returned ${res.status}`);
  const data = await res.json();
  const relevant = data.jobs.filter((j) => j.departments?.some((d) => d.id === AI_TRAINERS_DEPARTMENT_ID));
  console.log(`[${PROVIDER_SLUG}] fetched ${relevant.length} AI Trainers roles (of ${data.jobs.length} on the shared Greenhouse board).`);

  const now = new Date().toISOString();
  const rows = relevant.map((j) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(j.id),
    title: stripHtml(j.title) || null,
    description: stripHtml(j.content).slice(0, 2000) || null,
    pay_text: null,
    location: j.location?.name ?? null,
    category: null,
    apply_url: j.absolute_url,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
