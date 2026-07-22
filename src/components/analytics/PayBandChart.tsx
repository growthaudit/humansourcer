import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { PAY_BAND_LABELS, type PayBand } from '../../lib/role-taxonomy';
import { seriesColor, OTHER_COLOR } from './palette';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';

interface Props {
  rows: ListingAnalyticsRow[];
  selectedProviders: string[];
  onToggleProvider: (slug: string) => void;
}

const TOP_PROVIDERS = 10;
// 'unspecified' gets OTHER_COLOR (same "we don't know" convention as the
// synthetic Other buckets elsewhere) rather than a 5th categorical hue.
const BAND_ORDER: PayBand[] = ['under-20', '20-40', '40-plus', 'project-based', 'unspecified'];

function bandColor(band: PayBand): string {
  return band === 'unspecified' ? OTHER_COLOR : seriesColor(BAND_ORDER.indexOf(band));
}

export default function PayBandChart({ rows, selectedProviders, onToggleProvider }: Props) {
  const { containerRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();

  const providers = useMemo(() => {
    const map = new Map<string, { brand: string; total: number; bands: Map<PayBand, number> }>();
    for (const r of rows) {
      const e = map.get(r.providerSlug) ?? { brand: r.workerBrand, total: 0, bands: new Map<PayBand, number>() };
      e.total += 1;
      e.bands.set(r.payBand, (e.bands.get(r.payBand) ?? 0) + 1);
      map.set(r.providerSlug, e);
    }
    return [...map.entries()]
      .map(([slug, e]) => ({ slug, brand: e.brand, total: e.total, bands: e.bands }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_PROVIDERS);
  }, [rows]);

  return (
    <div ref={containerRef} class="relative rounded-lg border border-border bg-surface p-4">
      <ChartTooltip tooltip={tooltip} />
      <h3 class="text-sm font-medium text-ink-primary">Pay bands by provider</h3>
      <p class="mt-1 text-xs text-ink-secondary">
        Share of each provider's listings by published hourly rate, top {TOP_PROVIDERS} providers by volume.
        "Unspecified" means no hourly rate could be determined from the listing. Click a row to filter by that
        provider.
      </p>
      <div class="mt-3 space-y-2.5">
        {providers.length === 0 ? (
          <div class="flex h-24 items-center justify-center text-sm text-ink-secondary">No listings match these filters.</div>
        ) : (
          providers.map((p) => {
            const active = selectedProviders.includes(p.slug);
            return (
              <button
                type="button"
                onClick={() => onToggleProvider(p.slug)}
                class={`block w-full rounded px-1.5 py-1 text-left transition-colors duration-200 ease-out hover:bg-surface-raised ${
                  active ? 'bg-accent-soft' : ''
                }`}
              >
                <div class="mb-1 flex items-baseline justify-between text-xs">
                  <span class="truncate pr-2 text-ink-primary">{p.brand}</span>
                  <span class="whitespace-nowrap text-ink-tertiary">{p.total} listings</span>
                </div>
                <div class="flex h-3 w-full overflow-hidden rounded-full bg-border">
                  {BAND_ORDER.map((band) => {
                    const count = p.bands.get(band) ?? 0;
                    if (count === 0) return null;
                    const pct = (count / p.total) * 100;
                    return (
                      <div
                        style={{ width: `${pct}%`, backgroundColor: bandColor(band) }}
                        onMouseEnter={(e) =>
                          showTooltip(
                            e as unknown as MouseEvent,
                            `${p.brand} — ${PAY_BAND_LABELS[band]}: ${count} (${Math.round(pct)}%)`
                          )
                        }
                        onMouseLeave={hideTooltip}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })
        )}
      </div>
      {providers.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-secondary">
          {BAND_ORDER.map((band) => (
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" style={{ backgroundColor: bandColor(band) }} />
              {PAY_BAND_LABELS[band]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
