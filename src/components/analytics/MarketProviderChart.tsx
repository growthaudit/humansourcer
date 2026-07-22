import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { TASK_TYPE_LABELS } from '../../lib/role-taxonomy';
import { seriesColor, OTHER_COLOR } from './palette';
import { useChartTooltip, ChartTooltip, useContainerWidth } from './ChartTooltip';

interface Props {
  rows: ListingAnalyticsRow[];
  selectedProviders: string[];
  onToggleProvider: (slug: string) => void;
}

// All 9 use cases are always shown (see DemandHeatmap.tsx for the same
// policy) — only providers (62 of them) get a top-N-plus-Other treatment.
const ALL_USE_CASE_LABELS = Object.values(TASK_TYPE_LABELS);
const TOP_PROVIDERS = 8;
const OTHER_SLUG = '__other__';

const W = 760;
const H = 300;
const PAD = { top: 10, right: 10, bottom: 56, left: 36 };
// Below this rendered pixel width, horizontal centered labels no longer fit
// nine categories legibly — switch to angled labels instead of just
// truncating further, matching common axis-label practice in BI tools.
const ROTATE_BELOW_PX = 620;

export default function MarketProviderChart({ rows, selectedProviders, onToggleProvider }: Props) {
  const { containerRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const { ref: widthRef, width: measuredWidth } = useContainerWidth<HTMLDivElement>();

  const { useCases, providers, matrix, maxTotal } = useMemo(() => {
    const useCaseTotals = new Map<string, number>(ALL_USE_CASE_LABELS.map((l) => [l, 0]));
    const providerTotals = new Map<string, string>(); // slug -> brand
    const providerCounts = new Map<string, number>();
    for (const r of rows) {
      useCaseTotals.set(r.taskTypeLabel, (useCaseTotals.get(r.taskTypeLabel) ?? 0) + 1);
      providerTotals.set(r.providerSlug, r.workerBrand);
      providerCounts.set(r.providerSlug, (providerCounts.get(r.providerSlug) ?? 0) + 1);
    }
    const useCaseLabels = ALL_USE_CASE_LABELS.slice().sort((a, b) => (useCaseTotals.get(b) ?? 0) - (useCaseTotals.get(a) ?? 0));

    const topProviderSlugs = [...providerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_PROVIDERS)
      .map(([slug]) => slug);
    const hasOtherProvider = rows.some((r) => !topProviderSlugs.includes(r.providerSlug));
    const providerList = topProviderSlugs.map((slug) => ({ slug, label: providerTotals.get(slug) ?? slug }));
    if (hasOtherProvider) providerList.push({ slug: OTHER_SLUG, label: 'Other providers' });

    const grid = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const pSlug = topProviderSlugs.includes(r.providerSlug) ? r.providerSlug : OTHER_SLUG;
      if (!grid.has(r.taskTypeLabel)) grid.set(r.taskTypeLabel, new Map());
      const m = grid.get(r.taskTypeLabel)!;
      m.set(pSlug, (m.get(pSlug) ?? 0) + 1);
    }

    const totals = useCaseLabels.map((l) => useCaseTotals.get(l) ?? 0);
    const max = Math.max(1, ...totals);

    return { useCases: useCaseLabels, providers: providerList, matrix: grid, maxTotal: max };
  }, [rows]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const barGap = 10;
  const barWidth = useCases.length > 0 ? (plotW - barGap * (useCases.length - 1)) / useCases.length : plotW;

  const yFromCount = (v: number) => (v / maxTotal) * plotH;
  const isDimmed = (slug: string) => selectedProviders.length > 0 && slug !== OTHER_SLUG && !selectedProviders.includes(slug);

  const scale = measuredWidth > 0 ? measuredWidth / W : 1;
  const rotateLabels = measuredWidth > 0 && measuredWidth < ROTATE_BELOW_PX;
  const pixelBarWidth = barWidth * scale;
  const maxChars = rotateLabels ? 22 : Math.max(4, Math.floor(pixelBarWidth / 5.5));
  const truncate = (label: string) => (label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label);

  return (
    <div ref={containerRef} class="relative rounded-lg border border-border bg-surface p-4">
      <ChartTooltip tooltip={tooltip} />
      <h3 class="text-sm font-medium text-ink-primary">Market demand vs. provider concentration</h3>
      <p class="mt-1 text-xs text-ink-secondary">
        Bar height = total listings for that use case. Segment size = one provider's share. Click a segment or legend
        entry to filter by that provider.
      </p>
      <div ref={widthRef} class="mt-3 h-80">
        {useCases.length === 0 ? (
          <div class="flex h-full items-center justify-center text-sm text-ink-secondary">
            No listings match these filters.
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} class="h-full w-full" role="img" aria-label="Market demand versus provider concentration by use case">
            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="var(--color-border-strong)" stroke-width="1" />
            {useCases.map((uc, ui) => {
              const barX = PAD.left + ui * (barWidth + barGap);
              let cursorY = H - PAD.bottom;
              const segments = providers.map((p) => {
                const count = matrix.get(uc)?.get(p.slug) ?? 0;
                const segH = yFromCount(count);
                cursorY -= segH;
                return { ...p, count, y: cursorY, h: segH };
              });
              const labelX = barX + barWidth / 2;
              const labelY = H - PAD.bottom + (rotateLabels ? 12 : 14);
              return (
                <g>
                  {segments.map(
                    (s, si) =>
                      s.h > 0 && (
                        <rect
                          x={barX}
                          y={s.y}
                          width={barWidth}
                          height={Math.max(0, s.h - 1)}
                          fill={s.slug === OTHER_SLUG ? OTHER_COLOR : seriesColor(si)}
                          opacity={isDimmed(s.slug) ? 0.35 : 1}
                          class={s.slug === OTHER_SLUG ? '' : 'cursor-pointer'}
                          onMouseEnter={(e) => showTooltip(e as unknown as MouseEvent, `${uc} — ${s.label}: ${s.count}`)}
                          onMouseLeave={hideTooltip}
                          onClick={() => s.slug !== OTHER_SLUG && onToggleProvider(s.slug)}
                        />
                      )
                  )}
                  <text
                    x={labelX}
                    y={labelY}
                    text-anchor={rotateLabels ? 'end' : 'middle'}
                    font-size="9"
                    fill="var(--color-ink-tertiary)"
                    transform={rotateLabels ? `rotate(-40 ${labelX} ${labelY})` : undefined}
                  >
                    {truncate(uc)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {providers.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs">
          {providers.map((p, pi) => (
            <button
              type="button"
              disabled={p.slug === OTHER_SLUG}
              onClick={() => onToggleProvider(p.slug)}
              class={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors duration-200 ease-out ${
                p.slug === OTHER_SLUG ? 'text-ink-tertiary' : 'cursor-pointer text-ink-secondary hover:bg-surface-raised'
              } ${selectedProviders.includes(p.slug) ? 'bg-accent-soft text-ink-primary' : ''}`}
            >
              <span class="h-2 w-2 rounded-full" style={{ backgroundColor: p.slug === OTHER_SLUG ? OTHER_COLOR : seriesColor(pi) }} />
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
