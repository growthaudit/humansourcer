#!/usr/bin/env node
// DataForce Community (TransPerfect) is a Drupal site; /projects is a
// server-rendered Views listing (no JSON:API enabled) paginated via
// ?project_type=All&page=N (0-indexed, page 0 is the default /projects
// URL). Parsed with regex per "views-row" block, same approach as the
// Surge scraper uses for its Webflow CMS list — no cheerio in this repo.
// Each row already encodes its country/variant in the title itself (e.g.
// "Viola Voice Collection - Australia"), so unlike SME Careers there's
// nothing to merge — every row is a genuinely distinct opening.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'dataforce-community';
const SITE = 'https://dataforcecommunity.transperfect.com';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';
const MAX_PAGES = 20; // safety cap; the site currently has 2 pages total

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function fieldValue(block, label) {
  const re = new RegExp(`<strong>${label}</strong><br>\\s*([^<]*)</p>`);
  const match = block.match(re);
  return match ? match[1].trim() || null : null;
}

function parseProjects(html) {
  const blocks = html.split('<div class="views-row">').slice(1);
  const projects = [];
  for (const block of blocks) {
    const titleMatch = block.match(/views-field-title"><h2 class="field-content">([^<]+)<\/h2>/);
    const title = titleMatch ? stripHtml(titleMatch[1]) : null;
    if (!title) continue;

    const descMatch = block.match(
      /views-field-field-description"><div class="field-content">([\s\S]*?)<\/div><\/div><div class="views-field views-field-nothing"/
    );
    const description = descMatch ? stripHtml(descMatch[1]).slice(0, 2000) || null : null;

    const linkMatch = block.match(/<a href="([^"]+)" class="button2">Preview Job<\/a>/);
    if (!linkMatch) continue;
    const path = linkMatch[1];
    const slug = path.split('/').filter(Boolean).pop();

    const category = fieldValue(block, 'Category');
    const type = fieldValue(block, 'Type');
    const country = fieldValue(block, 'Country');
    const city = fieldValue(block, 'City');
    const location = [city, country].filter(Boolean).join(', ') || type || null;

    projects.push({
      source_role_id: slug,
      title,
      description,
      location,
      category,
      apply_url: new URL(path, SITE).toString(),
    });
  }
  return projects;
}

async function main() {
  const all = [];
  const seen = new Set();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = page === 0 ? `${SITE}/projects` : `${SITE}/projects?project_type=All&page=${page}`;
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`DataForce Community page ${page} returned ${res.status}`);
    const html = await res.text();
    const projects = parseProjects(html);
    const fresh = projects.filter((p) => !seen.has(p.source_role_id));
    if (fresh.length === 0) break;
    for (const p of fresh) seen.add(p.source_role_id);
    all.push(...fresh);
  }
  console.log(`[${PROVIDER_SLUG}] fetched ${all.length} projects.`);

  const now = new Date().toISOString();
  const rows = all.map((p) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: p.source_role_id,
    title: p.title,
    description: p.description,
    pay_text: null,
    location: p.location,
    category: p.category,
    apply_url: p.apply_url,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
