#!/usr/bin/env node
// OneForma's /jobs/ page is a WordPress site with a custom "job" post type
// exposed via the standard WP REST API (found via /wp-json/wp/v2/types).
// Each post is one project; acf.apply_job lists the per-language apply URLs
// (there's no single per-role apply link, so apply_url falls back to the
// post's own public page, which lists every language option). job_type is a
// clean taxonomy (Annotation, Translation, Judging, ...); job_tag mixes pay
// structure/location/misc labels too inconsistently to map cleanly, so it's
// left alone.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles, stripHtml } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'oneforma';
const BASE = 'https://www.oneforma.com/wp-json/wp/v2';
const UA = 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`OneForma API ${url} returned ${res.status}`);
  return res.json();
}

async function fetchJobTypeNames() {
  const types = await fetchJson(`${BASE}/job_type?per_page=100`);
  return new Map(types.map((t) => [t.id, t.name]));
}

async function fetchAllJobs() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const res = await fetch(`${BASE}/job?per_page=100&page=${page}`, { headers: { 'user-agent': UA } });
    if (res.status === 400) break; // WP REST returns 400 past the last page
    if (!res.ok) throw new Error(`OneForma job API returned ${res.status}`);
    const jobs = await res.json();
    if (jobs.length === 0) break;
    all.push(...jobs);
    if (jobs.length < 100) break;
  }
  return all;
}

async function main() {
  const [jobTypeNames, jobs] = await Promise.all([fetchJobTypeNames(), fetchAllJobs()]);
  const published = jobs.filter((j) => j.status === 'publish');
  console.log(`[${PROVIDER_SLUG}] fetched ${published.length} published projects.`);

  const now = new Date().toISOString();
  const rows = published.map((job) => {
    const languages = (job.acf?.apply_job ?? []).map((a) => a.language).filter(Boolean);
    return {
      provider_slug: PROVIDER_SLUG,
      source_role_id: String(job.id),
      title: stripHtml(job.title?.rendered) || null,
      description: stripHtml(job.content?.rendered).slice(0, 2000) || null,
      pay_text: null,
      location: languages.length ? languages.join(', ') : null,
      category: (job.job_type ?? []).map((id) => jobTypeNames.get(id)).filter(Boolean).join(', ') || null,
      apply_url: job.link,
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
