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

export async function getActiveRolesByProvider(): Promise<Map<string, Role[]>> {
  const url = import.meta.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
  const key = import.meta.env.STORAGE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const byProvider = new Map<string, Role[]>();

  if (!url || !key) {
    // No Supabase config at build time (e.g. a contributor's local build) —
    // degrade to no roles rather than failing the whole site build.
    return byProvider;
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('roles')
    .select('provider_slug, title, description, pay_text, location, category, apply_url')
    .eq('is_active', true)
    .order('title');

  if (error) {
    console.warn('Failed to fetch roles from Supabase:', error.message);
    return byProvider;
  }

  for (const role of data ?? []) {
    const list = byProvider.get(role.provider_slug) ?? [];
    list.push(role);
    byProvider.set(role.provider_slug, list);
  }
  return byProvider;
}
