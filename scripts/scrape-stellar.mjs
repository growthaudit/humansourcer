#!/usr/bin/env node
// Stellar's /apply/ page is a plain server-rendered Webflow page (no JS
// rendering needed, confirmed via curl) listing every open position as a
// `.position-card` anchor. No JSON API exists — parsed via regex on the
// static HTML, same no-cheerio convention as scrape-dataforce-community.mjs.
// There's no per-role description on this page, only title/rate/date.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'stellar';
const PAGE_URL = 'https://joinstellar.ai/apply/';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CARD_RE = /<a href="(\/apply\/[^"]+)" class="position-card">([\s\S]*?)<\/a>/g;
const TITLE_RE = /<h3 class="position-title">([\s\S]*?)<\/h3>/;
const RATE_RE = /<span class="position-rate">([\s\S]*?)<\/span>/;
const DATE_RE = /<span class="position-date">([\s\S]*?)<\/span>/;

async function main() {
  const res = await fetch(PAGE_URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Stellar apply page returned ${res.status}`);
  const html = await res.text();

  const rows = [];
  for (const match of html.matchAll(CARD_RE)) {
    const [, href, block] = match;
    const slug = href.replace(/^\/apply\//, '').replace(/\/$/, '');
    const title = stripHtml(TITLE_RE.exec(block)?.[1]);
    const rate = stripHtml(RATE_RE.exec(block)?.[1]) || null;
    const posted = stripHtml(DATE_RE.exec(block)?.[1]).replace(/^Posted\s+/, '') || null;
    rows.push({
      provider_slug: PROVIDER_SLUG,
      source_role_id: slug,
      title: title || null,
      description: posted ? `Posted ${posted}.` : null,
      pay_text: rate,
      location: null,
      category: null,
      apply_url: new URL(href, PAGE_URL).toString(),
      last_seen_at: new Date().toISOString(),
      is_active: true,
    });
  }
  console.log(`[${PROVIDER_SLUG}] fetched ${rows.length} open positions.`);

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
