import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { TASK_TYPE_LABELS, type TaskType } from '../../lib/role-taxonomy';
import { OTHER_COLOR } from './palette';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';

interface Props {
  rows: ListingAnalyticsRow[];
  selectedProviders: string[];
  selectedTaskTypes: TaskType[];
  onToggleProvider: (slug: string) => void;
  onToggleTaskType: (t: TaskType) => void;
}

// All 9 use cases are always shown — unlike providers (62 of them), there
// are few enough use cases that a top-N cutoff would just be hiding real
// categories for no reason, and (before this fix) silently dropped rows with
// no visual trace that anything was missing.
const ALL_TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as TaskType[];
const TOP_PROVIDERS = 8;
const OTHER_SLUG = '__other__';
// --color-accent (#653ce2) as an rgb triple, for alpha-blended sequential
// intensity — a single hue whose opacity ramps from "near the dark surface"
// (low count) to fully saturated (high count), the light→dark sequential
// convention naturally achieved via alpha on a dark background.
const ACCENT_RGB = '101, 60, 226';

export default function DemandHeatmap({ rows, selectedProviders, selectedTaskTypes, onToggleProvider, onToggleTaskType }: Props) {
  const { containerRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();

  const { useCases, providers, grid, maxCount } = useMemo(() => {
    const taskTotals = new Map<TaskType, number>(ALL_TASK_TYPES.map((t) => [t, 0]));
    const providerTotals = new Map<string, string>();
    const providerCounts = new Map<string, number>();
    for (const r of rows) {
      taskTotals.set(r.taskType, (taskTotals.get(r.taskType) ?? 0) + 1);
      providerTotals.set(r.providerSlug, r.workerBrand);
      providerCounts.set(r.providerSlug, (providerCounts.get(r.providerSlug) ?? 0) + 1);
    }
    const topTaskTypes = ALL_TASK_TYPES.slice().sort((a, b) => (taskTotals.get(b) ?? 0) - (taskTotals.get(a) ?? 0));
    const topProviderSlugs = [...providerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_PROVIDERS).map(([s]) => s);
    const hasOtherProvider = rows.some((r) => !topProviderSlugs.includes(r.providerSlug));

    const gridMap = new Map<string, number>(); // key: `${taskType}|${providerSlug}`
    let max = 1;
    for (const r of rows) {
      const pSlug = topProviderSlugs.includes(r.providerSlug) ? r.providerSlug : OTHER_SLUG;
      const key = `${r.taskType}|${pSlug}`;
      const next = (gridMap.get(key) ?? 0) + 1;
      gridMap.set(key, next);
      if (next > max) max = next;
    }

    const providerList = topProviderSlugs.map((slug) => ({ slug, label: providerTotals.get(slug) ?? slug }));
    if (hasOtherProvider) providerList.push({ slug: OTHER_SLUG, label: 'Other providers' });

    return {
      useCases: topTaskTypes,
      providers: providerList,
      grid: gridMap,
      maxCount: max,
    };
  }, [rows]);

  return (
    <div ref={containerRef} class="relative rounded-lg border border-border bg-surface p-4">
      <ChartTooltip tooltip={tooltip} />
      <h3 class="text-sm font-medium text-ink-primary">Demand heatmap</h3>
      <p class="mt-1 text-xs text-ink-secondary">
        Darker = more listings for that use case × provider combination. Click a cell to filter by both.
      </p>
      <div class="mt-3 overflow-x-auto">
        {useCases.length === 0 || providers.length === 0 ? (
          <div class="flex h-40 items-center justify-center text-sm text-ink-secondary">No listings match these filters.</div>
        ) : (
          <table class="border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th class="sticky left-0 z-10 w-36 bg-surface" />
                {providers.map((p) => (
                  <th class="h-28 w-9 px-0 pb-1 align-bottom">
                    <div class="flex h-full items-end justify-start pl-1">
                      <span
                        title={p.label}
                        class={`inline-block max-w-[110px] origin-bottom-left overflow-hidden whitespace-nowrap text-ellipsis text-[10px] font-normal ${
                          p.slug === OTHER_SLUG ? 'italic text-ink-tertiary' : 'text-ink-tertiary'
                        }`}
                        style={{ transform: 'rotate(-45deg)' }}
                      >
                        {p.label}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {useCases.map((t) => (
                <tr>
                  <th class="sticky left-0 z-10 whitespace-nowrap bg-surface pr-2 text-right text-xs font-normal text-ink-secondary">
                    {TASK_TYPE_LABELS[t]}
                  </th>
                  {providers.map((p) => {
                    const count = grid.get(`${t}|${p.slug}`) ?? 0;
                    const alpha = count === 0 ? 0 : 0.14 + (count / maxCount) * 0.76;
                    const selected = selectedTaskTypes.includes(t) && selectedProviders.includes(p.slug);
                    const clickable = count > 0 && p.slug !== OTHER_SLUG;
                    return (
                      <td
                        class={`h-9 w-9 rounded text-center align-middle text-[10px] ${clickable ? 'cursor-pointer' : ''}`}
                        style={{
                          backgroundColor: count > 0 ? (p.slug === OTHER_SLUG ? `${OTHER_COLOR}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : `rgba(${ACCENT_RGB}, ${alpha})`) : 'var(--color-surface-raised)',
                          outline: selected ? '2px solid var(--color-accent)' : 'none',
                          color: alpha > 0.55 ? 'var(--color-accent-ink)' : 'var(--color-ink-secondary)',
                        }}
                        onMouseEnter={
                          count > 0 ? (e) => showTooltip(e as unknown as MouseEvent, `${TASK_TYPE_LABELS[t]} — ${p.label}: ${count}`) : undefined
                        }
                        onMouseLeave={hideTooltip}
                        onClick={
                          clickable
                            ? () => {
                                onToggleTaskType(t);
                                onToggleProvider(p.slug);
                              }
                            : undefined
                        }
                      >
                        {count > 0 ? count : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
