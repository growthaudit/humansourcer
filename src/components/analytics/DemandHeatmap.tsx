import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { TASK_TYPE_LABELS, type TaskType } from '../../lib/role-taxonomy';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';

interface Props {
  rows: ListingAnalyticsRow[];
  selectedProviders: string[];
  selectedTaskTypes: TaskType[];
  onToggleProvider: (slug: string) => void;
  onToggleTaskType: (t: TaskType) => void;
}

const TOP_USE_CASES = 6;
const TOP_PROVIDERS = 8;
// --color-accent (#653ce2) as an rgb triple, for alpha-blended sequential
// intensity — a single hue whose opacity ramps from "near the dark surface"
// (low count) to fully saturated (high count), the light→dark sequential
// convention naturally achieved via alpha on a dark background.
const ACCENT_RGB = '101, 60, 226';

export default function DemandHeatmap({ rows, selectedProviders, selectedTaskTypes, onToggleProvider, onToggleTaskType }: Props) {
  const { containerRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();

  const { useCases, providers, grid, maxCount } = useMemo(() => {
    const taskTotals = new Map<TaskType, number>();
    const providerTotals = new Map<string, string>();
    const providerCounts = new Map<string, number>();
    for (const r of rows) {
      taskTotals.set(r.taskType, (taskTotals.get(r.taskType) ?? 0) + 1);
      providerTotals.set(r.providerSlug, r.workerBrand);
      providerCounts.set(r.providerSlug, (providerCounts.get(r.providerSlug) ?? 0) + 1);
    }
    const topTaskTypes = [...taskTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_USE_CASES).map(([t]) => t);
    const topProviderSlugs = [...providerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_PROVIDERS).map(([s]) => s);

    const gridMap = new Map<string, number>(); // key: `${taskType}|${providerSlug}`
    let max = 1;
    for (const r of rows) {
      if (!topTaskTypes.includes(r.taskType) || !topProviderSlugs.includes(r.providerSlug)) continue;
      const key = `${r.taskType}|${r.providerSlug}`;
      const next = (gridMap.get(key) ?? 0) + 1;
      gridMap.set(key, next);
      if (next > max) max = next;
    }

    return {
      useCases: topTaskTypes,
      providers: topProviderSlugs.map((slug) => ({ slug, label: providerTotals.get(slug) ?? slug })),
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
                <th class="w-36" />
                {providers.map((p) => (
                  <th class="w-9 px-0 pb-1 align-bottom">
                    <span
                      class="inline-block max-h-24 origin-bottom-left translate-x-3 whitespace-nowrap text-[10px] font-normal text-ink-tertiary"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {p.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {useCases.map((t) => (
                <tr>
                  <th class="whitespace-nowrap pr-2 text-right text-xs font-normal text-ink-secondary">{TASK_TYPE_LABELS[t]}</th>
                  {providers.map((p) => {
                    const count = grid.get(`${t}|${p.slug}`) ?? 0;
                    const alpha = count === 0 ? 0 : 0.14 + (count / maxCount) * 0.76;
                    const selected = selectedTaskTypes.includes(t) && selectedProviders.includes(p.slug);
                    return (
                      <td
                        class={`h-9 w-9 rounded text-center align-middle text-[10px] ${count > 0 ? 'cursor-pointer' : ''}`}
                        style={{
                          backgroundColor: count > 0 ? `rgba(${ACCENT_RGB}, ${alpha})` : 'var(--color-surface-raised)',
                          outline: selected ? '2px solid var(--color-accent)' : 'none',
                          color: alpha > 0.55 ? 'var(--color-accent-ink)' : 'var(--color-ink-secondary)',
                        }}
                        onMouseEnter={
                          count > 0 ? (e) => showTooltip(e as unknown as MouseEvent, `${TASK_TYPE_LABELS[t]} — ${p.label}: ${count}`) : undefined
                        }
                        onMouseLeave={hideTooltip}
                        onClick={
                          count > 0
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
