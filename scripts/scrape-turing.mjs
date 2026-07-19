#!/usr/bin/env node
// Scrapes Turing's public jobs API and upserts into Supabase `roles`.
// Roles no longer present in this run are marked is_active=false rather than
// deleted, so we can detect/reflect removal without losing scrape history.
//
// Run: node --env-file=.env.local scripts/scrape-turing.mjs

import { createClient } from '@supabase/supabase-js';

const PROVIDER_SLUG = 'turing-ai-advancement-work';
const API_URL = 'https://work.turing.com/api/jobs/all';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  console.log(`Fetching roles from Turing...`);
  const jobs = await fetchTuringJobs();
  console.log(`Fetched ${jobs.length} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: String(job.id),
    title: job.title,
    description: stripHtml(job.description ?? '').slice(0, 2000),
    pay_text: job.referralReward ? `Referral: $${job.referralReward}` : null,
    location: job.locationType ?? null,
    category: job.roleGroup ?? null,
    apply_url: `https://work.turing.com/jobs/${job.jobCode ?? job.id}`,
    last_seen_at: now,
    is_active: true,
  }));

  const { error: upsertError } = await supabase
    .from('roles')
    .upsert(rows, { onConflict: 'provider_slug,source_role_id' });
  if (upsertError) throw upsertError;
  console.log(`Upserted ${rows.length} roles.`);

  const seenIds = rows.map((r) => r.source_role_id);
  const { error: staleError, count } = await supabase
    .from('roles')
    .update({ is_active: false }, { count: 'exact' })
    .eq('provider_slug', PROVIDER_SLUG)
    .eq('is_active', true)
    .not('source_role_id', 'in', `(${seenIds.map((id) => `"${id}"`).join(',')})`);
  if (staleError) throw staleError;
  console.log(`Marked ${count ?? 0} previously-active roles as inactive (no longer listed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
