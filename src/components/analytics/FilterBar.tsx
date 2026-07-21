import { useMemo } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import { TASK_TYPE_LABELS, type TaskType } from '../../lib/role-taxonomy';
import type { Filters } from './filters';

interface Props {
  optionsPool: ListingAnalyticsRow[];
  filters: Filters;
  onChange: (next: Filters) => void;
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <details class="relative">
      <summary class="cursor-pointer select-none rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary">
        {label}
        {selected.length > 0 && <span class="ml-1.5 text-ink-tertiary">({selected.length})</span>}
      </summary>
      <div class="absolute z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-border-strong bg-surface-raised p-2 shadow-card">
        {options.length === 0 && <p class="px-2 py-1 text-xs text-ink-tertiary">No options</p>}
        {options.map((opt) => (
          <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-secondary hover:bg-surface">
            <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => onToggle(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function FilterBar({ optionsPool, filters, onChange }: Props) {
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    optionsPool.forEach((r) => r.category && set.add(r.category));
    return [...set].sort().map((c) => ({ value: c, label: c }));
  }, [optionsPool]);

  const taskTypeOptions = useMemo(() => {
    const set = new Set<TaskType>();
    optionsPool.forEach((r) => set.add(r.taskType));
    return [...set].map((t) => ({ value: t, label: TASK_TYPE_LABELS[t] }));
  }, [optionsPool]);

  const providerOptions = useMemo(() => {
    const map = new Map<string, string>();
    optionsPool.forEach((r) => map.set(r.providerSlug, r.workerBrand));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [optionsPool]);

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.taskTypes.length > 0 ||
    filters.providers.length > 0 ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.query.trim() !== '';

  return (
    <div class="flex flex-wrap items-center gap-3">
      <input
        type="text"
        value={filters.query}
        onInput={(e) => onChange({ ...filters, query: (e.target as HTMLInputElement).value })}
        placeholder="Search provider, category, use case..."
        class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
        aria-label="Search listings"
      />

      <MultiSelect
        label="Category"
        options={categoryOptions}
        selected={filters.categories}
        onToggle={(v) => onChange({ ...filters, categories: toggleValue(filters.categories, v) })}
      />
      <MultiSelect
        label="Use case"
        options={taskTypeOptions}
        selected={filters.taskTypes}
        onToggle={(v) => onChange({ ...filters, taskTypes: toggleValue(filters.taskTypes, v) })}
      />
      <MultiSelect
        label="Provider"
        options={providerOptions}
        selected={filters.providers}
        onToggle={(v) => onChange({ ...filters, providers: toggleValue(filters.providers, v) })}
      />

      <div class="flex items-center gap-2 text-sm text-ink-secondary">
        <label class="flex items-center gap-1.5">
          From
          <input
            type="date"
            value={filters.dateFrom}
            onInput={(e) => onChange({ ...filters, dateFrom: (e.target as HTMLInputElement).value })}
            class="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink-primary"
            aria-label="From date"
          />
        </label>
        <label class="flex items-center gap-1.5">
          To
          <input
            type="date"
            value={filters.dateTo}
            onInput={(e) => onChange({ ...filters, dateTo: (e.target as HTMLInputElement).value })}
            class="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink-primary"
            aria-label="To date"
          />
        </label>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() =>
            onChange({ categories: [], taskTypes: [], providers: [], dateFrom: '', dateTo: '', query: '' })
          }
          class="text-sm text-accent transition-colors duration-200 ease-out hover:text-accent-hover"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
