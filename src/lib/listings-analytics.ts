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

// The raw `category` column is source-defined free text (role-taxonomy.ts
// already documents it as unreliable/inconsistent across sources) — sources
// don't agree on casing ("law" vs "Law"), so without this the category
// filter/chart would list the same category twice. Title-cases each word,
// preserving words that are already all-uppercase (e.g. "SQL") and forcing
// known acronyms (e.g. "ai" -> "AI") rather than lowercasing them.
function normalizeCategory(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    // \w+ (not \S+) so hyphenated categories like "sciences-research" title-case
    // each side of the hyphen ("Sciences-Research"), not just the first letter.
    .replace(/\w+/g, (word) => {
      if (word.length > 1 && word === word.toUpperCase()) return word;
      if (KNOWN_ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    });
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
