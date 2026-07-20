#!/usr/bin/env node
// Semi-automated puller for the Phase-1 trust-rating feature. Fetches
// whatever's technically reachable and prints a report to paste into
// providers.json by hand — ratings are a citable editorial claim like
// every other field in the registry, so this script never writes the
// file itself.
//
// Trustpilot's page carries an AggregateRating JSON-LD block in theory,
// but in practice trustpilot.com 403s plain server-side fetches (Cloudflare
// bot protection — confirmed even with a browser user-agent string). This
// script still tries it, in case that changes or a specific page is
// reachable, but treat Trustpilot as a manual-lookup source in practice,
// same as Glassdoor: visit the page yourself, copy the rating/review count
// shown, and cite the URL as trustpilotEvidenceUrl. Do not attempt to
// bypass the block (headless browser fingerprint spoofing etc.) — that
// crosses into bot-detection evasion.
//
// Google via the Places API has no such block and is the one source this
// script reliably automates. Glassdoor has no public API at all, so it's
// flagged as "research manually" rather than fetched.
//
// Add provider entries to scripts/rating-sources.mjs before running.
// Google lookups need GOOGLE_PLACES_API_KEY in .env.local (never commit it).
//
// Usage: node --env-file=.env.local scripts/fetch-ratings.mjs [slug...]
// With no args, checks every provider listed in rating-sources.mjs.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RATING_SOURCES } from './rating-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVIDERS_PATH = path.join(__dirname, '../src/data/providers.json');
const UA = 'HumanSourcer-RatingFetch/1.0 (+https://www.humansourcer.com)';

async function fetchTrustpilot(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Trustpilot returned ${res.status} for ${url}`);
  const html = await res.text();

  // Trustpilot embeds an AggregateRating in a JSON-LD <script> block on the
  // business profile page — no auth/API key needed to read it.
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, raw] of blocks) {
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of candidates) {
        const agg = entry.aggregateRating ?? (entry['@type'] === 'AggregateRating' ? entry : null);
        if (agg?.ratingValue) {
          return {
            rating: Number(agg.ratingValue),
            reviewCount: agg.reviewCount != null ? Number(agg.reviewCount) : null,
          };
        }
      }
    } catch {
      // not valid JSON-LD (or not the block we want) — keep scanning
    }
  }
  return null;
}

async function fetchGooglePlace(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('  GOOGLE_PLACES_API_KEY not set — skipping Google lookup.');
    return null;
  }
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total&key=${apiKey}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Google Places API returned ${res.status}`);
  const body = await res.json();
  if (body.status !== 'OK') throw new Error(`Google Places API status ${body.status}: ${body.error_message ?? 'no message'}`);
  const { rating, user_ratings_total: reviewCount } = body.result ?? {};
  if (rating == null) return null;
  return { rating: Number(rating), reviewCount: reviewCount ?? null };
}

function diffLine(label, fetched, existing) {
  if (!fetched) return null;
  const changed = existing == null || Math.abs(existing - fetched.rating) > 0.05;
  const flag = existing == null ? '(new)' : changed ? `(was ${existing})` : '(unchanged)';
  return `  ${label}: ${fetched.rating}${fetched.reviewCount != null ? ` (${fetched.reviewCount} reviews)` : ''} ${flag}`;
}

async function main() {
  const providers = JSON.parse(await readFile(PROVIDERS_PATH, 'utf-8'));
  const bySlug = new Map(providers.map((p) => [p.slug, p]));

  const requested = process.argv.slice(2);
  const slugs = requested.length > 0 ? requested : Object.keys(RATING_SOURCES);

  if (slugs.length === 0) {
    console.log('No entries in scripts/rating-sources.mjs yet — add providers there first.');
    return;
  }

  for (const slug of slugs) {
    const source = RATING_SOURCES[slug];
    const provider = bySlug.get(slug);
    if (!source) {
      console.warn(`[${slug}] no entry in rating-sources.mjs — skipping.`);
      continue;
    }
    if (!provider) {
      console.warn(`[${slug}] not found in providers.json — check the slug.`);
      continue;
    }

    console.log(`\n[${slug}] ${provider.workerBrand}`);

    if (source.trustpilotUrl) {
      try {
        const result = await fetchTrustpilot(source.trustpilotUrl);
        if (result) {
          console.log(diffLine('Trustpilot', result, provider.trustpilotRating));
          console.log(`    evidenceUrl: ${source.trustpilotUrl}`);
        } else {
          console.warn('  Trustpilot: no AggregateRating found on the page — check the URL is a business profile.');
        }
      } catch (err) {
        console.error(`  Trustpilot: ${err.message}`);
      }
    }

    if (source.googlePlaceId) {
      try {
        const result = await fetchGooglePlace(source.googlePlaceId);
        if (result) {
          console.log(diffLine('Google', result, provider.googleRating));
        } else {
          console.warn('  Google: place found but has no rating yet.');
        }
      } catch (err) {
        console.error(`  Google: ${err.message}`);
      }
    }

    if (provider.glassdoorRating == null) {
      console.log('  Glassdoor: not fetched (no public API) — research manually and add to providers.json.');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
