import { useMemo, useState } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';

interface Props {
  rows: ListingAnalyticsRow[];
}

type SortKey = 'rate' | 'date';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`flex items-center gap-1 transition-colors duration-200 ease-out ${active ? 'text-ink-primary' : 'text-ink-secondary hover:text-ink-primary'}`}
    >
      {label}
      {active && <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

export default function ListingsTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [shown, setShown] = useState(PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setShown(PAGE_SIZE);
  };

  const sorted = useMemo(() => {
    const dirMul = sortDir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      if (sortKey === 'date') {
        return dirMul * (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
      }
      // rate: nulls always sort last, regardless of direction — a missing
      // rate isn't "low," it's unknown, and shouldn't win a "highest first" sort.
      if (a.hourlyRate == null && b.hourlyRate == null) return 0;
      if (a.hourlyRate == null) return 1;
      if (b.hourlyRate == null) return -1;
      return dirMul * (a.hourlyRate - b.hourlyRate);
    });
  }, [rows, sortKey, sortDir]);

  const visible = sorted.slice(0, shown);

  return (
    <div class="rounded-lg border border-border bg-surface">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase tracking-wide text-ink-tertiary">
              <th class="px-4 py-3 font-medium">Provider</th>
              <th class="px-4 py-3 font-medium">Category</th>
              <th class="px-4 py-3 font-medium">Use case</th>
              <th class="px-4 py-3 font-medium">
                <SortButton label="Rate" active={sortKey === 'rate'} dir={sortDir} onClick={() => toggleSort('rate')} />
              </th>
              <th class="px-4 py-3 font-medium">
                <SortButton label="Listed" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr class="border-b border-border last:border-0">
                <td class="px-4 py-2.5 text-ink-primary">{r.workerBrand}</td>
                <td class="px-4 py-2.5 text-ink-secondary">{r.category ?? '—'}</td>
                <td class="px-4 py-2.5 text-ink-secondary">{r.taskTypeLabel}</td>
                <td class="px-4 py-2.5 text-ink-secondary">
                  {r.hourlyRate != null ? `${currencyFmt.format(r.hourlyRate)}/hr` : (r.payText ?? '—')}
                </td>
                <td class="px-4 py-2.5 text-ink-tertiary">{dateFmt.format(new Date(r.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <p class="py-12 text-center text-sm text-ink-secondary">No listings match those filters.</p>}
      <div class="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-ink-tertiary">
        <span>
          Showing {visible.length} of {rows.length}
        </span>
        {shown < rows.length && (
          <button
            type="button"
            onClick={() => setShown((s) => s + PAGE_SIZE)}
            class="text-accent transition-colors duration-200 ease-out hover:text-accent-hover"
          >
            Show more
          </button>
        )}
      </div>
    </div>
  );
}
