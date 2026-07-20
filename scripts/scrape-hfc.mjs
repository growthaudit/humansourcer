#!/usr/bin/env node
// Human Frontier Collective (hfc.scale.com) is Next.js App Router, but —
// unlike the RSC-streaming-only pattern seen elsewhere — its /opportunities
// detail pages are fully server-rendered into plain HTML, so no __next_f
// chunk parsing is needed; a regex over the rendered markup is enough.
//
// The public /opportunities hub shows 7 domain cards (Medical, Math,
// Computer Science & ML, Physics, Chemistry, Law, Biology) but Math,
// Physics, Chemistry, and Biology all link to the SAME underlying page,
// /opportunities/stem — there is one generic "STEM Fellow" posting behind
// all four labels, not four distinct roles. So the site truly only exposes
// 4 distinct Fellowship postings: medical, stem, machine-learning, legal.
// There is no listing endpoint or sitemap entry enumerating these slugs
// (confirmed via sitemap.xml, which only lists /opportunities itself), so
// the slug list below is hardcoded from what's linked on the hub page today
// — if HFC adds a new domain page this scraper won't discover it until the
// slug list is updated by hand.
//
// Each detail page links to a genuine per-role Greenhouse posting
// (job-boards.greenhouse.io/scaleai/jobs/...), which becomes apply_url.
// Pay is given as a plain-text range like "$80–$100/hr" — no structured
// numeric fields on the source — so it only goes into pay_text.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'human-frontier-collective-hfc';
const BASE_URL = 'https://hfc.scale.com';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

// Hardcoded because HFC's /opportunities hub has no machine-readable index —
// see comment above. Update this list if HFC adds/removes domain pages.
const SLUGS = ['medical', 'stem', 'machine-learning', 'legal'];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function decodeEntities(str) {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

async function fetchRole(slug) {
  const url = `${BASE_URL}/opportunities/${slug}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) {
    console.warn(`[${PROVIDER_SLUG}] ${url} returned ${res.status}, skipping.`);
    return null;
  }
  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : null;
  if (!title) {
    console.warn(`[${PROVIDER_SLUG}] could not find title on ${url}, skipping.`);
    return null;
  }

  const applyMatch = html.match(/href="(https:\/\/job-boards\.greenhouse\.io[^"]+)"/);
  const applyUrl = applyMatch ? applyMatch[1] : url;

  const payMatch = html.match(/Competitive Pay[^$]*(\$[\d,]+(?:[–-]\$?[\d,]+)?\/hr)/);
  const payText = payMatch ? decodeEntities(payMatch[1]) : null;

  const start = html.indexOf('Please note');
  const end = html.indexOf('Application Process');
  let description = null;
  if (start !== -1 && end !== -1) {
    const section = html.slice(start, end);
    description = decodeEntities(section.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
  }

  return {
    provider_slug: PROVIDER_SLUG,
    source_role_id: slug,
    title,
    description,
    pay_text: payText,
    location: 'Remote',
    category: title.replace(/\s*Fellow$/, ''),
    apply_url: applyUrl,
    is_active: true,
  };
}

async function main() {
  const now = new Date().toISOString();
  const results = await Promise.all(SLUGS.map(fetchRole));
  const rows = results.filter(Boolean).map((row) => ({ ...row, last_seen_at: now }));
  console.log(`[${PROVIDER_SLUG}] fetched ${rows.length} of ${SLUGS.length} known Fellowship postings.`);

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
