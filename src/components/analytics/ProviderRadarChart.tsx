import { useMemo, useState } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { seriesColor } from './palette';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';

interface Props {
  rows: ListingAnalyticsRow[];
}

const TOP_N = 5;
const AXES = ['Volume', 'Avg. pay', 'Transparency', 'Category mix', 'Use-case mix'] as const;

const W = 480;
const H = 400;
const CX = W / 2;
const CY = H / 2 - 6;
const RADIUS = 150;

interface ProviderMetrics {
  slug: string;
  brand: string;
  volume: number;
  avgPay: number;
  transparency: number;
  categoryDiversity: number;
  useCaseDiversity: number;
}

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

// A "spider" comparison of the top providers by volume across five metrics.
// Each axis is independently scaled to the max among the *displayed* set
// (standard radar convention — the shape communicates relative standing,
// not absolute magnitude) with the real value surfaced in the tooltip.
// Restricted to providers with at least one rated listing, same rule as
// ProviderBubbleChart, so the "avg pay" axis never has to fake a 0 for
// "we don't know" (which would read as "$0/hr", not "no data").
export default function ProviderRadarChart({ rows }: Props) {
  const { containerRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const providers = useMemo<ProviderMetrics[]>(() => {
    const map = new Map<
      string,
      { brand: string; count: number; ratedSum: number; ratedCount: number; categories: Set<string>; taskTypes: Set<string> }
    >();
    for (const r of rows) {
      const e = map.get(r.providerSlug) ?? {
        brand: r.workerBrand,
        count: 0,
        ratedSum: 0,
        ratedCount: 0,
        categories: new Set<string>(),
        taskTypes: new Set<string>(),
      };
      e.count += 1;
      if (r.hourlyRate != null) {
        e.ratedSum += r.hourlyRate;
        e.ratedCount += 1;
      }
      if (r.category) e.categories.add(r.category);
      e.taskTypes.add(r.taskType);
      map.set(r.providerSlug, e);
    }
    return [...map.entries()]
      .filter(([, e]) => e.ratedCount > 0)
      .map(([slug, e]) => ({
        slug,
        brand: e.brand,
        volume: e.count,
        avgPay: e.ratedSum / e.ratedCount,
        transparency: e.ratedCount / e.count,
        categoryDiversity: e.categories.size,
        useCaseDiversity: e.taskTypes.size,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, TOP_N);
  }, [rows]);

  const toggleHidden = (slug: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const maxes = useMemo(
    () => ({
      volume: Math.max(1, ...providers.map((p) => p.volume)),
      avgPay: Math.max(1, ...providers.map((p) => p.avgPay)),
      transparency: Math.max(0.01, ...providers.map((p) => p.transparency)),
      categoryDiversity: Math.max(1, ...providers.map((p) => p.categoryDiversity)),
      useCaseDiversity: Math.max(1, ...providers.map((p) => p.useCaseDiversity)),
    }),
    [providers]
  );

  const axisPoint = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return { x: CX + Math.cos(angle) * RADIUS * frac, y: CY + Math.sin(angle) * RADIUS * frac };
  };

  const fractionsFor = (p: ProviderMetrics): number[] => [
    p.volume / maxes.volume,
    p.avgPay / maxes.avgPay,
    p.transparency / maxes.transparency,
    p.categoryDiversity / maxes.categoryDiversity,
    p.useCaseDiversity / maxes.useCaseDiversity,
  ];

  const rawLabelsFor = (p: ProviderMetrics): string[] => [
    `${p.volume} listings`,
    `${currencyFmt.format(p.avgPay)}/hr avg`,
    `${pctFmt.format(p.transparency)} transparent`,
    `${p.categoryDiversity} categories`,
    `${p.useCaseDiversity} use cases`,
  ];

  return (
    <div ref={containerRef} class="relative rounded-lg border border-border bg-surface p-4">
      <ChartTooltip tooltip={tooltip} />
      <h3 class="text-sm font-medium text-ink-primary">Provider profile</h3>
      <p class="mt-1 text-xs text-ink-secondary">
        Top {TOP_N} providers by volume, each axis scaled to the max among them. Click a legend entry to hide/show it.
      </p>
      <div class="mt-3 flex h-96 items-center justify-center">
        {providers.length === 0 ? (
          <div class="text-sm text-ink-secondary">No providers with a published rate for this selection.</div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            class="h-full w-full"
            role="img"
            aria-label="Provider profile comparison across volume, pay, transparency, and diversity"
          >
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <polygon
                points={AXES.map((_, i) => {
                  const pt = axisPoint(i, ring);
                  return `${pt.x},${pt.y}`;
                }).join(' ')}
                fill="none"
                stroke="var(--color-border)"
                stroke-width="1"
              />
            ))}
            {AXES.map((label, i) => {
              const outer = axisPoint(i, 1);
              const labelPt = axisPoint(i, 1.18);
              return (
                <g>
                  <line x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke="var(--color-border)" stroke-width="1" />
                  <text
                    x={labelPt.x}
                    y={labelPt.y}
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="10"
                    fill="var(--color-ink-tertiary)"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {providers.map((p, pi) => {
              if (hidden.has(p.slug)) return null;
              const color = seriesColor(pi);
              const fractions = fractionsFor(p);
              const raw = rawLabelsFor(p);
              const pts = fractions.map((f, i) => axisPoint(i, Math.max(0.03, f)));
              return (
                <g>
                  <polygon points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill={color} fill-opacity="0.14" stroke={color} stroke-width="2" />
                  {pts.map((pt, i) => (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill={color}
                      class="cursor-pointer"
                      onMouseEnter={(e) => showTooltip(e as unknown as MouseEvent, `${p.brand} — ${AXES[i]}: ${raw[i]}`)}
                      onMouseLeave={hideTooltip}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {providers.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          {providers.map((p, pi) => (
            <button
              type="button"
              onClick={() => toggleHidden(p.slug)}
              class={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors duration-200 ease-out hover:bg-surface-raised ${
                hidden.has(p.slug) ? 'text-ink-tertiary line-through' : 'text-ink-secondary'
              }`}
            >
              <span class="h-2 w-2 rounded-full" style={{ backgroundColor: seriesColor(pi) }} />
              {p.brand}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
