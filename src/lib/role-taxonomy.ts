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
  | 'model-evaluation'
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
  description?: string | null;
}

// Order matters: first match wins. Specific/reliable signals go first
// (language names, "voice acting", "SQL/Python/..."); the broad AI-training
// bucket goes LAST, deliberately, before the 'other' fallback. Most sources
// stamp every title with generic boilerplate like "- Freelance AI Trainer
// Project" (Meridial does this on ~every role) — if that broad pattern were
// checked early, it would swallow roles that have a real, more specific
// signal elsewhere in the title (e.g. "SQL Coding Specialist - Freelance AI
// Trainer Project" is coding-swe, not generically "AI training").
//
// Confirmed live against the real dataset (2026-07-22, ~2900 active roles):
// a large slice of "Uncategorized" titles are bare domain-expert postings
// ("Physics Expert", "Accounting Expert", "Dutch Language Expert", "AI Task
// Designer") from handshake-ai/mercor-experts/micro1/alignerr/sme-careers —
// these three additions (voice, language expert, and the AI-task/QA/SME
// terms folded into model-evaluation) were sized directly off that sample.
const TASK_TYPE_RULES: [RegExp, TaskType][] = [
  [/\bvoice actor|voice acting|\bvoice\b|\baudio\b|sound engineering|\bspeech\b/i, 'voice-audio'],
  [/\btranslat(e|or|ion)|language specialist|language expert|\bbilingual\b|\blinguist|dialect specialist/i, 'translation-linguistics'],
  [/\bannotat|labell?ing|data (scraping|collection)|\bscraping\b/i, 'data-annotation-labeling'],
  [/software engineer|\bswe\b|\bdeveloper\b|\bcoding\b|programm(er|ing)|full ?stack|front.?end|back.?end|\bpython\b|javascript|typescript|\bjava\b|\bc#|\bc\+\+|\bsql\b|\bkotlin\b|\bhtml\b/i, 'coding-swe'],
  [/customer (support|service)|support agent|\boperations\b|\bops\b|implementation specialist|\bhr specialist|human resources/i, 'customer-support-ops'],
  [/\bwrit(er|ing)\b|\beditor\b|\bediting\b|\bcontent\b|copy ?edit|proofread/i, 'writing-editing'],
  [/\banalyst\b|\bresearch\b|analytics engineer/i, 'research-analysis'],
  [
    /\bevaluat|\breviewer\b|red.?team|task author|ai train(er|ing)|\bbenchmark\b|\brater\b|\brating\b|ai task (designer|creator)|quality assurance( lead)?|\bqal\b|subject matter expert|\bsme\b|prompt engineer/i,
    'model-evaluation',
  ],
];

export function taskType({ title, description }: TaskTypeInput): TaskType {
  // Deliberately title-only for the first pass, not title+category: category
  // is unreliable across sources — e.g. mindrift's is a constant "Creator
  // (Writer)" for every role (not a real category), sepal's is an education
  // level, g2i's is just the internal team name. Mixing those in would
  // systematically mislabel entire sources rather than just missing a weak
  // signal.
  for (const [pattern, type] of TASK_TYPE_RULES) {
    if (pattern.test(title)) return type;
  }
  // Title alone leaves a real slice of roles unclassified — bare
  // domain-expert titles like "Accounting Expert" or "Physics Expert" say
  // nothing about the work by themselves, but their descriptions do (e.g.
  // "evaluating how well AI systems perform... scoring completed work
  // samples" — a clean model-evaluation match). Only consulted once title
  // has already failed every rule, so a role whose title is already
  // unambiguous (e.g. "Full-Stack Developer") can never be silently
  // reclassified by an incidental keyword deeper in its description — this
  // is a fallback pass, not a merged title+description match.
  if (description) {
    for (const [pattern, type] of TASK_TYPE_RULES) {
      if (pattern.test(description)) return type;
    }
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

// Structured, real numeric hourly rate only — null for project/package-based
// pay (no per-hour figure exists to average) and for unrecognized units
// (real pay, but not confidently a rate). Never derived from pay_text: only
// vetto/mercor populate pay_min/pay_max with genuine structured data, per
// the schema comment on those columns. Prefers pay_max ("up to" figure) over
// pay_min when a range exists — same convention parseTextRate() below uses.
export function hourlyRate(role: PayInput): number | null {
  if (role.pay_min == null) return null;
  if (!isHourlyUnit(role.pay_unit)) return null;
  return role.pay_max ?? role.pay_min;
}

// A free-text figure only gets treated as an hourly rate when the text says
// so explicitly. Without this, a range like "$80,000 - $110,000/yr" (a real
// value in the data, from afterquery-experts) would silently get parsed as
// $80/hr: the digit match stops at the thousands comma, and nothing was
// checking the unit at all. Confirmed live: this exact string exists.
function isHourlyPayText(text: string): boolean {
  return /\bhour(ly)?\b|\/\s*hr\b/i.test(text);
}

// Pulls a dollar figure out of free-text pay strings like "$18-25/hr" —
// prefers the upper ("up to") bound when a range is given, same as
// hourlyRate() above. Returns null for text with no explicit hourly signal
// or no parseable $ figure (see isHourlyPayText above).
function parseTextRate(payText: string): number | null {
  if (!isHourlyPayText(payText)) return null;
  const match = payText.match(/\$(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/);
  if (!match) return null;
  return match[2] ? Number(match[2]) : Number(match[1]);
}

// The single numeric "amount" for a role, structured pay first, falling back
// to a parsed pay_text figure — this is what powers the /market-data/
// dashboard's rate column, sort, and averages. Excludes project/package-based
// pay (a lump sum isn't comparable to a per-hour figure) and the Turing
// referral-bonus denylist, same guards payBand() below applies.
export function payAmount(role: PayInput): number | null {
  const structured = hourlyRate(role);
  if (structured != null) return structured;
  if (
    role.pay_text &&
    !PAY_TEXT_NOT_REAL_PAY.has(role.provider_slug) &&
    !/deliverable|project|package/i.test(role.pay_text)
  ) {
    return parseTextRate(role.pay_text);
  }
  return null;
}

function bandForRate(rate: number): PayBand {
  if (rate < 20) return 'under-20';
  if (rate <= 40) return '20-40';
  return '40-plus';
}

export function payBand(role: PayInput): PayBand {
  if (role.pay_min != null) {
    if (isProjectBasedUnit(role.pay_unit)) return 'project-based';
    const rate = hourlyRate(role);
    if (rate != null) return bandForRate(rate);
    // Structured pay with an unrecognized unit — still real pay, just can't
    // confidently bucket it by rate; don't guess a band.
    return 'unspecified';
  }

  if (role.pay_text && !PAY_TEXT_NOT_REAL_PAY.has(role.provider_slug)) {
    if (/deliverable|project|package/i.test(role.pay_text)) return 'project-based';
    const rate = parseTextRate(role.pay_text);
    if (rate != null) return bandForRate(rate);
  }

  return 'unspecified';
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  'coding-swe': 'Coding / software engineering',
  'data-annotation-labeling': 'Data annotation / labeling',
  'model-evaluation': 'AI model evaluation',
  'writing-editing': 'Writing / editing',
  'voice-audio': 'Voice / audio',
  'research-analysis': 'Research / analysis',
  'translation-linguistics': 'Translation / linguistics',
  'customer-support-ops': 'Customer support / ops',
  other: 'Uncategorized',
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
