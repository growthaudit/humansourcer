// Build-time only: reads scraped roles from Supabase using the publishable
// key (auto-injected by Vercel's Supabase integration as
// NEXT_PUBLIC_STORAGE_SUPABASE_URL / STORAGE_SUPABASE_PUBLISHABLE_KEY). Safe
// to use here since RLS only exposes is_active=true rows to that key — see
// the "public can read active roles" policy. Writes (the scrape scripts) use
// the service_role key instead, kept in .env.local only, never in Vercel.
// Roles render inline on existing provider pages rather than getting their
// own indexable URLs (see Phase 2 plan: avoids crawl-budget dilution and
// thin/duplicate-content risk from thousands of ephemeral listing pages).

import { createClient } from '@supabase/supabase-js';

export interface Role {
  provider_slug: string;
  title: string;
  description: string | null;
  pay_text: string | null;
  location: string | null;
  category: string | null;
  apply_url: string;
}

export interface ProviderRoles {
  roles: Role[];
  totalCount: number;
}

// Cap how many roles render inline per provider page. Some sources (e.g.
// Meridial, Mindrift) have 800-1000+ active listings — rendering all of them
// into one static page would bloat that page's HTML well beyond what's
// reasonable for load speed. Full counts stay in Supabase; the page shows a
// "showing N of TOTAL" note pointing at the source for the rest.
const MAX_ROLES_PER_PROVIDER = 30;

export async function getActiveRolesByProvider(): Promise<Map<string, ProviderRoles>> {
  const url = import.meta.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
  const key = import.meta.env.STORAGE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const byProvider = new Map<string, ProviderRoles>();

  if (!url || !key) {
    // No Supabase config at build time (e.g. a contributor's local build) —
    // degrade to no roles rather than failing the whole site build.
    return byProvider;
  }

  const supabase = createClient(url, key);

  // Supabase/PostgREST caps a single response at 1000 rows by default — with
  // 1000+ active roles across sources now, one query silently truncates and
  // (ordered by recency) drops whichever providers were scraped earliest.
  // Page through with .range() until a page comes back short of the page size.
  const PAGE_SIZE = 1000;
  const allRoles = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('roles')
      .select('provider_slug, title, description, pay_text, location, category, apply_url')
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      console.warn('Failed to fetch roles from Supabase:', error.message);
      return byProvider;
    }
    allRoles.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  for (const role of allRoles) {
    const entry = byProvider.get(role.provider_slug) ?? { roles: [], totalCount: 0 };
    entry.totalCount += 1;
    if (entry.roles.length < MAX_ROLES_PER_PROVIDER) entry.roles.push(role);
    byProvider.set(role.provider_slug, entry);
  }
  return byProvider;
}
