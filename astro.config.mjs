// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

import providers from './src/data/providers.json' with { type: 'json' };
import { getNoindexRolePaths, getRoleLastmodMap } from './src/lib/roles.ts';

// Fetched once at config-eval time so the sitemap can (a) explicitly
// exclude non-indexable URLs — /go/ (defense in depth; previously only
// incidental via prerender:false) and grace-window "no longer listed" role
// pages — and (b) emit accurate per-page lastmod so Google prioritizes
// crawling the fast-changing /roles/* section over the rarely-changing
// /providers/* pages. This is a second Supabase round-trip beyond the ones
// inside each route's own getStaticPaths (config and pages evaluate
// independently in Astro) — at ~1,362 rows and a once-daily build cadence
// this isn't worth optimizing away for v1.
const noindexRolePaths = await getNoindexRolePaths();
const roleLastmod = await getRoleLastmodMap();
// Trailing slash matters: Astro emits /providers/[slug]/index.html, so the
// sitemap's actual pathname is "/providers/slug/" — a bare "/providers/slug"
// key here would silently never match. Every provider (any tier) now has a
// /providers/[slug]/ page, not just the expert tier.
const providerLastmod = new Map(
  providers.map((p) => [`/providers/${p.slug}/`, p.lastChecked])
);
const latestRoleLastmod = [...roleLastmod.values()].sort().at(-1);

// https://astro.build/config
export default defineConfig({
  site: 'https://www.humansourcer.com',
  // Gig and Providers used to be separate route trees (/gig/*, /restricted/*,
  // /providers/*); they're now amalgamated under /providers/ with tier-scoped
  // listings (/providers/gig/, /providers/experts/, /providers/restricted/)
  // and one flat /providers/[slug] detail namespace. These 301s preserve any
  // link equity/indexing the old paths already have.
  redirects: {
    '/providers': '/',
    '/gig': '/providers/gig',
    '/gig/[slug]': '/providers/[slug]',
    '/restricted': '/providers/restricted',
    '/restricted/[slug]': '/providers/[slug]',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        if (path.startsWith('/go/')) return false;
        if (path === '/roles-data.json') return false;
        if (noindexRolePaths.has(path)) return false;
        return true;
      },
      serialize: (item) => {
        const path = new URL(item.url).pathname;
        if (roleLastmod.has(path)) return { ...item, lastmod: roleLastmod.get(path) };
        if (providerLastmod.has(path)) return { ...item, lastmod: providerLastmod.get(path) };
        // Hub pages + the base /roles/ index: no single precise lastmod,
        // but the freshest role's timestamp is a reasonable approximation —
        // still good enough to signal "this section changes daily" to Google.
        if (path.startsWith('/roles') && latestRoleLastmod) return { ...item, lastmod: latestRoleLastmod };
        return item;
      },
    }),
    preact(),
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: vercel()
});