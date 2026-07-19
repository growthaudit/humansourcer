#!/usr/bin/env node
// Alignerr's job list is server-rendered into __NEXT_DATA__ rather than a
// clean JSON API. Only the first page (~60 of several thousand) is available
// this way; the rest sits behind a client-side "load more" call we have not
// reverse-engineered. Scraping the first page is still a meaningful, honest
// subset — same caveat as Turing's "suggested" endpoint.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'alignerr';
const PAGE_URL = 'https://www.alignerr.com/en/jobs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(PAGE_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Alignerr page returned ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('Could not find __NEXT_DATA__ on Alignerr jobs page');
  const data = JSON.parse(match[1]);
  const jobs = data.props.pageProps.initialJobs;
  const total = data.props.pageProps.initialTotal ?? jobs.length;
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} of ${total} total roles (first page only).`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.id,
    title: job.title,
    description: (job.description ?? '').slice(0, 2000),
    pay_text: job.pay ?? null,
    location: job.location ?? null,
    category: job.category ?? null,
    apply_url: new URL(job.applyUrl, PAGE_URL).toString(),
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
