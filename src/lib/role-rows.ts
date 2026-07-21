// Shared mapping from a scraped role + its provider into the lightweight
// row shape RolesFilter.tsx renders/filters client-side. Lives here (not in
// the component) so every /roles/* page builds this the same way.
import { getCollection, type CollectionEntry } from 'astro:content';
import { getAllRolesForPages, rolePagePath, type FullRole } from './roles';
import { taskType, locationBucket, payBand, type TaskType, type LocationBucket, type PayBand } from './role-taxonomy';
import { geographyScope } from './taxonomy';

type Provider = CollectionEntry<'providers'>['data'];

export interface RoleWithProvider {
  role: FullRole;
  provider: Provider;
}

// Active roles from expert- and gig-tier providers (restricted-tier
// providers have no public self-serve worker portal, so nothing is ever
// scraped for them). Shared by every /roles/* route so "what counts as an
// eligible role" can't drift between the base index, the hub pages, and the
// individual role pages.
export async function getEligibleActiveRoles(): Promise<RoleWithProvider[]> {
  const [allRoles, providers] = await Promise.all([getAllRolesForPages(), getCollection('providers')]);
  const eligibleProviders = new Map(
    providers
      .filter((p) => p.data.audienceTiers.includes('expert') || p.data.audienceTiers.includes('gig'))
      .map((p) => [p.data.slug, p.data])
  );
  const result: RoleWithProvider[] = [];
  for (const role of allRoles) {
    if (!role.is_active) continue;
    const provider = eligibleProviders.get(role.provider_slug);
    if (provider) result.push({ role, provider });
  }
  return result;
}

function sortByFreshest(items: RoleWithProvider[]): RoleWithProvider[] {
  return items.slice().sort((a, b) => new Date(b.role.last_seen_at).getTime() - new Date(a.role.last_seen_at).getTime());
}

// A role's provider can have multiple domainTags, so a role legitimately
// appears under more than one domain hub — intentional (like a blog post
// under two tags), not duplicate content, since the role's own page (not
// the hub) is what's canonical for that content.
export function groupByDomain(eligible: RoleWithProvider[]): Map<string, RoleWithProvider[]> {
  const map = new Map<string, RoleWithProvider[]>();
  for (const item of eligible) {
    for (const tag of item.provider.domainTags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(item);
    }
  }
  for (const [tag, items] of map) map.set(tag, sortByFreshest(items));
  return map;
}

// Grouping directly from the active-roles list means a company hub only
// ever gets generated for providers that actually have roles — a hub with
// zero roles is exactly the thin-content trap this section is designed to
// avoid, and it never gets the chance to exist here.
export function groupByCompany(eligible: RoleWithProvider[]): Map<string, RoleWithProvider[]> {
  const map = new Map<string, RoleWithProvider[]>();
  for (const item of eligible) {
    const slug = item.provider.slug;
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug)!.push(item);
  }
  for (const [slug, items] of map) map.set(slug, sortByFreshest(items));
  return map;
}

export function groupByTaskType(eligible: RoleWithProvider[]): Map<TaskType, RoleWithProvider[]> {
  const map = new Map<TaskType, RoleWithProvider[]>();
  for (const item of eligible) {
    const type = taskType(item.role);
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push(item);
  }
  for (const [type, items] of map) map.set(type, sortByFreshest(items));
  return map;
}

export function groupByLocationBucket(eligible: RoleWithProvider[]): Map<LocationBucket, RoleWithProvider[]> {
  const map = new Map<LocationBucket, RoleWithProvider[]>();
  for (const item of eligible) {
    const bucket = locationBucket({ location: item.role.location }, geographyScope(item.provider.geography));
    if (!map.has(bucket)) map.set(bucket, []);
    map.get(bucket)!.push(item);
  }
  for (const [bucket, items] of map) map.set(bucket, sortByFreshest(items));
  return map;
}

export interface RoleRow {
  href: string;
  title: string;
  workerBrand: string;
  providerSlug: string;
  domainTags: string[];
  taskType: TaskType;
  locationBucket: LocationBucket;
  payBand: PayBand;
  payText: string | null;
}

export function toRoleRow(role: FullRole, provider: Provider): RoleRow {
  return {
    href: rolePagePath(role),
    title: role.title,
    workerBrand: provider.workerBrand,
    providerSlug: provider.slug,
    domainTags: provider.domainTags,
    taskType: taskType(role),
    locationBucket: locationBucket({ location: role.location }, geographyScope(provider.geography)),
    payBand: payBand(role),
    payText: role.pay_text,
  };
}
