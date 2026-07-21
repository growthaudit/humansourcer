#!/usr/bin/env node
// DataForce jobs (community.transperfect.com/jobs) is a Teamtailor-hosted
// career site. Teamtailor publishes a standard JSON Feed (jsonfeed.org) at
// /jobs.json, with each item's `_jobposting` field carrying full schema.org
// JobPosting data (description, jobLocation) — no API key needed, no HTML
// parsing required. Follow `next_url` until it's null. No item in this feed
// carries baseSalary, so pay_text stays null rather than guessing.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'dataforce-jobs';
const FEED_URL = 'https://community.transperfect.com/jobs.json?per_page=100';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllItems() {
  const all = [];
  let url = FEED_URL;
  while (url) {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!res.ok) throw new Error(`DataForce jobs.json returned ${res.status}`);
    const feed = await res.json();
    all.push(...feed.items);
    url = feed.next_url ?? null;
  }
  return all;
}

function locationFor(jobposting) {
  const place = jobposting?.jobLocation?.[0]?.address;
  if (!place) return null;
  return [place.addressLocality, place.addressCountry].filter(Boolean).join(', ') || null;
}

async function main() {
  const items = await fetchAllItems();
  console.log(`[${PROVIDER_SLUG}] fetched ${items.length} roles from the JSON feed.`);

  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: item.id,
    title: stripHtml(item.title) || null,
    description: stripHtml(item._jobposting?.description).slice(0, 2000) || null,
    pay_text: null,
    location: locationFor(item._jobposting),
    category: null,
    apply_url: item.url,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
