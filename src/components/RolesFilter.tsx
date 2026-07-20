import { useEffect, useMemo, useState } from 'preact/hooks';
import { DOMAIN_TAG_LABELS } from '../lib/taxonomy';
import { TASK_TYPE_LABELS, LOCATION_BUCKET_LABELS, PAY_BAND_LABELS, type TaskType } from '../lib/role-taxonomy';
import type { RoleRow } from '../lib/role-rows';

// IMPORTANT — SEO guardrail, do not remove: this component must NEVER
// mutate document.querySelector('link[rel=canonical]') or the robots meta
// tag. The page it's mounted on always server-renders a fixed, bounded set
// of roles (one hub page, one pagination page); this component only
// narrows *that already-loaded set* client-side and reflects the choice
// into the URL query string via history.pushState (shareable/back-button-
// friendly), it never fetches a different/larger dataset and never claims
// to be a new indexable page. Combining facets this way is intentionally
// NOT a substitute for the single-facet hub pages (/roles/domain/[tag]/
// etc.) — those stay the crawlable surface; this is a client-side
// convenience layered on top of whatever the current page already rendered.

interface Props {
  roles: RoleRow[];
}

const ALL = 'all';

function readParam(name: string): string {
  if (typeof window === 'undefined') return ALL;
  return new URLSearchParams(window.location.search).get(name) ?? ALL;
}

export default function RolesFilter({ roles }: Props) {
  const [domain, setDomain] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [task, setTask] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [pay, setPay] = useState(ALL);
  const [query, setQuery] = useState('');

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
    roles.forEach((r) => r.domainTags.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [roles]);

  const allCompanies = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((r) => map.set(r.providerSlug, r.workerBrand));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [roles]);

  const allTaskTypes = useMemo(() => {
    const set = new Set<TaskType>();
    roles.forEach((r) => set.add(r.taskType));
    return [...set];
  }, [roles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((r) => {
      if (domain !== ALL && !r.domainTags.includes(domain)) return false;
      if (company !== ALL && r.providerSlug !== company) return false;
      if (task !== ALL && r.taskType !== task) return false;
      if (location !== ALL && r.locationBucket !== location) return false;
      if (pay !== ALL && r.payBand !== pay) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.workerBrand.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roles, domain, company, task, location, pay, query]);

  return (
    <div>
      <div class="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search roles..."
          class="rounded border border-slate-300 px-3 py-2 text-sm"
          aria-label="Search roles"
        />

        <select
          class="rounded border border-slate-300 px-3 py-2 text-sm"
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
          class="rounded border border-slate-300 px-3 py-2 text-sm"
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
          class="rounded border border-slate-300 px-3 py-2 text-sm"
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
          class="rounded border border-slate-300 px-3 py-2 text-sm"
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
          class="rounded border border-slate-300 px-3 py-2 text-sm"
          value={pay}
          onChange={(e) => setPay((e.target as HTMLSelectElement).value)}
          aria-label="Filter by pay"
        >
          <option value={ALL}>All pay bands</option>
          {Object.entries(PAY_BAND_LABELS).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>

        <span class="self-center text-sm text-slate-500">
          {filtered.length} of {roles.length} roles
        </span>
      </div>

      <div class="space-y-3">
        {filtered.map((r) => (
          <a
            href={r.href}
            class="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 hover:shadow-sm"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="font-medium">{r.title}</div>
              {r.payText && <span class="whitespace-nowrap text-sm text-slate-500">{r.payText}</span>}
            </div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{r.workerBrand}</span>
              <span>&middot; {TASK_TYPE_LABELS[r.taskType]}</span>
              <span>&middot; {LOCATION_BUCKET_LABELS[r.locationBucket]}</span>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && <p class="py-12 text-center text-slate-500">No roles match those filters.</p>}
    </div>
  );
}
