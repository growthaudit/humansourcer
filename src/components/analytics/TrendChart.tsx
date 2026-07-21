import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { seriesColor, OTHER_COLOR } from './palette';

interface Props {
  rows: ListingAnalyticsRow[];
}

const TOP_N = 5;
const WEEKS_SHOWN = 12;

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

export default function TrendChart({ rows }: Props) {
  const { weeks, series, maxValue } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.taskTypeLabel, (totals.get(r.taskTypeLabel) ?? 0) + 1);
    const topLabels = new Set([...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([l]) => l));

    const byWeekAndSeries = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const wk = weekStart(r.createdAt);
      const label = topLabels.has(r.taskTypeLabel) ? r.taskTypeLabel : 'Other';
      if (!byWeekAndSeries.has(wk)) byWeekAndSeries.set(wk, new Map());
      const m = byWeekAndSeries.get(wk)!;
      m.set(label, (m.get(label) ?? 0) + 1);
    }

    const allWeeks = [...byWeekAndSeries.keys()].sort().slice(-WEEKS_SHOWN);
    const seriesLabels = [...topLabels, ...(rows.some((r) => !topLabels.has(r.taskTypeLabel)) ? ['Other'] : [])];

    const seriesData = seriesLabels.map((label) => ({
      label,
      values: allWeeks.map((wk) => byWeekAndSeries.get(wk)?.get(label) ?? 0),
    }));

    const max = Math.max(1, ...seriesData.flatMap((s) => s.values));
    return { weeks: allWeeks, series: seriesData, maxValue: max };
  }, [rows]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (weeks.length > 1 ? (i / (weeks.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / maxValue) * plotH;

  return (
    <div class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm font-medium text-ink-primary">Listing volume by use case, last {WEEKS_SHOWN} weeks</h3>
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
              const color = s.label === 'Other' ? OTHER_COLOR : seriesColor(si);
              const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
              return (
                <g>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    stroke-width="2"
                    stroke-dasharray={s.label === 'Other' ? '4 3' : undefined}
                  />
                  {s.values.map((v, i) => (
                    <circle cx={x(i)} cy={y(v)} r="3" fill={color}>
                      <title>{`${s.label}, week of ${weekLabel(weeks[i])}: ${v}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {series.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
          {series.map((s, si) => (
            <span class="flex items-center gap-1.5">
              <span
                class="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.label === 'Other' ? OTHER_COLOR : seriesColor(si) }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
