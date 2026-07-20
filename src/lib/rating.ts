// Blended "TLDR" trust rating, derived at render time from the raw
// per-source values on the provider (trustpilotRating/googleRating/
// glassdoorRating). Those raw fields stay the citable source of truth in
// providers.json; this is the only place the blend formula lives, so
// changing it later never requires a data migration. Mirrors the
// map/derive/labels pattern in src/lib/taxonomy.ts.

export type TldrTier = 'excellent' | 'good' | 'mixed' | 'poor';

export interface TldrRating {
  score: number | null;   // simple average of available sources, 1 decimal place; null if no sources
  sourceCount: number;    // how many of the 3 sources contributed
  tier: TldrTier | null;
}

interface RatingSources {
  trustpilotRating?: number;
  googleRating?: number;
  glassdoorRating?: number;
}

function tierForScore(score: number): TldrTier {
  if (score >= 4.5) return 'excellent';
  if (score >= 3.5) return 'good';
  if (score >= 2.5) return 'mixed';
  return 'poor';
}

export function computeTldrRating(provider: RatingSources): TldrRating {
  const scores = [provider.trustpilotRating, provider.googleRating, provider.glassdoorRating]
    .filter((s): s is number => s != null);

  if (scores.length === 0) return { score: null, sourceCount: 0, tier: null };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const score = Math.round(avg * 10) / 10;
  return { score, sourceCount: scores.length, tier: tierForScore(score) };
}

export const TLDR_TIER_LABELS: Record<TldrTier, string> = {
  excellent: 'Excellent',
  good: 'Well-reviewed',
  mixed: 'Mixed reviews',
  poor: 'Poor reviews',
};
