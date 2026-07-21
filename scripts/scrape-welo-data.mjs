#!/usr/bin/env node
// Welo Data's "Join the community" page links out to a Lever board hosted
// under the parent company's account (jobs.lever.co/weloglobal), reachable
// via Lever's standard public JSON API. That single Lever account also
// carries unrelated Welocalize corporate hiring (Translation/Localization,
// Life Sciences, Early Careers, etc.) — filtered here to just the
// departments that are actually the Welo Data AI-training worker brand.
// Titles are legitimate role-x-language/country combinations (e.g. "Ads
// Quality Rater - Bulgarian (Bulgaria)"), same pattern as several other
// already-scraped sources — not spam despite the large count.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'welo-data';
const API_URL = 'https://api.lever.co/v0/postings/weloglobal?mode=json';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';
const RELEVANT_DEPARTMENTS = new Set(['Welo Data - AI Services', 'Welo Data', 'Welo Global']);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Lever API returned ${res.status}`);
  const postings = await res.json();
  const relevant = postings.filter((p) => RELEVANT_DEPARTMENTS.has(p.categories?.department));
  console.log(`[${PROVIDER_SLUG}] fetched ${relevant.length} Welo Data roles (of ${postings.length} on the shared Lever board).`);

  const now = new Date().toISOString();
  const rows = relevant.map((p) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: p.id,
    title: stripHtml(p.text) || null,
    description: stripHtml(p.descriptionPlain).slice(0, 2000) || null,
    pay_text: null,
    location: p.categories?.location || p.country || null,
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
