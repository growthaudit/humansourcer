import { useMemo, useState } from 'preact/hooks';
import {
  ACCESS_MODEL_LABELS,
  GEOGRAPHY_LABELS,
  DOMAIN_TAG_LABELS,
  type AccessModelCategory,
  type GeographyScope,
} from '../lib/taxonomy';

export interface ProviderRow {
  slug: string;
  workerBrand: string;
  parentGroup: string;
  typicalWork: string;
  domainTags: string[];
  accessModelCategory: AccessModelCategory;
  geographyScope: GeographyScope;
}

interface Props {
  providers: ProviderRow[];
}

type SortKey = 'name' | 'parent';

export default function ProviderFilter({ providers }: Props) {
  const [domain, setDomain] = useState<string>('all');
  const [access, setAccess] = useState<string>('all');
  const [geo, setGeo] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const allDomains = useMemo(() => {
    const set = new Set<string>();
    providers.forEach((p) => p.domainTags.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [providers]);

  const filtered = useMemo(() => {
    let rows = providers.filter((p) => {
      if (domain !== 'all' && !p.domainTags.includes(domain)) return false;
      if (access !== 'all' && p.accessModelCategory !== access) return false;
      if (geo !== 'all' && p.geographyScope !== geo) return false;
      return true;
    });
    rows = rows.slice().sort((a, b) => {
      const key = sort === 'name' ? 'workerBrand' : 'parentGroup';
      return a[key].localeCompare(b[key]);
    });
    return rows;
  }, [providers, domain, access, geo, sort]);

  return (
    <div>
      <div class="mb-6 flex flex-wrap gap-3">
        <select
          class="rounded border border-slate-300 px-3 py-2 text-sm"
          value={domain}
          onChange={(e) => setDomain((e.target as HTMLSelectElement).value)}
          aria-label="Filter by domain"
        >
          <option value="all">All domains</option>
          {allDomains.map((d) => (
            <option value={d}>{DOMAIN_TAG_LABELS[d] ?? d}</option>
          ))}
        </select>

        <select
          class="rounded border border-slate-300 px-3 py-2 text-sm"
          value={access}
          onChange={(e) => setAccess((e.target as HTMLSelectElement).value)}
          aria-label="Filter by access model"
        >
          <option value="all">All access models</option>
          {Object.entries(ACCESS_MODEL_LABELS).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>

        <select
          class="rounded border border-slate-300 px-3 py-2 text-sm"
          value={geo}
          onChange={(e) => setGeo((e.target as HTMLSelectElement).value)}
          aria-label="Filter by geography"
        >
          <option value="all">All geographies</option>
          {Object.entries(GEOGRAPHY_LABELS).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>

        <select
          class="rounded border border-slate-300 px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort((e.target as HTMLSelectElement).value as SortKey)}
          aria-label="Sort by"
        >
          <option value="name">Sort: Worker brand</option>
          <option value="parent">Sort: Parent company</option>
        </select>

        <span class="self-center text-sm text-slate-500">
          {filtered.length} of {providers.length} networks
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <a
            href={`/providers/${p.slug}`}
            class="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 hover:shadow-sm"
          >
            <div class="text-xs uppercase tracking-wide text-slate-400">{p.parentGroup}</div>
            <div class="mt-1 font-semibold">{p.workerBrand}</div>
            <p class="mt-2 line-clamp-2 text-sm text-slate-600">{p.typicalWork}</p>
            <div class="mt-3 flex flex-wrap gap-1">
              {p.domainTags.slice(0, 3).map((tag) => (
                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {DOMAIN_TAG_LABELS[tag] ?? tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <p class="py-12 text-center text-slate-500">No networks match those filters.</p>
      )}
    </div>
  );
}
