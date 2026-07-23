#!/usr/bin/env node
// CrowdGen (Appen's crowd-contributor brand) links out to a Lever board
// hosted under Appen's account (jobs.lever.co/appen), reachable via Lever's
// standard public JSON API. That account also carries unrelated Appen
// corporate hiring — filtered here to just the "AI Trainers - Domain
// Experts" department, which is the actual CrowdGen contributor work.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'crowdgen';
const API_URL = 'https://api.lever.co/v0/postings/appen?mode=json';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';
const RELEVANT_DEPARTMENT = 'AI Trainers - Domain Experts';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Lever API returned ${res.status}`);
  const postings = await res.json();
  const relevant = postings.filter((p) => p.categories?.department === RELEVANT_DEPARTMENT);
  console.log(`[${PROVIDER_SLUG}] fetched ${relevant.length} CrowdGen roles (of ${postings.length} on the shared Lever board).`);

  const now = new Date().toISOString();
  const rows = relevant.map((p) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: p.id,
    title: stripHtml(p.text) || null,
    description: stripHtml(p.descriptionPlain).slice(0, 2000) || null,
    pay_text: null,
    location: p.categories?.location ?? null,
    category: p.categories?.team ?? null,
    apply_url: p.hostedUrl,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
