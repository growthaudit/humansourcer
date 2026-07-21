import { useMemo, useState } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';

interface Props {
  rows: ListingAnalyticsRow[];
}

type GroupBy = 'category' | 'useCase';
const MAX_GROUPS = 8;
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function groupKey(row: ListingAnalyticsRow, groupBy: GroupBy): string | null {
  return groupBy === 'category' ? row.category : row.taskTypeLabel;
}

export default function ValuationChart({ rows }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('useCase');

  const { groups, ratedCount } = useMemo(() => {
    const rated = rows.filter((r) => r.hourlyRate != null);
    const sums = new Map<string, { total: number; count: number }>();
    for (const r of rated) {
      const key = groupKey(r, groupBy);
      if (!key) continue;
      const entry = sums.get(key) ?? { total: 0, count: 0 };
      entry.total += r.hourlyRate ?? 0;
      entry.count += 1;
      sums.set(key, entry);
    }
    const list = [...sums.entries()]
      .map(([label, { total, count }]) => ({ label, avg: total / count, count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, MAX_GROUPS);
    return { groups: list, ratedCount: rated.length };
  }, [rows, groupBy]);

  const maxAvg = Math.max(1, ...groups.map((g) => g.avg));

  return (
    <div class="rounded-lg border border-border bg-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-medium text-ink-primary">Average published hourly rate</h3>
        <div class="flex gap-1 text-xs" role="group" aria-label="Group by">
          {(['useCase', 'category'] as GroupBy[]).map((g) => (
            <button
              type="button"
              onClick={() => setGroupBy(g)}
              class={`rounded border px-2 py-1 transition-colors duration-200 ease-out ${
                groupBy === g
                  ? 'border-accent bg-accent-soft text-ink-primary'
                  : 'border-border text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {g === 'useCase' ? 'By use case' : 'By category'}
            </button>
          ))}
        </div>
      </div>

      <div class="mt-3 h-64 overflow-y-auto">
        {groups.length === 0 ? (
          <div class="flex h-full items-center justify-center text-sm text-ink-secondary">
            No listings with a published rate for this selection.
          </div>
        ) : (
          <div class="space-y-2.5">
            {groups.map((g) => (
              <div>
                <div class="mb-1 flex items-baseline justify-between text-xs text-ink-secondary">
                  <span class="truncate pr-2">{g.label}</span>
                  <span class="whitespace-nowrap text-ink-primary">
                    {currencyFmt.format(g.avg)}/hr <span class="text-ink-tertiary">({g.count})</span>
                  </span>
                </div>
                <div class="h-2 w-full rounded-full bg-border">
                  <div
                    class="h-2 rounded-full"
                    style={{ width: `${(g.avg / maxAvg) * 100}%`, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p class="mt-3 text-xs text-ink-tertiary">
        Based on {ratedCount} of {rows.length} listings with a published hourly rate — most sources only publish
        free-text pay, so this reflects a small subset, not the full market.
      </p>
    </div>
  );
}
