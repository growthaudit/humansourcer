#!/usr/bin/env node
// Handshake AI's opportunities page is a Framer site. The job list is NOT in
// the server-rendered HTML at all — it's hydrated client-side from Framer's
// proprietary binary CMS format (`*.framercms` files hosted on
// framerusercontent.com), fetched by a JS module whose collection-id/hash
// path segments change on every Framer republish. So each run we: (1) fetch
// the page HTML, (2) fetch every modulepreload'd JS chunk until we find the
// one whose code declares the "Opport..." (Opportunities) CMS collection and
// extract its current {collectionId}/{hash}/{basename} path from that
// module's source (same "re-derive the moving id" approach scrape-mercor.mjs
// uses for its Next.js buildId), then (3) fetch and parse the binary chunk.
//
// The binary format is an internal, undocumented Framer format (not JSON).
// Field names in each record are opaque per-collection IDs (e.g. "Hi7WvygoG"
// happens to be the title field for this collection) rather than semantic
// keys, and they are constant across records/deploys as long as the
// collection's schema doesn't change. We anchor on the byte offsets of a
// handful of these opaque field-id tokens (found by manual inspection) to
// pull out slug/title/short-description/pay per record. If Handshake changes
// this collection's schema those anchors will need to be re-derived by
// re-inspecting a fresh chunk (grep the binary for a known title string and
// look at the ~9-char token immediately preceding it).
//
// Every role on this board pays hourly with an explicit "up to $X/hr" cap, so
// that number is mapped to pay_max (not pay_min) with pay_min left null.
// Location/category are not reliably present per-record in this collection
// (only degree-level filter tags, which aren't extracted here), so both are
// left null rather than guessed.
import { createClient } from '@supabase/supabase-js';
import { upsertRoles } from './lib/upsert-roles.mjs';

const PROVIDER_SLUG = 'handshake-ai';
const PAGE_URL = 'https://joinhandshake.com/ai/opportunities';
const HEADERS = { 'user-agent': 'HumanSourcer-Scraper/1.0 (+https://www.humansourcer.com)' };

// Opaque per-collection field-id tokens (see comment above).
const FIELD = {
  slug: 'Vt3dK5Eel',
  title: 'Hi7WvygoG',
  description: 'y2vadTbOm',
  payMax: 'WFQUwsB06',
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findCmsChunkUrl() {
  const pageRes = await fetch(PAGE_URL, { headers: HEADERS });
  if (!pageRes.ok) throw new Error(`Handshake page returned ${pageRes.status}`);
  const html = await pageRes.text();

  const moduleUrls = [...html.matchAll(/modulepreload"[^>]*href="([^"]+\.mjs)"/g)].map((m) => m[1]);
  if (moduleUrls.length === 0) throw new Error('No modulepreload script tags found on Handshake opportunities page');

  for (const url of moduleUrls) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) continue;
    const js = await res.text();
    if (!js.includes('Opport')) continue;
    const m = js.match(/([A-Za-z0-9_-]{16,32})\/([A-Za-z0-9_-]{16,32})\/([A-Za-z0-9_]+)\.js`\)\.href\.replace\(`\/modules\/`,`\/cms\/`\)/);
    if (m) {
      const [, collectionId, hash, basename] = m;
      return `https://framerusercontent.com/cms/${collectionId}/${hash}/${basename}-chunk-default-0.framercms`;
    }
  }
  throw new Error('Could not locate the Opportunities CMS collection module on the Handshake page');
}

function readStringAfterKey(buf, keyStart, key) {
  const idx = buf.indexOf(key, keyStart);
  if (idx === -1) return { value: null, next: -1 };
  const p = idx + key.length;
  const type = buf[p];
  if (type !== 0x0c) return { value: null, next: idx + 1 };
  const length = buf.readUInt32BE(p + 1);
  const value = buf.toString('utf8', p + 5, p + 5 + length);
  return { value, next: idx + 1 };
}

function readFloatAfterKey(buf, keyStart, key) {
  const idx = buf.indexOf(key, keyStart);
  if (idx === -1) return null;
  const p = idx + key.length;
  const type = buf[p];
  if (type !== 0x08) return null;
  return buf.readDoubleBE(p + 1);
}

function parseRecords(buf) {
  const slugKey = Buffer.from(FIELD.slug);
  const titleKey = Buffer.from(FIELD.title);
  const descKey = Buffer.from(FIELD.description);
  const payKey = Buffer.from(FIELD.payMax);
  const applyRe = /hai_job_id=(\d+)/;

  const positions = [];
  let idx = buf.indexOf(slugKey);
  while (idx !== -1) {
    positions.push(idx);
    idx = buf.indexOf(slugKey, idx + slugKey.length);
  }

  const records = [];
  for (let i = 0; i < positions.length; i += 1) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : buf.length;
    const chunk = buf.subarray(start, end);

    const slug = readStringAfterKey(chunk, 0, slugKey).value;
    const title = readStringAfterKey(chunk, 0, titleKey).value;
    const description = readStringAfterKey(chunk, 0, descKey).value;
    const payMax = readFloatAfterKey(chunk, 0, payKey);
    const applyMatch = chunk.toString('latin1').match(applyRe);

    if (!slug || !title) continue;
    records.push({
      slug,
      title,
      description,
      payMax,
      jobId: applyMatch ? applyMatch[1] : null,
    });
  }
  return records;
}

async function main() {
  const chunkUrl = await findCmsChunkUrl();
  const res = await fetch(chunkUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`Handshake CMS chunk returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const records = parseRecords(buf);
  console.log(`[${PROVIDER_SLUG}] fetched ${records.length} roles.`);

  const now = new Date().toISOString();
  const rows = records.map((r) => ({
    provider_slug: PROVIDER_SLUG,
    source_role_id: r.slug,
    title: r.title,
    description: r.description ? r.description.slice(0, 2000) : null,
    pay_text: r.payMax != null ? `Up to $${r.payMax}/hr` : null,
    pay_min: null,
    pay_max: r.payMax,
    pay_currency: r.payMax != null ? 'USD' : null,
    pay_unit: r.payMax != null ? 'hour' : null,
    location: null,
    category: null,
    apply_url: r.jobId
      ? `https://app.joinhandshake.com/signup?destination_hai_path=%2Fauth&hai_job_id=${r.jobId}`
      : PAGE_URL,
    last_seen_at: now,
    is_active: true,
  }));

  await upsertRoles(supabase, PROVIDER_SLUG, rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
