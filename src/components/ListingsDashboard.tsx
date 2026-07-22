import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ListingAnalyticsRow } from '../lib/listings-analytics';
import type { TaskType } from '../lib/role-taxonomy';
import { EMPTY_FILTERS, decodeFiltersFromLocation, encodeFiltersToParams, matchesFilters, toggleValue, type Filters } from './analytics/filters';
import FilterBar from './analytics/FilterBar';
import KpiCards from './analytics/KpiCards';
import TrendChart from './analytics/TrendChart';
import ValuationChart from './analytics/ValuationChart';
import MarketProviderChart from './analytics/MarketProviderChart';
import PayBandChart from './analytics/PayBandChart';
import ProviderBubbleChart from './analytics/ProviderBubbleChart';
import ProviderRadarChart from './analytics/ProviderRadarChart';
import DemandHeatmap from './analytics/DemandHeatmap';
import ListingsTable from './analytics/ListingsTable';

// This page is fully client-rendered content (unlike /roles/*, there's no
// server-rendered "default view" whose canonical/robots meta this component
// must protect) — it fetches the full analytics dataset on mount and keeps
// filter state in the URL for shareable/bookmarkable views, same convention
// as RolesFilter.tsx.

interface Props {
  initialRows: ListingAnalyticsRow[];
}

export default function ListingsDashboard({ initialRows }: Props) {
  const [rows, setRows] = useState<ListingAnalyticsRow[]>(initialRows);
  const [loaded, setLoaded] = useState(initialRows.length > 0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    setFilters(decodeFiltersFromLocation());
    fetch('/listings-analytics-data.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const params = encodeFiltersToParams(filters);
    const search = params.toString();
    const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [filters]);

  const filteredRows = useMemo(() => rows.filter((r) => matchesFilters(r, filters)), [rows, filters]);

  // Shared cross-filter callbacks — every chart below that lets you click a
  // data point to filter routes through these, so a click in any chart and
  // a checkbox in FilterBar land in the exact same filters state.
  const toggleProvider = (slug: string) => setFilters((f) => ({ ...f, providers: toggleValue(f.providers, slug) }));
  const toggleTaskType = (t: TaskType) => setFilters((f) => ({ ...f, taskTypes: toggleValue(f.taskTypes, t) }));
  const toggleCategory = (c: string) => setFilters((f) => ({ ...f, categories: toggleValue(f.categories, c) }));

  return (
    <div class="space-y-6">
      <FilterBar optionsPool={rows} filters={filters} onChange={setFilters} />

      {!loaded ? (
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map(() => (
            <div class="h-28 animate-pulse rounded-lg border border-border bg-surface motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <KpiCards rows={filteredRows} selectedTaskTypes={filters.taskTypes} onToggleTaskType={toggleTaskType} />
      )}

      <div class="grid gap-4 lg:grid-cols-2">
        <TrendChart rows={filteredRows} selectedTaskTypes={filters.taskTypes} onToggleTaskType={toggleTaskType} />
        <ValuationChart rows={filteredRows} selectedCategories={filters.categories} selectedTaskTypes={filters.taskTypes} onToggleCategory={toggleCategory} onToggleTaskType={toggleTaskType} />
      </div>

      <PayBandChart rows={filteredRows} selectedProviders={filters.providers} onToggleProvider={toggleProvider} />

      <MarketProviderChart rows={filteredRows} selectedProviders={filters.providers} onToggleProvider={toggleProvider} />

      <DemandHeatmap rows={filteredRows} selectedProviders={filters.providers} selectedTaskTypes={filters.taskTypes} onToggleProvider={toggleProvider} onToggleTaskType={toggleTaskType} />

      <div class="grid gap-4 lg:grid-cols-2">
        <ProviderBubbleChart rows={filteredRows} selectedProviders={filters.providers} onToggleProvider={toggleProvider} />
        <ProviderRadarChart rows={filteredRows} />
      </div>

      <ListingsTable rows={filteredRows} />
    </div>
  );
}
