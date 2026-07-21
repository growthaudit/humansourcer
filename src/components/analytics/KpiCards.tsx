import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { TASK_TYPE_LABELS, type TaskType } from '../../lib/role-taxonomy';

interface Props {
  rows: ListingAnalyticsRow[];
  selectedTaskTypes: TaskType[];
  onToggleTaskType: (t: TaskType) => void;
}

const numberFmt = new Intl.NumberFormat('en-US');
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function mostCommon<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Fixed card height regardless of which numbers land — required so toggling
// filters can never shift the layout around the chart region below.
function Card({
  label,
  value,
  caption,
  onClick,
  active,
}: {
  label: string;
  value: string;
  caption?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      class={`flex h-28 w-full flex-col justify-between rounded-lg border p-4 text-left transition-colors duration-200 ease-out ${
        active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
      } ${onClick ? 'cursor-pointer hover:border-border-strong' : ''}`}
    >
      <span class="text-xs uppercase tracking-wide text-ink-tertiary">{label}</span>
      <span class="font-display text-2xl font-semibold text-ink-primary">{value}</span>
      <span class="min-h-[1rem] text-xs text-ink-secondary">{caption ?? ''}</span>
    </Tag>
  );
}

export default function KpiCards({ rows, selectedTaskTypes, onToggleTaskType }: Props) {
  const stats = useMemo(() => {
    const rated = rows.filter((r) => r.hourlyRate != null);
    const avgRate = rated.length ? rated.reduce((sum, r) => sum + (r.hourlyRate ?? 0), 0) / rated.length : null;
    const providerCount = new Set(rows.map((r) => r.providerSlug)).size;
    const topTaskType = mostCommon(rows.map((r) => r.taskType));
    return { total: rows.length, avgRate, rated: rated.length, providerCount, topTaskType };
  }, [rows]);

  return (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Active listings" value={numberFmt.format(stats.total)} caption="matching current filters" />
      <Card
        label="Avg. hourly rate"
        value={stats.avgRate != null ? currencyFmt.format(stats.avgRate) : '—'}
        caption={`based on ${numberFmt.format(stats.rated)} of ${numberFmt.format(stats.total)} with a published rate`}
      />
      <Card label="Providers represented" value={numberFmt.format(stats.providerCount)} />
      <Card
        label="Top use case"
        value={stats.topTaskType ? TASK_TYPE_LABELS[stats.topTaskType] : '—'}
        caption={stats.topTaskType ? 'click to filter' : undefined}
        active={stats.topTaskType != null && selectedTaskTypes.includes(stats.topTaskType)}
        onClick={stats.topTaskType ? () => onToggleTaskType(stats.topTaskType!) : undefined}
      />
    </div>
  );
}
