#!/usr/bin/env node
// Checks every workerUrl / relationshipEvidenceUrl / statusEvidenceUrl in
// providers.json for dead or redirected links. Run before each weekly
// content update (and eventually in CI) — the Alignerr URL that changed to
// /en/jobs is exactly the kind of drift this exists to catch automatically
// instead of relying on someone noticing a 404 in production.
//
// Usage: node scripts/check-links.mjs [--json]

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/data/providers.json');
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;
const AS_JSON = process.argv.includes('--json');

const FIELDS = [
  ['workerUrl', 'worker URL'],
  ['relationshipEvidenceUrl', 'relationship evidence'],
  ['statusEvidenceUrl', 'status evidence'],
];

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'HumanSourcer-LinkChecker/1.0' },
    });
    // Some sites reject HEAD (405/403) but serve GET fine — retry before flagging.
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'HumanSourcer-LinkChecker/1.0' },
      });
    }
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      redirected: res.url !== url,
    };
  } catch (err) {
    return { ok: false, status: null, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const providers = JSON.parse(await readFile(DATA_PATH, 'utf-8'));

  const checks = [];
  for (const provider of providers) {
    for (const [field, label] of FIELDS) {
      checks.push({ providerId: provider.id, slug: provider.slug, field, label, url: provider[field] });
    }
  }

  if (!AS_JSON) {
    console.log(`Checking ${checks.length} URLs across ${providers.length} providers...\n`);
  }

  const results = await mapWithConcurrency(checks, CONCURRENCY, async (check) => ({
    ...check,
    ...(await checkUrl(check.url)),
  }));

  const broken = results.filter((r) => !r.ok);
  const redirected = results.filter((r) => r.ok && r.redirected);

  if (AS_JSON) {
    console.log(JSON.stringify({ broken, redirected, total: results.length }, null, 2));
  } else {
    if (redirected.length) {
      console.log(`REDIRECTED (${redirected.length}) — data likely stale, consider updating the stored URL:\n`);
      for (const r of redirected) {
        console.log(`  ${r.providerId} ${r.slug} [${r.label}]`);
        console.log(`    stored:  ${r.url}`);
        console.log(`    resolves to: ${r.finalUrl}\n`);
      }
    }

    if (broken.length) {
      console.log(`BROKEN (${broken.length}):\n`);
      for (const r of broken) {
        console.log(`  ${r.providerId} ${r.slug} [${r.label}] — ${r.status ?? r.error}`);
        console.log(`    ${r.url}\n`);
      }
    }

    if (!broken.length && !redirected.length) {
      console.log('All URLs OK, no redirects.');
    }

    console.log(`\n${results.length - broken.length}/${results.length} URLs reachable.`);
  }

  process.exit(broken.length > 0 ? 1 : 0);
}

main();
