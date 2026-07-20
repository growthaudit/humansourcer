// Central definition of which route "owns" a provider's canonical page.
// A provider can carry multiple audienceTiers (e.g. Prolific is both a gig
// marketplace and hosts expert-tier studies), but only ever gets ONE page —
// at the route for its first (primary) tier — to avoid near-duplicate
// content across /providers/, /gig/, and /restricted/. Every other tier in
// its list just adds it to that tier's filter/listing/count, linking back
// to the same primary page.
import type { AudienceTier } from '../components/ProviderFilter';

const TIER_HREF_PREFIX: Record<AudienceTier, string> = {
  expert: '/providers/',
  gig: '/gig/',
  restricted: '/restricted/',
};

export function providerHref(p: { slug: string; audienceTiers: AudienceTier[] }): string {
  return `${TIER_HREF_PREFIX[p.audienceTiers[0]]}${p.slug}`;
}
