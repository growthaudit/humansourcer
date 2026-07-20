// src/content.config.ts
// Defines the `providers` collection sourced from src/data/providers.json.
//
// Schema requires relationshipEvidenceUrl + statusEvidenceUrl, and validates
// lastChecked as a real date — every claim is citable from day one, so a
// future move to editorial ratings/verification badges is a copy and
// field-visibility change, not a data audit.
//
// accessModel/geography/status are kept as free text here (source of truth,
// citable) — coarse filter/sort buckets are derived from them at render time
// in src/lib/taxonomy.ts rather than hand-classified into this schema, so a
// future spreadsheet sync never has to fight a stale manual enum.

import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

// 'restricted' = real human-data companies with no public self-serve worker
// portal (managed/partner-led hiring only) — see providers with this tier
// for the "why" in their `notes` field. They get lighter-weight pages: no
// application funnel framing, no /go/ click as a "join" CTA.
const AUDIENCE_TIERS = ['expert', 'gig', 'restricted'] as const;

const DOMAIN_TAGS = [
  'law', 'medicine', 'finance', 'coding', 'science-stem', 'linguistics',
  'safety', 'writing-creative', 'consulting-ops', 'voice-speech',
  'generalist', 'reasoning-agent', 'multimodal',
] as const;

const providerSchema = z.object({
  id: z.string().regex(/^HP-\d{3}$/), // stable key back to the source registry
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), // URL slug, e.g. "alignerr"
  parentGroup: z.string(),           // e.g. "Labelbox" — the actual owning company
  workerBrand: z.string(),           // e.g. "Alignerr" — the worker-facing name
  relationship: z.string(),          // plain-English description of parent<->brand link
  portalType: z.string(),            // free-text type as sourced, e.g. "Expert network"
  audienceTiers: z.array(z.enum(AUDIENCE_TIERS)).min(1), // first entry is the primary/canonical route
  domainTags: z.array(z.enum(DOMAIN_TAGS)).min(1),
  typicalWork: z.string(),
  workerUrl: z.string().url(),       // outbound application URL — the click-tracking target
  status: z.string(),                // free text, e.g. "Active", "Waitlist" — bucketed in taxonomy.ts
  accessModel: z.string(),           // free text — bucketed in taxonomy.ts
  geography: z.string(),             // free text — bucketed in taxonomy.ts
  ownershipConfidence: z.string(),   // e.g. "Confirmed", "High — reported, not disclosed"
  relationshipEvidenceUrl: z.string().url(), // REQUIRED — no undocumented ownership claims
  statusEvidenceUrl: z.string().url(),       // REQUIRED — no undocumented status claims
  lastChecked: z.coerce.date(),      // real date, not a string — enables staleness checks
  notes: z.string().optional(),
  logoUrl: z.string().url().optional(), // not sourced yet; reserved so adding logos is additive

  // --- fields not in the source registry yet; reserved for the future reframe ---
  featured: z.boolean().default(false),   // paid-placement flag, wired up later via Supabase
  featuredRank: z.number().optional(),
  verified: z.boolean().default(false),   // unpublished today; becomes a public badge later

  // --- third-party trust ratings; raw source values, citable, blended at render time in src/lib/rating.ts ---
  trustpilotRating: z.number().min(0).max(5).optional(),
  trustpilotReviewCount: z.number().int().min(0).optional(),
  trustpilotEvidenceUrl: z.string().url().optional(),

  googleRating: z.number().min(0).max(5).optional(),
  googleReviewCount: z.number().int().min(0).optional(),
  googleEvidenceUrl: z.string().url().optional(),

  glassdoorRating: z.number().min(0).max(5).optional(),
  glassdoorReviewCount: z.number().int().min(0).optional(),
  glassdoorEvidenceUrl: z.string().url().optional(),

  ratingsLastChecked: z.coerce.date().optional(),

  // Former/legacy names that now redirect into this provider (e.g. "TaskUp"
  // -> DataAnnotation). Sourced from the registry's "Aliases & Legacy" sheet.
  // Purely informational — never a separate provider entry or workerUrl.
  aliases: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    aliasType: z.string(), // free text, e.g. "Former platform name"
    note: z.string(),
    evidenceUrl: z.string().url(),
  })).optional(),
});

const providers = defineCollection({
  loader: file('src/data/providers.json'),
  schema: providerSchema,
});

export const collections = { providers };
