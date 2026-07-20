#!/usr/bin/env node
// Vetto has no per-role deep link in its public API, so apply_url points at
// the general opportunities listing page for every role from this source.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'vetto-opportunities';
const API_URL = 'https://api.vetto.ai/public/opportunities';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatPay(r) {
  if (!r) return null;
  const unit = { PER_PACKAGE: '/deliverable', HOURLY: '/h' }[r.unit] ?? '';
  if (r.min_value && r.max_value) return `$${r.min_value}-${r.max_value}${unit}`;
  if (r.min_value) return `$${r.min_value}${unit}`;
  return null;
}

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Vetto API returned ${res.status}`);
  const { data } = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${data.length} roles.`);

  const now = new Date().toISOString();
  const rows = data.map((job) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: job.id,
    title: job.title,
    description: (job.short_description ?? '').slice(0, 2000),
    pay_text: formatPay(job.remuneration),
    // Structured numeric pay, kept alongside the formatted pay_text above —
    // this is what powers JobPosting.baseSalary (see src/lib/jsonld.ts).
    pay_min: job.remuneration?.min_value ?? null,
    pay_max: job.remuneration?.max_value ?? null,
    pay_currency: job.remuneration?.min_value != null ? 'USD' : null,
    pay_unit: job.remuneration?.unit ?? null, // raw 'HOURLY' | 'PER_PACKAGE'
    location: null,
    category: job.knowledge_area ?? job.domain ?? null,
    apply_url: 'https://work.vetto.ai/opportunities',
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
