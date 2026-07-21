import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { TASK_TYPE_LABELS, type TaskType } from '../../lib/role-taxonomy';
import { seriesColor, OTHER_COLOR } from './palette';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';

interface Props {
  rows: ListingAnalyticsRow[];
  selectedTaskTypes: TaskType[];
  onToggleTaskType: (t: TaskType) => void;
}

const TOP_N = 5;
const WEEKS_SHOWN = 12;
const OTHER_KEY = '__other__';

function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function weekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const W = 760;
const H = 260;
const PAD = { top: 10, right: 10, bottom: 28, left: 36 };

export default function TrendChart({ rows, selectedTaskTypes, onToggleTaskType }: Props) {
  const { containerRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();

  const { weeks, series, maxValue } = useMemo(() => {
    const totals = new Map<TaskType, number>();
    for (const r of rows) totals.set(r.taskType, (totals.get(r.taskType) ?? 0) + 1);
    const topTypes = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([t]) => t);
    const topSet = new Set(topTypes);

    const byWeekAndSeries = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const wk = weekStart(r.createdAt);
      const key = topSet.has(r.taskType) ? r.taskType : OTHER_KEY;
      if (!byWeekAndSeries.has(wk)) byWeekAndSeries.set(wk, new Map());
      const m = byWeekAndSeries.get(wk)!;
      m.set(key, (m.get(key) ?? 0) + 1);
    }

    const allWeeks = [...byWeekAndSeries.keys()].sort().slice(-WEEKS_SHOWN);
    const hasOther = rows.some((r) => !topSet.has(r.taskType));
    const seriesKeys: string[] = hasOther ? [...topTypes, OTHER_KEY] : topTypes;

    const seriesData = seriesKeys.map((key) => ({
      key,
      label: key === OTHER_KEY ? 'Other' : TASK_TYPE_LABELS[key as TaskType],
      values: allWeeks.map((wk) => byWeekAndSeries.get(wk)?.get(key) ?? 0),
    }));

    const max = Math.max(1, ...seriesData.flatMap((s) => s.values));
    return { weeks: allWeeks, series: seriesData, maxValue: max };
  }, [rows]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (weeks.length > 1 ? (i / (weeks.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / maxValue) * plotH;

  return (
    <div ref={containerRef} class="relative rounded-lg border border-border bg-surface p-4">
      <ChartTooltip tooltip={tooltip} />
      <h3 class="text-sm font-medium text-ink-primary">Listing volume by use case, last {WEEKS_SHOWN} weeks</h3>
      <p class="mt-1 text-xs text-ink-secondary">Click a use case in the legend to filter the whole page by it.</p>
      <div class="mt-3 h-64">
        {weeks.length === 0 ? (
          <div class="flex h-full items-center justify-center text-sm text-ink-secondary">
            No listings match these filters.
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} class="h-full w-full" role="img" aria-label="Listing volume by use case over time">
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="var(--color-border-strong)" stroke-width="1" />
            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="var(--color-border-strong)" stroke-width="1" />
            <text x={PAD.left - 6} y={PAD.top + 4} text-anchor="end" font-size="10" fill="var(--color-ink-tertiary)">
              {maxValue}
            </text>
            <text x={PAD.left - 6} y={H - PAD.bottom} text-anchor="end" font-size="10" fill="var(--color-ink-tertiary)">
              0
            </text>

            {weeks.map((wk, i) =>
              i % Math.ceil(weeks.length / 6) === 0 ? (
                <text x={x(i)} y={H - PAD.bottom + 14} text-anchor="middle" font-size="10" fill="var(--color-ink-tertiary)">
                  {weekLabel(wk)}
                </text>
              ) : null
            )}

            {series.map((s, si) => {
              const color = s.key === OTHER_KEY ? OTHER_COLOR : seriesColor(si);
              const dimmed = selectedTaskTypes.length > 0 && s.key !== OTHER_KEY && !selectedTaskTypes.includes(s.key as TaskType);
              const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
              return (
                <g opacity={dimmed ? 0.35 : 1}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    stroke-width="2"
                    stroke-dasharray={s.key === OTHER_KEY ? '4 3' : undefined}
                  />
                  {s.values.map((v, i) => (
                    <circle
                      cx={x(i)}
                      cy={y(v)}
                      r="4"
                      fill={color}
                      class="cursor-pointer"
                      onMouseEnter={(e) => showTooltip(e as unknown as MouseEvent, `${s.label}, week of ${weekLabel(weeks[i])}: ${v}`)}
                      onMouseLeave={hideTooltip}
                      onClick={() => s.key !== OTHER_KEY && onToggleTaskType(s.key as TaskType)}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {series.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((s, si) => {
            const active = s.key !== OTHER_KEY && selectedTaskTypes.includes(s.key as TaskType);
            return (
              <button
                type="button"
                disabled={s.key === OTHER_KEY}
                onClick={() => s.key !== OTHER_KEY && onToggleTaskType(s.key as TaskType)}
                class={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors duration-200 ease-out ${
                  s.key === OTHER_KEY ? 'text-ink-tertiary' : 'cursor-pointer text-ink-secondary hover:bg-surface-raised'
                } ${active ? 'bg-accent-soft text-ink-primary' : ''}`}
              >
                <span class="h-2 w-2 rounded-full" style={{ backgroundColor: s.key === OTHER_KEY ? OTHER_COLOR : seriesColor(si) }} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
