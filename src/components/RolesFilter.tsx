import { useEffect, useMemo, useState } from 'preact/hooks';
import { DOMAIN_TAG_LABELS } from '../lib/taxonomy';
import {
  TASK_TYPE_LABELS,
  LOCATION_BUCKET_LABELS,
  PAY_BAND_LABELS,
  type TaskType,
  type LocationBucket,
} from '../lib/role-taxonomy';
import type { RoleRow } from '../lib/role-rows';

// IMPORTANT — SEO guardrail, do not remove: this component must NEVER
// mutate document.querySelector('link[rel=canonical]') or the robots meta
// tag, and never claims to be a new indexable page. The page it's mounted
// on always server-renders a fixed, bounded set of roles (one hub page,
// one pagination page) — that server-rendered set (and its canonical URL)
// is unaffected by anything below.
//
// What DOES change client-side: once mounted, this component fetches
// /roles-data.json (a build-time snapshot of every eligible role) so the
// dropdowns and search can operate on the real, full dataset rather than
// just the ~24 roles the current page happens to contain — otherwise "All
// companies" only ever lists whichever companies landed on this page.
// `scope` narrows that full dataset down to whatever facet this page is
// already pinned to (e.g. one company's hub), so a hub page's filters
// still can't leak roles from outside that facet. The default (no active
// filter) view still renders exactly the server-rendered `roles` prop, so
// the bounded-page/pagination behavior and no-JS experience are unchanged
// — the full dataset only takes over once the visitor actually filters.

interface Scope {
  providerSlug?: string;
  domainTag?: string;
  taskType?: TaskType;
  locationBucket?: LocationBucket;
}

interface Props {
  roles: RoleRow[];
  scope?: Scope;
}

function matchesScope(r: RoleRow, scope?: Scope): boolean {
  if (!scope) return true;
  if (scope.providerSlug && r.providerSlug !== scope.providerSlug) return false;
  if (scope.domainTag && !r.domainTags.includes(scope.domainTag)) return false;
  if (scope.taskType && r.taskType !== scope.taskType) return false;
  if (scope.locationBucket && r.locationBucket !== scope.locationBucket) return false;
  return true;
}

const ALL = 'all';

function readParam(name: string): string {
  if (typeof window === 'undefined') return ALL;
  return new URLSearchParams(window.location.search).get(name) ?? ALL;
}

export default function RolesFilter({ roles, scope }: Props) {
  const [domain, setDomain] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [task, setTask] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [pay, setPay] = useState(ALL);
  const [query, setQuery] = useState('');
  const [fullRoles, setFullRoles] = useState<RoleRow[] | null>(null);

  // Fetch the full dataset once on mount. Failure just means the dropdowns
  // and search stay scoped to the server-rendered page, same as before —
  // no worse than the pre-fix behavior.
  useEffect(() => {
    fetch('/roles-data.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setFullRoles(data);
      })
      .catch(() => {});
  }, []);

  const scopedFullRoles = useMemo(
    () => (fullRoles ? fullRoles.filter((r) => matchesScope(r, scope)) : null),
    [fullRoles, scope]
  );

  const isFilterActive =
    domain !== ALL || company !== ALL || task !== ALL || location !== ALL || pay !== ALL || query.trim() !== '';

  // The pool everything below searches/lists options from: the full
  // (scoped) dataset once it's loaded and the visitor has actually
  // engaged a filter; otherwise the original server-rendered page slice.
  const searchPool = isFilterActive && scopedFullRoles ? scopedFullRoles : roles;
  const optionsPool = scopedFullRoles ?? roles;

  // Restore filter state from the URL on mount (shareable/bookmarkable
  // filtered views) — read-only sync, never touches canonical/robots.
  useEffect(() => {
    setDomain(readParam('domain'));
    setCompany(readParam('company'));
    setTask(readParam('task'));
    setLocation(readParam('location'));
    setPay(readParam('pay'));
    setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (domain !== ALL) params.set('domain', domain);
    if (company !== ALL) params.set('company', company);
    if (task !== ALL) params.set('task', task);
    if (location !== ALL) params.set('location', location);
    if (pay !== ALL) params.set('pay', pay);
    if (query) params.set('q', query);
    const search = params.toString();
    const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [domain, company, task, location, pay, query]);

  const allDomains = useMemo(() => {
    const set = new Set<string>();
    optionsPool.forEach((r) => r.domainTags.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [optionsPool]);

  const allCompanies = useMemo(() => {
    const map = new Map<string, string>();
    optionsPool.forEach((r) => map.set(r.providerSlug, r.workerBrand));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [optionsPool]);

  const allTaskTypes = useMemo(() => {
    const set = new Set<TaskType>();
    optionsPool.forEach((r) => set.add(r.taskType));
    return [...set];
  }, [optionsPool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return searchPool.filter((r) => {
      if (domain !== ALL && !r.domainTags.includes(domain)) return false;
      if (company !== ALL && r.providerSlug !== company) return false;
      if (task !== ALL && r.taskType !== task) return false;
      if (location !== ALL && r.locationBucket !== location) return false;
      if (pay !== ALL && r.payBand !== pay) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.workerBrand.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [searchPool, domain, company, task, location, pay, query]);

  return (
    <div>
      <div class="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search roles..."
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          aria-label="Search roles"
        />

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={domain}
          onChange={(e) => setDomain((e.target as HTMLSelectElement).value)}
          aria-label="Filter by domain"
        >
          <option value={ALL}>All domains</option>
          {allDomains.map((d) => (
            <option value={d}>{DOMAIN_TAG_LABELS[d] ?? d}</option>
          ))}
        </select>

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={company}
          onChange={(e) => setCompany((e.target as HTMLSelectElement).value)}
          aria-label="Filter by company"
        >
          <option value={ALL}>All companies</option>
          {allCompanies.map(([slug, name]) => (
            <option value={slug}>{name}</option>
          ))}
        </select>

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={task}
          onChange={(e) => setTask((e.target as HTMLSelectElement).value)}
          aria-label="Filter by task type"
        >
          <option value={ALL}>All task types</option>
          {allTaskTypes.map((t) => (
            <option value={t}>{TASK_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={location}
          onChange={(e) => setLocation((e.target as HTMLSelectElement).value)}
          aria-label="Filter by location"
        >
          <option value={ALL}>All locations</option>
          {Object.entries(LOCATION_BUCKET_LABELS).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>

        <select
          class="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink-primary"
          value={pay}
          onChange={(e) => setPay((e.target as HTMLSelectElement).value)}
          aria-label="Filter by pay"
        >
          <option value={ALL}>All pay bands</option>
          {Object.entries(PAY_BAND_LABELS).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>

        <span class="self-center text-sm text-ink-secondary">
          {filtered.length} of {searchPool.length} roles
        </span>
      </div>

      <div class="space-y-3">
        {filtered.map((r) => (
          <a
            href={r.href}
            class="block rounded-lg border border-border p-4 transition-colors duration-200 ease-out hover:border-border-strong hover:shadow-sm"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="font-medium text-ink-primary">{r.title}</div>
              {r.payText && <span class="whitespace-nowrap text-sm text-ink-secondary">{r.payText}</span>}
            </div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs text-ink-tertiary">
              <span>{r.workerBrand}</span>
              <span>&middot; {TASK_TYPE_LABELS[r.taskType]}</span>
              <span>&middot; {LOCATION_BUCKET_LABELS[r.locationBucket]}</span>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && <p class="py-12 text-center text-ink-secondary">No roles match those filters.</p>}
    </div>
  );
}
