#!/usr/bin/env node
// Human's public API returns no per-role deep link or description, so
// apply_url points at the site's single signup flow for every role.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'human-expert-network';
const API_URL = 'https://www.joinhuman.org/api/roles';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' } });
  if (!res.ok) throw new Error(`Human API returned ${res.status}`);
  const { roles } = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${roles.length} roles.`);

  const now = new Date().toISOString();
  const rows = roles.map((role) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: role.id,
    title: role.title,
    description: null,
    pay_text: role.pay ?? null,
    location: role.location ?? null,
    category: role.department ?? null,
    apply_url: 'https://www.joinhuman.org/signup',
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
