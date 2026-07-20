import type { CollectionEntry } from 'astro:content';
import type { FullRole } from './roles';
import { composeRoleDescription } from './role-description';
import { locationBucket } from './role-taxonomy';
import { geographyScope } from './taxonomy';

type Provider = CollectionEntry<'providers'>['data'];

export function organizationJsonLd(provider: Provider, profileUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: provider.workerBrand,
    url: provider.workerUrl,
    parentOrganization: {
      '@type': 'Organization',
      name: provider.parentGroup,
    },
    description: provider.typicalWork,
    sameAs: [profileUrl],
  };
}

export function itemListJsonLd(
  items: { name: string; url: string }[],
  listUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url: listUrl,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function breadcrumbListJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Only a raw pay_unit value we can confidently map to a Google-supported
// schema.org unitText goes here. Deliberately conservative: vetto's
// PER_PACKAGE roles have real pay_min but no clean schema.org unit, so they
// correctly get no baseSalary at all rather than a force-mapped guess.
const SCHEMA_SAFE_UNIT: Record<string, 'HOUR'> = {
  hourly: 'HOUR',
  hour: 'HOUR',
  hr: 'HOUR',
};

// Only call this for is_active roles — grace-window ("no longer listed")
// pages must not claim JobPosting rich-result eligibility for a role that's
// gone, per Google's own guidance. Callers gate on role.is_active.
export function jobPostingJsonLd(role: FullRole, provider: Provider, roleUrl: string) {
  const unit = role.pay_unit ? SCHEMA_SAFE_UNIT[role.pay_unit.toLowerCase()] : undefined;
  const baseSalary =
    role.pay_min != null && unit
      ? {
          '@type': 'MonetaryAmount',
          currency: role.pay_currency ?? 'USD',
          value: {
            '@type': 'QuantitativeValue',
            minValue: role.pay_min,
            maxValue: role.pay_max ?? role.pay_min,
            unitText: unit,
          },
        }
      : undefined;

  const bucket = locationBucket({ location: role.location }, geographyScope(provider.geography));
  const locationFields =
    bucket === 'remote'
      ? { jobLocationType: 'TELECOMMUTE' as const }
      : role.location
        ? { jobLocation: { '@type': 'Place', address: role.location } }
        : {};

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: role.title,
    description: composeRoleDescription(role, provider),
    // No validThrough — omit rather than fabricate an expiry date.
    // Staleness is handled by prompt removal (the grace-window mechanism in
    // src/lib/roles.ts) instead, a stronger freshness signal than a guess.
    datePosted: role.first_seen_at,
    hiringOrganization: {
      '@type': 'Organization',
      name: provider.workerBrand,
      sameAs: provider.workerUrl,
    },
    identifier: {
      '@type': 'PropertyValue',
      name: provider.workerBrand,
      value: `${role.provider_slug}:${role.source_role_id}`,
    },
    url: roleUrl,
    // We redirect out to the source's own application flow — never a native
    // on-site apply.
    directApply: false,
    ...(baseSalary ? { baseSalary } : {}),
    ...locationFields,
  };
}
