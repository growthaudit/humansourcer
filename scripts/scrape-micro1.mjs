#!/usr/bin/env node
// micro1's opportunities page (/experts/opportunities) is a Webflow page whose
// job list is rendered entirely client-side by an inline embed script that
// POSTs to prod-api.micro1.ai — there is no server-rendered HTML or GET
// endpoint (a plain GET 404s; the request must be a POST with a JSON body).
// The API returns clean structured JSON (hourly rate min/max, skills,
// per-role apply URL), so this is effectively a full scrape once you know
// the right verb. `location_type`/`engagement_type` are frequently null in
// the source data itself, not a scraping gap.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'micro1-experts-opportunities';
const API_URL = 'https://prod-api.micro1.ai/api/v1/job/portal';
const PAGE_LIMIT = 100;
const HEADERS = {
  'content-type': 'application/json',
  'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)',
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchPage(page) {
  const res = await fetch(`${API_URL}?page=${page}&limit=${PAGE_LIMIT}&keyword=`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ action: 'get_all_jobs', filters: { type: ['EXPERT'] } }),
  });
  if (!res.ok) throw new Error(`micro1 job portal API returned ${res.status}`);
  const json = await res.json();
  if (!json.status) throw new Error(`micro1 job portal API error: ${json.message}`);
  return json;
}

function formatPay(rate) {
  if (!rate || (rate.min == null && rate.max == null)) return null;
  if (rate.min != null && rate.max != null) return `$${rate.min}-${rate.max}/hr`;
  const only = rate.min ?? rate.max;
  return `$${only}/hr`;
}

async function main() {
  const jobs = [];
  let page = 1;
  let total = Infinity;
  while (jobs.length < total) {
    const json = await fetchPage(page);
    total = json.total ?? json.data.length;
    jobs.push(...json.data);
    if (json.data.length === 0) break;
    page += 1;
  }
  console.log(`[${PROVIDER_SLUG}] fetched ${jobs.length} of ${total} roles.`);

  const now = new Date().toISOString();
  const rows = jobs.map((job) => {
    const rate = job.ideal_hourly_rate;
    return {
      provider_slug: PROVIDER_SLUG,
      source_role_id: job.job_id,
      title: job.job_name,
      description: job.skills?.length ? `Skills: ${job.skills.join(', ')}`.slice(0, 2000) : null,
      pay_text: formatPay(rate),
      pay_min: rate?.min ?? null,
      pay_max: rate?.max ?? null,
      pay_currency: rate ? 'USD' : null,
      pay_unit: rate ? 'hour' : null,
      location: job.location_type ?? null,
      category: job.domain_slug ?? null,
      apply_url: job.apply_url,
      last_seen_at: now,
      is_active: true,
    };
  });

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
