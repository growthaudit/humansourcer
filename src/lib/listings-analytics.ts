// Build-time only: compact per-role rows purpose-built for the /market-data/
// dashboard's client-side filtering/aggregation. Deliberately narrower than
// RoleRow (role-rows.ts) — no title/href/description, since the dashboard
// deals in counts and averages, not individual apply flows.
import type { RoleWithProvider } from './role-rows';
import { taskType, payAmount, TASK_TYPE_LABELS, type TaskType } from './role-taxonomy';

// Known acronyms that appear in category text already-lowercase (e.g. a
// source sending "ai-machine-learning") — title-casing alone would turn
// "ai" into "Ai", not "AI". Preserving already-uppercase words (below)
// only catches sources that got the acronym right; this catches the ones
// that didn't. Scoped to terms confirmed to actually appear in this
// dataset's domain rather than a generic dictionary, to avoid false
// positives on ordinary words.
const KNOWN_ACRONYMS = new Set(['ai', 'ml', 'nlp', 'llm', 'sql', 'api', 'ux', 'ui', 'hr']);

// One source (the one behind ai-machine-learning, business-operations,
// data-analysis, software-engineering, sciences-research, etc.) sends its
// entire category taxonomy as lowercase hyphenated slugs, while every other
// source sends human-readable labels ("Business Operations", "Data
// Analysis"). Same taxonomy, different format — de-slugify BEFORE
// title-casing so "business-operations" and "Business Operations" converge
// into one string instead of staying "Business-Operations" forever (the
// previous version's bug). Only fires on strings with no spaces already —
// a real multi-word label never needs this.
function deslugify(raw: string): string {
  return raw.includes(' ') ? raw : raw.replace(/-/g, ' ');
}

// True word-for-word synonyms across sources — confirmed live in this
// dataset: "law"/"Law"/"Legal" is the reported case, and the same pattern
// recurs for medicine/health, tech, and a couple of the de-slugified
// compounds above whose spaced-label counterpart uses "&"/"and" instead of a
// bare space ("Arts Design" vs "Arts & Design"). Keyed by the lowercased
// result of deslugify+title-case, mapped to one canonical label. Deliberately
// narrow: only exact 1:1 synonyms, not different-specificity categories that
// happen to overlap (e.g. "Coding" vs "Software Engineering", or
// "sciences-research" vs "Sciences" — the extra word could be a real,
// source-intended distinction, not a formatting accident, so it's left
// alone rather than guessed away).
const CATEGORY_ALIASES: Record<string, string> = {
  law: 'Legal',
  medicine: 'Medical/Healthcare',
  medical: 'Medical/Healthcare',
  health: 'Medical/Healthcare',
  science: 'Sciences',
  tech: 'Technology',
  'software development': 'Software Engineering',
  'arts design': 'Arts & Design',
  // Target has to match what the title-casing step above actually produces
  // for the real source string "Language and Audio" — it capitalizes every
  // word including "and" (no small-word exception), so the canonical target
  // is "Language And Audio", not the grammatically-correct "and".
  'language audio': 'Language And Audio',
};

// The raw `category` column is source-defined free text (role-taxonomy.ts
// already documents it as unreliable/inconsistent across sources) — sources
// don't agree on casing ("law" vs "Law"), slug-vs-label formatting
// ("business-operations" vs "Business Operations"), or wording ("law" vs
// "Legal") for what's otherwise the same category. Without all three
// normalization steps the category filter/chart lists the same real-world
// category multiple times.
function normalizeCategory(raw: string): string {
  const titleCased = deslugify(raw)
    .trim()
    .replace(/\s+/g, ' ')
    // \w+ (not \S+) so hyphenated categories that DO have real spaces (none
    // currently, but defensive) still title-case each hyphen segment.
    .replace(/\w+/g, (word) => {
      if (word.length > 1 && word === word.toUpperCase()) return word;
      if (KNOWN_ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    });
  return CATEGORY_ALIASES[titleCased.toLowerCase()] ?? titleCased;
}

export interface ListingAnalyticsRow {
  id: string;
  providerSlug: string;
  workerBrand: string;
  category: string | null;
  taskType: TaskType;
  taskTypeLabel: string;
  hourlyRate: number | null;
  payText: string | null;
  createdAt: string;
}

export function toAnalyticsRow({ role, provider }: RoleWithProvider): ListingAnalyticsRow {
  const type = taskType(role);
  return {
    id: role.id,
    providerSlug: provider.slug,
    workerBrand: provider.workerBrand,
    category: role.category ? normalizeCategory(role.category) : null,
    taskType: type,
    taskTypeLabel: TASK_TYPE_LABELS[type],
    hourlyRate: payAmount(role),
    payText: role.pay_text,
    createdAt: role.first_seen_at,
  };
}
