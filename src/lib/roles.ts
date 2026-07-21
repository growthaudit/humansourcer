// Build-time only: reads scraped roles from Supabase using the publishable
// key (auto-injected by Vercel's Supabase integration as
// NEXT_PUBLIC_STORAGE_SUPABASE_URL / STORAGE_SUPABASE_PUBLISHABLE_KEY). Safe
// to use here since RLS only exposes is_active=true rows (plus recently
// inactive ones within the grace window below) to that key — see the
// "public can read active or recently inactive roles" policy. Writes (the
// scrape scripts) use the service_role key instead, kept in .env.local only,
// never in Vercel.
//
// Roles now DO get their own indexable URLs under /roles/ (a deliberate
// reversal of the original inline-only decision — see the humansourcer
// project plan for the thin/duplicate-content mitigations that made this
// safe: composed descriptions, careful JobPosting field mapping, and the
// grace-window handling below). getActiveRolesByProvider() still powers the
// inline "Open roles" section on provider pages; getAllRolesForPages() is
// the new function powering every /roles/* route plus the sitemap.

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export interface Role {
  provider_slug: string;
  source_role_id: string;
  title: string;
  description: string | null;
  pay_text: string | null;
  location: string | null;
  category: string | null;
  apply_url: string;
}

export interface FullRole extends Role {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_unit: string | null;
}

export interface ProviderRoles {
  roles: Role[];
  totalCount: number;
}

// How long an inactive role's page keeps rendering (as a "no longer listed"
// variant, noindex'd) before it stops being generated at all. Long enough to
// avoid an abrupt 404/link-equity loss, short enough that the site doesn't
// accumulate stale listings.
const GRACE_WINDOW_DAYS = 14;

export function getSupabaseCredentials(): { url: string; key: string } | null {
  // Checked in two places: import.meta.env (Vite's injection, populated
  // when this module is loaded through an actual Astro page/SSR context)
  // and process.env (populated directly by Vercel's Supabase integration at
  // build time, AND the only one available when this module is imported
  // from astro.config.mjs — that file runs in plain Node *before* Vite
  // starts, so import.meta.env is never populated there even though the
  // values are genuinely available via process.env).
  const env = typeof process !== 'undefined' ? process.env : {};
  const url =
    import.meta.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL ??
    import.meta.env.SUPABASE_URL ??
    env.NEXT_PUBLIC_STORAGE_SUPABASE_URL ??
    env.SUPABASE_URL;
  const key =
    import.meta.env.STORAGE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ??
    env.STORAGE_SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Deterministic, stable across scrapes because it's keyed off source_role_id
// (part of the DB's own unique constraint), not off content that changes.
// If a role is retitled between scrapes the slug DOES change — the old URL
// simply stops being generated on the next build (same clean-removal
// mechanism as an expired role), no redirect-map infra in v1.
export function roleSlug(title: string, providerSlug: string, sourceRoleId: string): string {
  const hash = createHash('sha1').update(`${providerSlug}:${sourceRoleId}`).digest('hex').slice(0, 8);
  return `${slugify(title)}-${hash}`;
}

export function rolePagePath(role: Pick<Role, 'provider_slug' | 'title' | 'source_role_id'>): string {
  return `/roles/${role.provider_slug}/${roleSlug(role.title, role.provider_slug, role.source_role_id)}/`;
}

// Cap how many roles render inline per provider page. Some sources (e.g.
// Meridial, Mindrift) have 800-1000+ active listings — rendering all of them
// into one static page would bloat that page's HTML well beyond what's
// reasonable for load speed. Full counts stay in Supabase; the page shows a
// "showing N of TOTAL" note pointing at the source for the rest.
const MAX_ROLES_PER_PROVIDER = 30;

// Supabase/PostgREST caps a single response at 1000 rows by default —
// page through with .range() until a page comes back short of the page
// size. Shared by every fetch function below.
async function fetchAllPages<T>(
  supabase: ReturnType<typeof createClient>,
  select: string,
  applyFilters: (query: any) => any
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await applyFilters(
      supabase.from('roles').select(select).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    );
    if (error) {
      console.warn('Failed to fetch roles from Supabase:', error.message);
      return all;
    }
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return all;
}

export async function getActiveRolesByProvider(): Promise<Map<string, ProviderRoles>> {
  const byProvider = new Map<string, ProviderRoles>();
  const creds = getSupabaseCredentials();
  // No Supabase config at build time (e.g. a contributor's local build) —
  // degrade to no roles rather than failing the whole site build.
  if (!creds) return byProvider;

  const supabase = createClient(creds.url, creds.key);
  const allRoles = await fetchAllPages<Role>(
    supabase,
    'provider_slug, source_role_id, title, description, pay_text, location, category, apply_url',
    (query) => query.eq('is_active', true).order('last_seen_at', { ascending: false })
  );

  for (const role of allRoles) {
    const entry = byProvider.get(role.provider_slug) ?? { roles: [], totalCount: 0 };
    entry.totalCount += 1;
    if (entry.roles.length < MAX_ROLES_PER_PROVIDER) entry.roles.push(role);
    byProvider.set(role.provider_slug, entry);
  }
  return byProvider;
}

const FULL_ROLE_SELECT =
  'id, provider_slug, source_role_id, title, description, pay_text, location, category, apply_url, first_seen_at, last_seen_at, is_active, pay_min, pay_max, pay_currency, pay_unit';

let allRolesCache: Promise<FullRole[]> | null = null;

// Every active role, plus inactive roles still inside the grace window
// (reachable via the "public can read active or recently inactive roles"
// RLS policy). Powers every /roles/* route and the sitemap config — cached
// per build so the config's own fetch (astro.config.mjs) and each route's
// getStaticPaths don't each pay for a separate full table scan.
export async function getAllRolesForPages(): Promise<FullRole[]> {
  if (allRolesCache) return allRolesCache;
  allRolesCache = (async () => {
    const creds = getSupabaseCredentials();
    if (!creds) return [];
    const supabase = createClient(creds.url, creds.key);
    return fetchAllPages<FullRole>(supabase, FULL_ROLE_SELECT, (query) =>
      query.order('last_seen_at', { ascending: false })
    );
  })();
  return allRolesCache;
}

function isInGraceWindow(role: FullRole): boolean {
  if (role.is_active) return false;
  const lastSeen = new Date(role.last_seen_at).getTime();
  return Date.now() - lastSeen < GRACE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// Paths that exist as real pages (grace-window "no longer listed" roles)
// but should never appear in the sitemap. Kept here rather than duplicated
// in astro.config.mjs so the exclusion set can't drift from the pages'
// own is_active/grace-window logic.
export async function getNoindexRolePaths(): Promise<Set<string>> {
  const roles = await getAllRolesForPages();
  return new Set(roles.filter(isInGraceWindow).map(rolePagePath));
}

// pathname -> ISO lastmod, for every indexable role page (active only —
// grace-window pages are excluded from the sitemap entirely, see above).
export async function getRoleLastmodMap(): Promise<Map<string, string>> {
  const roles = await getAllRolesForPages();
  const map = new Map<string, string>();
  for (const role of roles) {
    if (role.is_active) map.set(rolePagePath(role), role.last_seen_at);
  }
  return map;
}
