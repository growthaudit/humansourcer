import { useMemo, useState } from 'preact/hooks';
import {
  ACCESS_MODEL_LABELS,
  GEOGRAPHY_LABELS,
  DOMAIN_TAG_LABELS,
  type AccessModelCategory,
  type GeographyScope,
} from '../lib/taxonomy';

export type AudienceTier = 'expert' | 'gig' | 'restricted';

export interface ProviderRow {
  slug: string;
  href: string; // canonical detail URL: /providers/{slug} for every tier
  workerBrand: string;
  parentGroup: string;
  typicalWork: string;
  domainTags: string[];
  audienceTiers: AudienceTier[];
  accessModelCategory: AccessModelCategory;
  geographyScope: GeographyScope;
}

interface Props {
  providers: ProviderRow[];
  // Tier-scoped listing pages (/providers/gig/, /providers/experts/, ...)
  // pass rows pre-filtered to one tier, so the tier dropdown would be
  // redundant (and misleadingly imply other tiers are selectable here).
  hideTierFilter?: boolean;
}

type SortKey = 'name' | 'parent';

const TIER_LABELS: Record<AudienceTier, string> = {
  expert: 'Expert',
  gig: 'Gig',
  restricted: 'Restricted',
};

export default function ProviderFilter({ providers, hideTierFilter }: Props) {
  const [tier, setTier] = useState<string>('all');
  const [domain, setDomain] = useState<string>('all');
  const [access, setAccess] = useState<string>('all');
  const [geo, setGeo] = useState<string>('all');
  const [company, setCompany] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const allDomains = useMemo(() => {
    const set = new Set<string>();
    providers.forEach((p) => p.domainTags.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [providers]);

  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    providers.forEach((p) => set.add(p.parentGroup));
    return [...set].sort();
  }, [providers]);

  const filtered = useMemo(() => {
    let rows = providers.filter((p) => {
      if (tier !== 'all' && !p.audienceTiers.includes(tier as AudienceTier)) return false;
      if (domain !== 'all' && !p.domainTags.includes(domain)) return false;
      if (access !== 'all' && p.accessModelCategory !== access) return false;
      if (geo !== 'all' && p.geographyScope !== geo) return false;
      if (company !== 'all' && p.parentGroup !== company) return false;
      return true;
    });
    rows = rows.slice().sort((a, b) => {
      const key = sort === 'name' ? 'workerBrand' : 'parentGroup';
      return a[key].localeCompare(b[key]);
    });
    return rows;
  }, [providers, tier, domain, access, geo, company, sort]);

  return (
    <div>
      <div class="mb-6 flex flex-wrap gap-3">
        {!hideTierFilter && (
          <select
            class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
            value={tier}
            onChange={(e) => setTier((e.target as HTMLSelectElement).value)}
            aria-label="Filter by tier"
          >
            <option value="all">All tiers</option>
            {Object.entries(TIER_LABELS).map(([value, label]) => (
              <option value={value}>{label}</option>
            ))}
          </select>
        )}

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
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
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
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
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
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
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={company}
          onChange={(e) => setCompany((e.target as HTMLSelectElement).value)}
          aria-label="Filter by company"
        >
          <option value="all">All companies</option>
          {allCompanies.map((c) => (
            <option value={c}>{c}</option>
          ))}
        </select>

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={sort}
          onChange={(e) => setSort((e.target as HTMLSelectElement).value as SortKey)}
          aria-label="Sort by"
        >
          <option value="name">Sort: Worker brand</option>
          <option value="parent">Sort: Parent company</option>
        </select>

        <span class="self-center text-sm text-ink-secondary">
          {filtered.length} of {providers.length} networks
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <a
            href={p.href}
            class="block rounded-lg border border-border p-4 transition-colors duration-200 ease-out hover:border-border-strong hover:shadow-sm"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs uppercase tracking-wide text-ink-tertiary">{p.parentGroup}</div>
              <span class="whitespace-nowrap rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-secondary">
                {p.audienceTiers.map((t) => TIER_LABELS[t]).join(' + ')}
              </span>
            </div>
            <div class="mt-1 font-semibold">{p.workerBrand}</div>
            <p class="mt-2 line-clamp-2 text-sm text-ink-secondary">{p.typicalWork}</p>
            <div class="mt-3 flex flex-wrap gap-1">
              {p.domainTags.slice(0, 3).map((tag) => (
                <span class="rounded bg-surface-raised px-2 py-0.5 text-xs text-ink-secondary">
                  {DOMAIN_TAG_LABELS[tag] ?? tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <p class="py-12 text-center text-ink-secondary">No networks match those filters.</p>
      )}
    </div>
  );
}
