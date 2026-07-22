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

// Every English-language posting states its hourly rate in a "Pay Rate:"
// line in the body copy (e.g. "Pay Rate: Based on tasks (approximately $9
// per hour)", "Pay Rate: $18.00/hour", "Pay Rate: $26 - $28/hour"). Only
// English postings are parsed here — non-English variants (e.g. Dutch
// "Salaris", Finnish "Palkkaus") use different wording per-locale and are
// left as pay_text: null rather than guessing at translations.
function extractHourlyPay(descriptionPlain) {
  const line = (descriptionPlain ?? '').match(/Pay\s*Rate:\s*([^\n]*(?:hour|hr)[^\n]*)/i)?.[1]?.trim();
  if (!line) return { pay_text: null, pay_min: null, pay_max: null, pay_currency: null, pay_unit: null };

  const amounts = [...line.matchAll(/\$\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
  if (amounts.length === 0) return { pay_text: line, pay_min: null, pay_max: null, pay_currency: null, pay_unit: null };

  return {
    pay_text: line,
    pay_min: Math.min(...amounts),
    pay_max: Math.max(...amounts),
    pay_currency: 'USD',
    pay_unit: 'HOURLY',
  };
}

async function main() {
  const res = await fetch(API_URL, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Lever API returned ${res.status}`);
  const postings = await res.json();
  const relevant = postings.filter((p) => RELEVANT_DEPARTMENTS.has(p.categories?.department));
  console.log(`[${PROVIDER_SLUG}] fetched ${relevant.length} Welo Data roles (of ${postings.length} on the shared Lever board).`);

  const now = new Date().toISOString();
  const rows = relevant.map((p) => {
    const pay = extractHourlyPay(p.descriptionPlain);
    return {
      provider_slug: PROVIDER_SLUG,
      source_role_id: p.id,
      title: stripHtml(p.text) || null,
      description: stripHtml(p.descriptionPlain).slice(0, 2000) || null,
      pay_text: pay.pay_text,
      pay_min: pay.pay_min,
      pay_max: pay.pay_max,
      pay_currency: pay.pay_currency,
      pay_unit: pay.pay_unit,
      location: p.categories?.location || p.country || null,
      category: p.categories?.team ?? null,
      apply_url: p.hostedUrl,
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
