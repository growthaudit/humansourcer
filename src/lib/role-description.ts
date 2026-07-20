// Composes genuine on-page body copy for a role from fields already on
// hand, used whenever the scraped `description` is missing or too thin to
// stand as a real page (human, mindrift, and mercor never populate it; a
// future source might not either). This same string feeds both the visible
// role page and JobPosting.description in src/lib/jsonld.ts, so the two can
// never disagree. Never fabricates duties, pay, or location — only joins
// clauses built from fields that actually exist on the row.

import type { CollectionEntry } from 'astro:content';
import { DOMAIN_TAG_LABELS } from './taxonomy';
import { PAY_TEXT_NOT_REAL_PAY } from './role-taxonomy';

type Provider = CollectionEntry<'providers'>['data'];

interface DescribableRole {
  provider_slug: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  pay_text: string | null;
}

const MIN_REAL_DESCRIPTION_LENGTH = 40;

export function composeRoleDescription(role: DescribableRole, provider: Provider): string {
  const scraped = role.description?.trim();
  if (scraped && scraped.length >= MIN_REAL_DESCRIPTION_LENGTH) return scraped;

  const parts = [
    `${provider.workerBrand} is recruiting for ${role.title}${role.category ? ` (${role.category})` : ''} as part of ${provider.parentGroup}'s ${provider.portalType.toLowerCase()}.`,
    provider.typicalWork,
    role.location ? `This role is based in or open to: ${role.location}.` : null,
    role.pay_text && !PAY_TEXT_NOT_REAL_PAY.has(role.provider_slug)
      ? `Compensation: ${role.pay_text}.`
      : null,
    `Domains: ${provider.domainTags.map((tag) => DOMAIN_TAG_LABELS[tag] ?? tag).join(', ')}.`,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' ');
}
