#!/usr/bin/env node
// Runs every per-source scraper as a child process. One source failing
// (e.g. a site changing its API) logs and continues rather than aborting
// the rest — a transient failure on one source shouldn't block the other
// nine from updating. Child processes (not dynamic import) because each
// scraper calls process.exit() on failure, which would otherwise kill this
// orchestrator too.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scrapers = [
  'scrape-turing.mjs',
  'scrape-vetto.mjs',
  'scrape-sepal.mjs',
  'scrape-human.mjs',
  'scrape-afterquery.mjs',
  'scrape-alignerr.mjs',
  'scrape-meridial.mjs',
  'scrape-mindrift.mjs',
  'scrape-g2i.mjs',
  'scrape-mercor.mjs',
  'scrape-surge.mjs',
  'scrape-hfc.mjs',
  'scrape-sme.mjs',
  'scrape-imerit.mjs',
  'scrape-micro1.mjs',
  'scrape-handshake.mjs',
  'scrape-telus-ai-community.mjs',
  'scrape-oneforma.mjs',
  'scrape-dataforce-community.mjs',
  'scrape-dataforce-jobs.mjs',
  'scrape-welo-data.mjs',
  'scrape-outlier.mjs',
  'scrape-crowdgen.mjs',
  'scrape-humansignal.mjs',
  'scrape-shaip.mjs',
  'scrape-datamundi.mjs',
  'scrape-stellar.mjs',
];

let failures = 0;
for (const file of scrapers) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failures += 1;
    console.error(`[${file}] FAILED (exit ${result.status})`);
  }
}

console.log(`\nDone. ${scrapers.length - failures}/${scrapers.length} sources succeeded.`);
process.exit(failures > 0 ? 1 : 0);
