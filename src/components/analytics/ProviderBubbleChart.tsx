import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';

interface Props {
  rows: ListingAnalyticsRow[];
}

const W = 760;
const H = 340;
const PAD = { top: 16, right: 20, bottom: 40, left: 52 };
const MIN_R = 5;
const MAX_R = 32;
const LABEL_COUNT = 5;

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

interface ProviderPoint {
  slug: string;
  brand: string;
  count: number;
  avgPay: number;
  transparency: number; // 0..1 — share of this provider's listings with a published rate
}

// This is fundamentally a 3-variable scatter (position × position × size),
// not a categorical breakdown — with 20+ providers, forcing a fixed
// 8-slot categorical palette onto each bubble would either cycle hues
// (never do that) or make most bubbles indistinguishable gray. A single
// accent hue plus position/size/direct-label/tooltip carries the identity
// instead, same convention a plain scatter plot uses.
export default function ProviderBubbleChart({ rows }: Props) {
  const points = useMemo<ProviderPoint[]>(() => {
    const map = new Map<string, { brand: string; count: number; ratedSum: number; ratedCount: number }>();
    for (const r of rows) {
      const e = map.get(r.providerSlug) ?? { brand: r.workerBrand, count: 0, ratedSum: 0, ratedCount: 0 };
      e.count += 1;
      if (r.hourlyRate != null) {
        e.ratedSum += r.hourlyRate;
        e.ratedCount += 1;
      }
      map.set(r.providerSlug, e);
    }
    return [...map.entries()]
      .filter(([, e]) => e.ratedCount > 0)
      .map(([slug, e]) => ({
        slug,
        brand: e.brand,
        count: e.count,
        avgPay: e.ratedSum / e.ratedCount,
        transparency: e.ratedCount / e.count,
      }));
  }, [rows]);

  const maxCount = Math.max(1, ...points.map((p) => p.count));
  const maxPay = Math.max(1, ...points.map((p) => p.avgPay));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const r = (count: number) => MIN_R + Math.sqrt(count / maxCount) * (MAX_R - MIN_R);
  // Inset by the max bubble radius so bubbles near the edges (0%/100%
  // transparency, $0/max pay) don't get clipped by the SVG viewport.
  const x = (t: number) => PAD.left + MAX_R + t * (plotW - 2 * MAX_R);
  const y = (pay: number) => PAD.top + MAX_R + (1 - pay / maxPay) * (plotH - 2 * MAX_R);

  const labeled = new Set(
    points
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, LABEL_COUNT)
      .map((p) => p.slug)
  );

  return (
    <div class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm font-medium text-ink-primary">Provider landscape</h3>
      <p class="mt-1 text-xs text-ink-secondary">
        Bubble size = open listings. Y = avg. published rate. X = pay transparency (share of that provider's own
        listings with a published rate).
      </p>
      <div class="mt-3 h-80">
        {points.length === 0 ? (
          <div class="flex h-full items-center justify-center text-sm text-ink-secondary">
            No providers with a published rate for this selection.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            class="h-full w-full"
            role="img"
            aria-label="Providers by open listings, average pay, and pay transparency"
          >
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="var(--color-border-strong)" stroke-width="1" />
            <line
              x1={PAD.left}
              y1={H - PAD.bottom}
              x2={W - PAD.right}
              y2={H - PAD.bottom}
              stroke="var(--color-border-strong)"
              stroke-width="1"
            />

            <text x={PAD.left - 8} y={PAD.top + 4} text-anchor="end" font-size="10" fill="var(--color-ink-tertiary)">
              {currencyFmt.format(maxPay)}
            </text>
            <text x={PAD.left - 8} y={H - PAD.bottom} text-anchor="end" font-size="10" fill="var(--color-ink-tertiary)">
              $0
            </text>

            {[0, 0.5, 1].map((t) => (
              <text x={x(t)} y={H - PAD.bottom + 16} text-anchor="middle" font-size="10" fill="var(--color-ink-tertiary)">
                {pctFmt.format(t)}
              </text>
            ))}

            {points.map((p) => (
              <g>
                <circle
                  cx={x(p.transparency)}
                  cy={y(p.avgPay)}
                  r={r(p.count)}
                  fill="var(--color-accent-soft-strong)"
                  stroke="var(--color-accent)"
                  stroke-width="1.5"
                >
                  <title>{`${p.brand}: ${p.count} open listings, avg ${currencyFmt.format(p.avgPay)}/hr, ${pctFmt.format(p.transparency)} with a published rate`}</title>
                </circle>
                {labeled.has(p.slug) && (
                  <text
                    x={x(p.transparency)}
                    y={y(p.avgPay) - r(p.count) - 4}
                    text-anchor="middle"
                    font-size="10"
                    fill="var(--color-ink-secondary)"
                  >
                    {p.brand}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
