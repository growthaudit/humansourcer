// Shared filter state + predicate for the /market-data/ dashboard. Kept out
// of ListingsDashboard.tsx so FilterBar and the dashboard's useMemo chain
// both import the exact same matching logic — filters, KPIs, charts, and the
// table can never disagree about what "currently selected" means.
import type { ListingAnalyticsRow } from '../../lib/listings-analytics';
import type { TaskType } from '../../lib/role-taxonomy';

export interface Filters {
  categories: string[];
  taskTypes: TaskType[];
  providers: string[];
  dateFrom: string; // yyyy-mm-dd, '' = no lower bound
  dateTo: string; // yyyy-mm-dd, '' = no upper bound
  query: string;
}

export const EMPTY_FILTERS: Filters = {
  categories: [],
  taskTypes: [],
  providers: [],
  dateFrom: '',
  dateTo: '',
  query: '',
};

export function isFilterActive(f: Filters): boolean {
  return (
    f.categories.length > 0 ||
    f.taskTypes.length > 0 ||
    f.providers.length > 0 ||
    f.dateFrom !== '' ||
    f.dateTo !== '' ||
    f.query.trim() !== ''
  );
}

export function matchesFilters(row: ListingAnalyticsRow, f: Filters): boolean {
  if (f.categories.length > 0 && (!row.category || !f.categories.includes(row.category))) return false;
  if (f.taskTypes.length > 0 && !f.taskTypes.includes(row.taskType)) return false;
  if (f.providers.length > 0 && !f.providers.includes(row.providerSlug)) return false;
  if (f.dateFrom && row.createdAt < f.dateFrom) return false;
  if (f.dateTo && row.createdAt.slice(0, 10) > f.dateTo) return false;
  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase();
    const haystack = `${row.workerBrand} ${row.category ?? ''} ${row.taskTypeLabel}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function encodeFiltersToParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.categories.length) params.set('category', f.categories.join(','));
  if (f.taskTypes.length) params.set('use_case', f.taskTypes.join(','));
  if (f.providers.length) params.set('provider', f.providers.join(','));
  if (f.dateFrom) params.set('from', f.dateFrom);
  if (f.dateTo) params.set('to', f.dateTo);
  if (f.query) params.set('q', f.query);
  return params;
}

export function decodeFiltersFromLocation(): Filters {
  if (typeof window === 'undefined') return { ...EMPTY_FILTERS };
  const params = new URLSearchParams(window.location.search);
  const list = (name: string) => (params.get(name) ? params.get(name)!.split(',').filter(Boolean) : []);
  return {
    categories: list('category'),
    taskTypes: list('use_case') as TaskType[],
    providers: list('provider'),
    dateFrom: params.get('from') ?? '',
    dateTo: params.get('to') ?? '',
    query: params.get('q') ?? '',
  };
}
