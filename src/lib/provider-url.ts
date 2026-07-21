// Central definition of provider URLs. All providers live under one flat
// /providers/[slug] detail namespace regardless of tier — a provider can
// carry multiple audienceTiers (e.g. Prolific is both a gig marketplace and
// hosts expert-tier studies), but only ever gets ONE detail page, so a flat
// namespace never collides. Tier-scoped listing pages nest under the same
// prefix (/providers/experts/, /providers/gig/, /providers/restricted/) so
// the whole provider directory — single tier or all of them — lives at one
// URL root.
import type { AudienceTier } from '../components/ProviderFilter';

// expert -> "experts" (not "expert") to read naturally as a listing page title.
export const TIER_LISTING_SLUG: Record<AudienceTier, string> = {
  expert: 'experts',
  gig: 'gig',
  restricted: 'restricted',
};

export function providerHref(p: { slug: string }): string {
  return `/providers/${p.slug}`;
}

export function tierListingHref(tier: AudienceTier): string {
  return `/providers/${TIER_LISTING_SLUG[tier]}/`;
}
