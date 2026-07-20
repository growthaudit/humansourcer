#!/usr/bin/env node
// Surge Workforce (surgehq.ai/workforce) is a Webflow site whose "Current
// openings" list is server-rendered directly into the HTML as a Webflow CMS
// collection (no separate JSON API, no cheerio dependency in this repo — so
// we parse it with regex). Each item has a data-slug used both as the
// source_role_id and the per-role apply URL (/workforce/{slug}). The first
// item in the collection list is Webflow's empty-state template item with
// data-slug="" — it's filtered out. pay-rate here is typically a coarse
// label like "Contractor" rather than a numeric rate, so it only goes into
// pay_text, never pay_min/pay_max.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'surge-workforce';
const PAGE_URL = 'https://surgehq.ai/workforce';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const res = await fetch(PAGE_URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Surge page returned ${res.status}`);
  const html = await res.text();

  // Split the CMS list into individual item blocks.
  const itemRe = /<div data-slug="([^"]*)" role="listitem" class="wrf-content-main-cms-item w-dyn-item">/g;
  const starts = [];
  let m;
  while ((m = itemRe.exec(html)) !== null) {
    starts.push({ slug: m[1], index: m.index });
  }
  if (starts.length === 0) throw new Error('Could not find any Surge workforce job items');

  const now = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < starts.length; i++) {
    const { slug } = starts[i];
    if (!slug) continue; // Webflow empty-state template item
    const blockStart = starts[i].index;
    const blockEnd = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const block = html.slice(blockStart, blockEnd);

    const titleMatch = block.match(/<div data-job="title"[^>]*>(.*?)<\/div>/s);
    const title = titleMatch ? stripHtml(titleMatch[1]) : null;
    if (!title) continue;

    const payRateMatch = block.match(/<div data-job="pay-rate"[^>]*>(.*?)<\/div>/s);
    const payRate = payRateMatch ? stripHtml(payRateMatch[1]) : '';

    const subtitleMatch = block.match(/<div data-job="subtitle"[^>]*>(.*?)<\/div>/s);
    const subtitle = subtitleMatch ? stripHtml(subtitleMatch[1]) : '';

    const aboutMatch = block.match(/<div data-job="about"[^>]*>([\s\S]*?)<\/div>\s*<div data-job="the-role"/);
    const about = aboutMatch ? stripHtml(aboutMatch[1]) : '';

    const description = [subtitle, about].filter(Boolean).join(' — ').slice(0, 2000) || null;

    rows.push({
      provider_slug: PROVIDER_SLUG,
      source_role_id: slug,
      title,
      description,
      pay_text: payRate || null,
      location: 'Remote',
      category: null,
      apply_url: new URL(`/workforce/${slug}`, PAGE_URL).toString(),
      last_seen_at: now,
      is_active: true,
    });
  }

  console.log(`[${PROVIDER_SLUG}] fetched ${rows.length} roles.`);
  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
