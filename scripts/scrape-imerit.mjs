#!/usr/bin/env node
// iMerit Scholars runs on WordPress (Elementor + JetEngine), and does NOT have a
// "job"/"opening" post type with per-role pay/description — the closest analog is
// the "scholars-projects" custom post type (wp-json/wp/v2/scholars-projects),
// which lists broad *project categories* (e.g. "Text Analysis", "Mathematics")
// rather than individual job listings. There is no salary/pay data anywhere in
// this API. Every project ultimately funnels to the same generic Fillout
// application form, but each project has its own page, which we use as the
// per-role apply_url since it's the most specific link available. Domain,
// language and qualification taxonomy terms are folded into the description
// since there's no other body content on these posts.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'imerit-scholars';
const API_URL = 'https://join-scholars.imerit.net/wp-json/wp/v2/scholars-projects?per_page=100&_embed=1';
const HEADERS = { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function embeddedTerms(post, taxonomy) {
  const groups = post._embedded?.['wp:term'] ?? [];
  const flat = groups.flat();
  return flat.filter((t) => t.taxonomy === taxonomy).map((t) => t.name);
}

function buildDescription(post) {
  const parts = [];
  const domain = embeddedTerms(post, 'domain');
  const language = embeddedTerms(post, 'language');
  const qualification = embeddedTerms(post, 'qualification');
  if (domain.length) parts.push(`Domain: ${domain.join(', ')}`);
  if (language.length) parts.push(`Language: ${language.join(', ')}`);
  if (qualification.length) parts.push(`Preferred qualification: ${qualification.join(', ')}`);
  return parts.length ? parts.join('. ').slice(0, 2000) : null;
}

async function main() {
  const res = await fetch(API_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`iMerit Scholars API returned ${res.status}`);
  const posts = await res.json();
  console.log(`[${PROVIDER_SLUG}] fetched ${posts.length} roles.`);

  const now = new Date().toISOString();
  const rows = posts.map((post) => {
    const location = embeddedTerms(post, 'location');
    return {
      provider_slug: PROVIDER_SLUG,
      source_role_id: String(post.id),
      title: post.title?.rendered ?? null,
      description: buildDescription(post),
      pay_text: null,
      pay_min: null,
      pay_max: null,
      pay_currency: null,
      pay_unit: null,
      location: location.length ? location.join(', ') : null,
      category: 'Domain-expert GenAI training',
      apply_url: post.link ?? 'https://join-scholars.imerit.net/',
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
