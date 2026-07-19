// Shared upsert + stale-marking logic used by every per-source scraper.
// A role missing from the latest scrape is marked is_active=false rather
// than deleted, so removal is detectable without losing scrape history.

export async function upsertRoles(supabase, providerSlug, rows) {
  if (rows.length === 0) {
    console.warn(`[${providerSlug}] fetched 0 roles — skipping upsert/stale-marking to avoid wiping existing data on a transient empty response.`);
    return;
  }

  // Defensive de-dupe: some sources (e.g. the same job cross-posted to
  // multiple locations) return duplicate source_role_id values in one
  // batch, which a single upsert call rejects outright.
  const byId = new Map(rows.map((r) => [r.source_role_id, r]));
  const deduped = [...byId.values()];
  if (deduped.length !== rows.length) {
    console.warn(`[${providerSlug}] de-duped ${rows.length - deduped.length} rows sharing a source_role_id.`);
  }

  const { error: upsertError } = await supabase
    .from('roles')
    .upsert(deduped, { onConflict: 'provider_slug,source_role_id' });
  if (upsertError) throw upsertError;
  console.log(`[${providerSlug}] upserted ${deduped.length} roles.`);

  const seenIds = deduped.map((r) => r.source_role_id);
  const { error: staleError, count } = await supabase
    .from('roles')
    .update({ is_active: false }, { count: 'exact' })
    .eq('provider_slug', providerSlug)
    .eq('is_active', true)
    .not('source_role_id', 'in', `(${seenIds.map((id) => `"${id}"`).join(',')})`);
  if (staleError) throw staleError;
  console.log(`[${providerSlug}] marked ${count ?? 0} previously-active roles as inactive.`);
}

export function stripHtml(html) {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
