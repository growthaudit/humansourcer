// Data-derived FAQ content for /roles/* pages — SEO/AEO/GEO content: direct,
// extractable Q&A answering what someone actually asks about a role or a
// category of roles (pay, remote status, legitimacy, "how many are open
// right now"). Every answer is composed from fields already in the
// database/provider registry, same discipline as role-description.ts —
// never a fabricated stat or claim, and every generated answer varies with
// the real underlying data so pages don't collapse into identical
// boilerplate at scale.

import type { CollectionEntry } from 'astro:content';
import type { FullRole } from './roles';
import type { RoleWithProvider } from './role-rows';
import {
  taskType,
  locationBucket,
  payBand,
  PAY_TEXT_NOT_REAL_PAY,
  TASK_TYPE_LABELS,
  LOCATION_BUCKET_LABELS,
  PAY_BAND_LABELS,
  type TaskType,
  type LocationBucket,
  type PayBand,
} from './role-taxonomy';
import { geographyScope, DOMAIN_TAG_LABELS } from './taxonomy';

type Provider = CollectionEntry<'providers'>['data'];

export interface FAQItem {
  question: string;
  answer: string;
}

// --- Individual role page -------------------------------------------------

export function roleFAQs(role: FullRole, provider: Provider): FAQItem[] {
  const task = taskType(role);
  const bucket = locationBucket({ location: role.location }, geographyScope(provider.geography));

  const locationAnswer = (() => {
    switch (bucket) {
      case 'remote':
        return `Yes — ${provider.workerBrand} lists this role as remote.`;
      case 'us':
        return 'This role is listed for the United States.';
      case 'region-specific':
        return `This role is listed for: ${role.location}.`;
      case 'global-ish':
        return 'This role is listed as open globally.';
      default:
        return `${provider.workerBrand} doesn't publicly specify a location for this role — check the source listing for details.`;
    }
  })();

  const payAnswer =
    role.pay_text && !PAY_TEXT_NOT_REAL_PAY.has(role.provider_slug)
      ? `${provider.workerBrand} lists this role's pay as ${role.pay_text}.`
      : `Pay isn't publicly disclosed for this role by ${provider.workerBrand} — check the source listing for current compensation details.`;

  return [
    {
      question: `How do I apply for the ${role.title} role at ${provider.workerBrand}?`,
      answer: `Apply directly through ${provider.workerBrand}'s own application process — HumanSourcer links out to the listing and doesn't handle applications or hiring directly.`,
    },
    {
      question: `Is the ${role.title} role at ${provider.workerBrand} remote?`,
      answer: locationAnswer,
    },
    {
      question: `What does the ${role.title} role at ${provider.workerBrand} pay?`,
      answer: payAnswer,
    },
    {
      question: `What kind of work is ${role.title}?`,
      answer: `${TASK_TYPE_LABELS[task]}. ${provider.typicalWork}`,
    },
    {
      question: `Is ${provider.workerBrand} a legitimate AI-training platform?`,
      answer: `${provider.workerBrand}'s connection to ${provider.parentGroup}: ${provider.relationship}. Ownership confidence: ${provider.ownershipConfidence} — verified via ${new URL(provider.relationshipEvidenceUrl).hostname}.`,
    },
  ];
}

// --- Hub pages (domain / company / task) ----------------------------------

export interface HubStats {
  totalRoles: number;
  companies: string[];
  payBandCounts: Record<PayBand, number>;
  locationCounts: Record<LocationBucket, number>;
}

export function computeHubStats(items: RoleWithProvider[]): HubStats {
  const payBandCounts = {} as Record<PayBand, number>;
  const locationCounts = {} as Record<LocationBucket, number>;
  const companies = new Set<string>();

  for (const { role, provider } of items) {
    const band = payBand(role);
    payBandCounts[band] = (payBandCounts[band] ?? 0) + 1;
    const bucket = locationBucket({ location: role.location }, geographyScope(provider.geography));
    locationCounts[bucket] = (locationCounts[bucket] ?? 0) + 1;
    companies.add(provider.workerBrand);
  }

  return {
    totalRoles: items.length,
    companies: [...companies].sort(),
    payBandCounts,
    locationCounts,
  };
}

function formatCompanyList(companies: string[]): string {
  if (companies.length <= 6) return companies.join(', ');
  return `${companies.slice(0, 6).join(', ')}, and ${companies.length - 6} more`;
}

function summarizePayBands(stats: HubStats): string {
  const unspecified = stats.payBandCounts.unspecified ?? 0;
  const known = stats.totalRoles - unspecified;
  if (known === 0) {
    return "Most listings don't publicly disclose pay upfront — check each role for current compensation details.";
  }
  const [topBand, topCount] = (Object.entries(stats.payBandCounts) as [PayBand, number][])
    .filter(([band]) => band !== 'unspecified')
    .sort((a, b) => b[1] - a[1])[0];
  const unspecifiedNote =
    unspecified > 0 ? ` ${unspecified} of ${stats.totalRoles} listings don't publicly disclose pay.` : '';
  return `Where pay is disclosed, the most common range is ${PAY_BAND_LABELS[topBand]} (${topCount} of ${stats.totalRoles} roles).${unspecifiedNote}`;
}

