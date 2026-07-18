import type { CollectionEntry } from 'astro:content';

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
