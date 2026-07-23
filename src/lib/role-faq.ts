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
import { geographyScope, confidenceLevel, accessModelCategory, ACCESS_MODEL_LABELS, DOMAIN_TAG_LABELS } from './taxonomy';

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

export function summarizePayBands(stats: HubStats): string {
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

export function summarizeLocations(stats: HubStats): string {
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
  'model-evaluation':
    'Evaluating AI model outputs, authoring test tasks, or reviewing model responses to identify errors, weaknesses, and failure modes.',
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

export const LOCATION_BUCKET_DESCRIPTIONS: Partial<Record<LocationBucket, string>> = {
  remote: 'Fully remote AI-training and evaluation roles with no fixed office location.',
  us: 'AI-training and evaluation roles listed specifically for workers in the United States.',
  'region-specific': 'AI-training and evaluation roles restricted to a specific country or region.',
  'global-ish': 'AI-training and evaluation roles open to applicants worldwide.',
};

export function locationHubFAQs(bucket: LocationBucket, stats: HubStats): FAQItem[] {
  const label = LOCATION_BUCKET_LABELS[bucket];
  const description = LOCATION_BUCKET_DESCRIPTIONS[bucket] ?? `AI-training roles listed as ${label.toLowerCase()}.`;
  return [
    { question: `What are ${label} AI-training roles?`, answer: description },
    {
      question: `How many ${label} roles are currently open?`,
      answer: `${stats.totalRoles} open ${label.toLowerCase()} roles are currently listed across HumanSourcer's tracked networks. This count updates daily.`,
    },
    {
      question: `Which companies have ${label} roles?`,
      answer: `Currently: ${formatCompanyList(stats.companies)}.`,
    },
    { question: `What do ${label} roles pay?`, answer: summarizePayBands(stats) },
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

// --- Comparison pages ------------------------------------------------------

// Objective ordering derived from the existing confidenceLevel() taxonomy
// enum — never an invented opinion about which provider is "more trustworthy",
// just a comparison of the same confirmed/reported classification already
// shown on each provider's own page.
const CONFIDENCE_RANK: Record<ReturnType<typeof confidenceLevel>, number> = {
  confirmed: 2,
  high: 1,
  medium: 0,
};

function topPayBand(stats: HubStats): [PayBand, number] | null {
  const known = stats.totalRoles - (stats.payBandCounts.unspecified ?? 0);
  if (known === 0) return null;
  return (Object.entries(stats.payBandCounts) as [PayBand, number][])
    .filter(([band]) => band !== 'unspecified')
    .sort((a, b) => b[1] - a[1])[0];
}

const PAY_BAND_RANK: Record<PayBand, number> = {
  unspecified: -1,
  'project-based': 0,
  'under-20': 1,
  '20-40': 2,
  '40-plus': 3,
};

function remoteShare(stats: HubStats): number {
  return (stats.locationCounts.remote ?? 0) / stats.totalRoles;
}

// Every answer traces to a real field on the provider registry or a
// computeHubStats() output for that provider's own currently-active roles —
// same no-fabrication discipline as the rest of this file. Comparative
// framing only (which has more/higher/faster), never a subjective "which is
// better" verdict; that editorial judgment lives in the hand-written `angle`
// field on the comparisons.json entry instead, not here.
export function comparisonFAQs(
  providerA: Provider,
  statsA: HubStats,
  providerB: Provider,
  statsB: HubStats
): FAQItem[] {
  const a = providerA.workerBrand;
  const b = providerB.workerBrand;

  const roleCountAnswer =
    statsA.totalRoles === statsB.totalRoles
      ? `${a} and ${b} currently have the same number of open roles listed: ${statsA.totalRoles} each.`
      : statsA.totalRoles > statsB.totalRoles
        ? `${a} currently has more open roles: ${statsA.totalRoles} vs ${b}'s ${statsB.totalRoles}.`
        : `${b} currently has more open roles: ${statsB.totalRoles} vs ${a}'s ${statsA.totalRoles}.`;

  const remoteA = remoteShare(statsA);
  const remoteB = remoteShare(statsB);
  const remoteAnswer =
    Math.round(remoteA * 100) === Math.round(remoteB * 100)
      ? `${a} and ${b} list a similar share of remote roles (${Math.round(remoteA * 100)}% and ${Math.round(remoteB * 100)}% respectively).`
      : remoteA > remoteB
        ? `${a} lists a higher share of remote roles (${Math.round(remoteA * 100)}%) than ${b} (${Math.round(remoteB * 100)}%).`
        : `${b} lists a higher share of remote roles (${Math.round(remoteB * 100)}%) than ${a} (${Math.round(remoteA * 100)}%).`;

  const payA = topPayBand(statsA);
  const payB = topPayBand(statsB);
  const payAnswer =
    !payA || !payB
      ? `Pay isn't disclosed clearly enough on one or both sides to compare directly — check each role's listing for current compensation details.`
      : PAY_BAND_RANK[payA[0]] === PAY_BAND_RANK[payB[0]]
        ? `Where disclosed, ${a} and ${b} cluster in a similar pay range: ${PAY_BAND_LABELS[payA[0]]}.`
        : PAY_BAND_RANK[payA[0]] > PAY_BAND_RANK[payB[0]]
          ? `Where disclosed, ${a}'s most common pay range (${PAY_BAND_LABELS[payA[0]]}) is higher than ${b}'s (${PAY_BAND_LABELS[payB[0]]}).`
          : `Where disclosed, ${b}'s most common pay range (${PAY_BAND_LABELS[payB[0]]}) is higher than ${a}'s (${PAY_BAND_LABELS[payA[0]]}).`;

  const confA = confidenceLevel(providerA.ownershipConfidence);
  const confB = confidenceLevel(providerB.ownershipConfidence);
  const confidenceAnswer =
    CONFIDENCE_RANK[confA] === CONFIDENCE_RANK[confB]
      ? `${a} and ${b} carry the same ownership-confidence rating: ${confA}, verified via ${new URL(providerA.relationshipEvidenceUrl).hostname} and ${new URL(providerB.relationshipEvidenceUrl).hostname} respectively.`
      : `${CONFIDENCE_RANK[confA] > CONFIDENCE_RANK[confB] ? a : b}'s ownership is rated with higher confidence (${CONFIDENCE_RANK[confA] > CONFIDENCE_RANK[confB] ? confA : confB}) than ${CONFIDENCE_RANK[confA] > CONFIDENCE_RANK[confB] ? b : a}'s (${CONFIDENCE_RANK[confA] > CONFIDENCE_RANK[confB] ? confB : confA}).`;

  const sharedTags = providerA.domainTags.filter((t) => providerB.domainTags.includes(t));
  const domainAnswer =
    sharedTags.length === 0
      ? `${a} and ${b} don't share any domain tags — ${a} covers ${providerA.domainTags.map((t) => DOMAIN_TAG_LABELS[t] ?? t).join(', ')}, while ${b} covers ${providerB.domainTags.map((t) => DOMAIN_TAG_LABELS[t] ?? t).join(', ')}.`
      : `Yes — both hire for ${sharedTags.map((t) => DOMAIN_TAG_LABELS[t] ?? t).join(', ')}. ${a} additionally covers ${providerA.domainTags.filter((t) => !sharedTags.includes(t)).map((t) => DOMAIN_TAG_LABELS[t] ?? t).join(', ') || 'nothing else'}; ${b} additionally covers ${providerB.domainTags.filter((t) => !sharedTags.includes(t)).map((t) => DOMAIN_TAG_LABELS[t] ?? t).join(', ') || 'nothing else'}.`;

  const accessA = ACCESS_MODEL_LABELS[accessModelCategory(providerA.accessModel)];
  const accessB = ACCESS_MODEL_LABELS[accessModelCategory(providerB.accessModel)];
  const accessAnswer =
    accessA === accessB
      ? `${a} and ${b} share the same broad access model: ${accessA}.`
      : `${a}'s access model is "${accessA}" (${providerA.accessModel}); ${b}'s is "${accessB}" (${providerB.accessModel}).`;

  return [
    { question: `${a} vs ${b}: which has more open roles right now?`, answer: roleCountAnswer },
    { question: `Is ${a} or ${b} more remote-friendly?`, answer: remoteAnswer },
    { question: `Which pays more, ${a} or ${b}?`, answer: payAnswer },
    { question: `Which has higher ownership confidence, ${a} or ${b}?`, answer: confidenceAnswer },
    { question: `Do ${a} and ${b} overlap in what they hire for?`, answer: domainAnswer },
    { question: `What's the difference between ${a} and ${b}'s access model?`, answer: accessAnswer },
  ];
}