function summarizeLocations(stats: HubStats): string {
  const [topBucket, topCount] = (Object.entries(stats.locationCounts) as [LocationBucket, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const pct = Math.round((topCount / stats.totalRoles) * 100);
  if (topBucket === 'remote') {
    return `${topCount} of ${stats.totalRoles} roles (${pct}%) are listed as remote.`;
  }
  return `Location varies by role — the most common listing type is "${LOCATION_BUCKET_LABELS[topBucket]}" (${topCount} of ${stats.totalRoles} roles).`;
}

export const DOMAIN_TAG_DESCRIPTIONS: Record<string, string> = {
  law: 'Reviewing legal documents, evaluating AI-generated legal reasoning, or contributing legal domain expertise to train and test AI models.',
  medicine:
    'Reviewing clinical scenarios, evaluating medical accuracy, or contributing healthcare domain expertise to train and test AI models.',
  finance:
    'Reviewing financial analysis, evaluating quantitative reasoning, or contributing finance domain expertise to train and test AI models.',
  coding: 'Writing, reviewing, or evaluating code and technical scenarios used to train and test AI coding assistants.',
  'science-stem':
    'Contributing scientific or technical domain expertise — from physics to biology to engineering — to train and evaluate AI models.',
  linguistics:
    'Translating, evaluating language quality, or contributing linguistic expertise across languages and dialects to train AI models.',
  safety:
    'Evaluating AI outputs for safety, bias, or policy compliance, and helping define the boundaries of acceptable AI behavior.',
  'writing-creative':
    'Writing, editing, or evaluating creative and long-form content used to train AI language and writing capabilities.',
  'consulting-ops':
    'Contributing business, operations, or consulting expertise to evaluate AI outputs in professional and workplace contexts.',
  'voice-speech': 'Recording, evaluating, or annotating voice and audio data used to train AI speech and voice models.',
  generalist: "Broad, non-specialist AI training and evaluation work that doesn't require a specific professional credential.",
  'reasoning-agent': 'Evaluating multi-step reasoning, agentic task execution, or AI decision-making in complex workflows.',
};

export const TASK_TYPE_DESCRIPTIONS: Record<TaskType, string> = {
  'coding-swe':
    'Software engineering work — writing, reviewing, or building tools and systems, often specifically to support AI training or evaluation.',
  'data-annotation-labeling': 'Labeling, annotating, or collecting structured data used to train AI models.',
  'model-evaluation-red-teaming':
    'Evaluating AI model outputs, authoring test tasks, or red-teaming models to find weaknesses and failure modes.',
  'writing-editing': 'Writing or editing content used to train or evaluate AI language capabilities.',
  'voice-audio': 'Recording, evaluating, or acting for voice and audio data used to train AI speech models.',
  'research-analysis': 'Research and analytical work supporting AI training, evaluation, or benchmarking.',
  'translation-linguistics': 'Translating or evaluating language content across languages and dialects.',
  'customer-support-ops': 'Operations, support, or administrative work supporting an AI-training program.',
  other: "General AI-training and evaluation work that doesn't fit a narrower category — see the specific role listing for details.",
};

export function domainHubFAQs(tag: string, stats: HubStats): FAQItem[] {
  const label = DOMAIN_TAG_LABELS[tag] ?? tag;
  const description = DOMAIN_TAG_DESCRIPTIONS[tag] ?? `AI-training work in the ${label} domain.`;
  return [
    { question: `What is ${label} AI-training work?`, answer: description },
    {
      question: `How many ${label} roles are currently open?`,
      answer: `${stats.totalRoles} open ${label.toLowerCase()} roles are currently listed across HumanSourcer's tracked networks. This count updates daily.`,
    },
    {
      question: `Which companies hire for ${label} roles?`,
      answer: `Currently: ${formatCompanyList(stats.companies)}.`,
    },
    { question: `What do ${label} roles pay?`, answer: summarizePayBands(stats) },
    { question: `Are ${label} roles remote?`, answer: summarizeLocations(stats) },
  ];
}

export function taskHubFAQs(type: TaskType, stats: HubStats): FAQItem[] {
  const label = TASK_TYPE_LABELS[type];
  const description = TASK_TYPE_DESCRIPTIONS[type];
  return [
    { question: `What is ${label} work?`, answer: description },
    {
      question: `How many ${label} roles are currently open?`,
      answer: `${stats.totalRoles} open ${label.toLowerCase()} roles are currently listed across HumanSourcer's tracked networks. This count updates daily.`,
    },
    {
      question: `Which companies need ${label} workers?`,
      answer: `Currently: ${formatCompanyList(stats.companies)}.`,
    },
    { question: `What does ${label} work pay?`, answer: summarizePayBands(stats) },
    { question: `Is ${label} work remote?`, answer: summarizeLocations(stats) },
  ];
}

export function companyHubFAQs(provider: Provider, stats: HubStats): FAQItem[] {
  return [
    {
      question: `What does ${provider.workerBrand} do?`,
      answer: `${provider.workerBrand}'s connection to ${provider.parentGroup}: ${provider.relationship}. ${provider.typicalWork}`,
    },
    {
      question: `How many open roles does ${provider.workerBrand} have right now?`,
      answer: `${stats.totalRoles} open roles are currently listed. This count updates daily.`,
    },
    { question: `What does ${provider.workerBrand} pay?`, answer: summarizePayBands(stats) },
    { question: `Is ${provider.workerBrand} remote-friendly?`, answer: summarizeLocations(stats) },
    {
      question: `Is ${provider.workerBrand} legitimate?`,
      answer: `Ownership confidence: ${provider.ownershipConfidence} — verified via ${new URL(provider.relationshipEvidenceUrl).hostname}.`,
    },
  ];
}
