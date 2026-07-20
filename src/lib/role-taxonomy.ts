// Coarse, filterable buckets derived from scraped role fields, in the same
// spirit as taxonomy.ts (degrade to a reasonable guess rather than throw).
// Unlike taxonomy.ts, this is NOT an exact-string lookup map — role titles
// are unbounded freeform text across 10+ sources (not a small curated enum
// like the provider registry's accessModel/geography strings), so
// classification here is ordered keyword-matching against title/category
// text. Treat this as best-effort, not authoritative: it's for filtering UX,
// not a factual claim about the role. Seeded from a real sample pulled
// across all 10 scraped sources (2026-07-19) — extend the rule lists as new
// sources/title patterns show up, rather than guessing blind.

export type TaskType =
  | 'coding-swe'
  | 'data-annotation-labeling'
  | 'model-evaluation-red-teaming'
  | 'writing-editing'
  | 'voice-audio'
  | 'research-analysis'
  | 'translation-linguistics'
  | 'customer-support-ops'
  | 'other';

export type LocationBucket = 'remote' | 'us' | 'region-specific' | 'global-ish' | 'unspecified';

export type PayBand = 'unspecified' | 'under-20' | '20-40' | '40-plus' | 'project-based';

interface TaskTypeInput {
  title: string;
}

// Order matters: first match wins. Specific/reliable signals go first
// (language names, "voice acting", "SQL/Python/..."); the broad AI-training
// bucket goes LAST, deliberately, before the 'other' fallback. Most sources
// stamp every title with generic boilerplate like "- Freelance AI Trainer
// Project" (Meridial does this on ~every role) — if that broad pattern were
// checked early, it would swallow roles that have a real, more specific
// signal elsewhere in the title (e.g. "SQL Coding Specialist - Freelance AI
// Trainer Project" is coding-swe, not generically "AI training").
const TASK_TYPE_RULES: [RegExp, TaskType][] = [
  [/\bvoice actor|voice acting|\baudio\b|sound engineering|\bspeech\b/i, 'voice-audio'],
  [/\btranslat(e|or|ion)|language specialist|\blinguist|dialect specialist/i, 'translation-linguistics'],
  [/\bannotat|labell?ing|data (scraping|collection)|\bscraping\b/i, 'data-annotation-labeling'],
  [/software engineer|\bswe\b|\bdeveloper\b|\bcoding\b|programm(er|ing)|full ?stack|front.?end|back.?end|\bpython\b|javascript|typescript|\bjava\b|\bc#|\bc\+\+|\bsql\b|\bkotlin\b|\bhtml\b/i, 'coding-swe'],
  [/customer (support|service)|support agent|\boperations\b|\bops\b|implementation specialist|\bhr specialist|human resources/i, 'customer-support-ops'],
  [/\bwrit(er|ing)\b|\beditor\b|\bediting\b|\bcontent\b|copy ?edit|proofread/i, 'writing-editing'],
  [/\banalyst\b|\bresearch\b|analytics engineer/i, 'research-analysis'],
  [/\bevaluat|\breviewer\b|red.?team|task author|ai train(er|ing)|\bbenchmark\b|\brater\b|\brating\b/i, 'model-evaluation-red-teaming'],
];

export function taskType({ title }: TaskTypeInput): TaskType {
  // Deliberately title-only, not title+category: category is unreliable
  // across sources — e.g. mindrift's is a constant "Creator (Writer)" for
  // every role (not a real category), sepal's is an education level, g2i's
  // is just the internal team name. Mixing those in would systematically
  // mislabel entire sources rather than just missing a weak signal.
  for (const [pattern, type] of TASK_TYPE_RULES) {
    if (pattern.test(title)) return type;
  }
  return 'other';
}

interface LocationInput {
  location: string | null;
}

const US_NAMES = /^(united states( of america)?|usa|u\.s\.a?\.?)$/i;

export function locationBucket({ location }: LocationInput, providerGeographyScope?: 'global' | 'region-restricted' | 'country-specific' | 'role-dependent'): LocationBucket {
  if (location) {
    const s = location.trim();
    if (/remote/i.test(s)) return 'remote';
    if (US_NAMES.test(s)) return 'us';
    if (/^(global|world ?wide)$/i.test(s)) return 'global-ish';
    return 'region-specific';
  }
  // Several sources (vetto, mercor, sepal, afterquery) never populate
  // role-level location — fall back to the provider's already-computed
  // geography bucket rather than a blanket "unspecified".
  switch (providerGeographyScope) {
    case 'global':
      return 'global-ish';
    case 'region-restricted':
    case 'country-specific':
      return 'region-specific';
    default:
      return 'unspecified';
  }
}

// Pay_text strings that are NOT real job pay and must never be parsed into a
// pay band, baseSalary, or the composed description's compensation line.
// Turing's pay_text is a referral bonus ("Referral: $X"), not the role's pay.
// Keyed by provider_slug (not string-matched against the text) because
// that's a stable, explicit signal — a wording change in the referral text
// wouldn't silently defeat this guard.
export const PAY_TEXT_NOT_REAL_PAY = new Set(['turing-ai-advancement-work']);

interface PayInput {
  provider_slug: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: string | null;
  pay_text: string | null;
}

function isProjectBasedUnit(unit: string | null): boolean {
  if (!unit) return false;
  return /package|project|deliverable/i.test(unit);
}

function isHourlyUnit(unit: string | null): boolean {
  if (!unit) return false;
  return /hour|^hr$/i.test(unit);
}

export function payBand(role: PayInput): PayBand {
  if (role.pay_min != null) {
    if (isProjectBasedUnit(role.pay_unit)) return 'project-based';
    if (isHourlyUnit(role.pay_unit)) {
      const rate = role.pay_max ?? role.pay_min;
      if (rate < 20) return 'under-20';
      if (rate <= 40) return '20-40';
      return '40-plus';
    }
    // Structured pay with an unrecognized unit — still real pay, just can't
    // confidently bucket it by rate; don't guess a band.
    return 'unspecified';
  }

  if (role.pay_text && !PAY_TEXT_NOT_REAL_PAY.has(role.provider_slug)) {
    if (/deliverable|project|package/i.test(role.pay_text)) return 'project-based';
    const match = role.pay_text.match(/\$(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/);
    if (match) {
      const rate = match[2] ? Number(match[2]) : Number(match[1]);
      if (rate < 20) return 'under-20';
      if (rate <= 40) return '20-40';
      return '40-plus';
    }
  }

  return 'unspecified';
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  'coding-swe': 'Coding / software engineering',
  'data-annotation-labeling': 'Data annotation / labeling',
  'model-evaluation-red-teaming': 'Model evaluation / red-teaming',
  'writing-editing': 'Writing / editing',
  'voice-audio': 'Voice / audio',
  'research-analysis': 'Research / analysis',
  'translation-linguistics': 'Translation / linguistics',
  'customer-support-ops': 'Customer support / ops',
  other: 'Other',
};

export const LOCATION_BUCKET_LABELS: Record<LocationBucket, string> = {
  remote: 'Remote',
  us: 'United States',
  'region-specific': 'Region specific',
  'global-ish': 'Global',
  unspecified: 'Unspecified',
};

export const PAY_BAND_LABELS: Record<PayBand, string> = {
  unspecified: 'Unspecified',
  'under-20': 'Under $20/hr',
  '20-40': '$20–40/hr',
  '40-plus': '$40+/hr',
  'project-based': 'Project-based',
};
