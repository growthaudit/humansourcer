// Coarse, filterable buckets derived from the free-text registry fields.
// The raw strings (accessModel/geography/status/ownershipConfidence) stay on
// the provider as the citable source of truth; these buckets are what the
// index page's filter UI actually binds to. Lookup tables cover every value
// seen in the current 52-row registry; the keyword fallback keeps a future
// spreadsheet sync from crashing on a new phrasing (it just degrades to a
// reasonable guess instead of throwing).

// 'restricted' covers the audienceTier === 'restricted' companies: no public
// self-serve application route exists at all (managed/partner-led hiring
// only), so bucketing them as 'application' or 'active' like every other
// provider would misrepresent them as having a normal apply flow.
export type AccessModelCategory = 'open' | 'application' | 'selective' | 'waitlist' | 'restricted';
export type GeographyScope = 'global' | 'region-restricted' | 'country-specific' | 'role-dependent';
export type StatusCategory = 'active' | 'limited' | 'waitlist' | 'campaign' | 'restricted';
export type ConfidenceLevel = 'confirmed' | 'high' | 'medium';

const ACCESS_MODEL_MAP: Record<string, AccessModelCategory> = {
  'Open roles / applications': 'open',
  'Open application': 'open',
  'Selective application': 'selective',
  'Join network / apply to projects': 'application',
  'Open registration / project application': 'open',
  'Registration / project application': 'application',
  'Apply to listed roles': 'application',
  'Join community': 'open',
  'Join community / apply': 'application',
  'Open registration': 'open',
  'Profile / role application': 'application',
  'Apply to opportunities': 'application',
  'Join network': 'open',
  'Apply to listed opportunities': 'application',
  'Join waitlist / register': 'waitlist',
  'Apply to listed projects': 'application',
  'Join expert network': 'application',
  'Application / assessment': 'selective',
  'Create profile / apply': 'application',
  'Join network / apply': 'application',
  'Worker or validator waitlist': 'waitlist',
  'Apply to current listing': 'application',
  'Join talent network': 'open',
  'Project application': 'application',
  'Create freelancer profile': 'open',
  'Apply to programme': 'application',
  'Apply when openings available': 'application',
  'Open registration / tasks': 'open',
  'Open worker registration subject to approval': 'application',
  'Participant registration': 'open',
  'App registration': 'open',
  'Register and apply': 'application',
  'Apply to vacancies / email': 'application',
  'Freelance/vendor application': 'application',
  'Apply to vacancies': 'application',

  // audienceTier === 'restricted' — no public self-serve route.
  'Workers recruited through local programmes and partner organisations': 'restricted',
  'Workers recruited and trained through local partner organisations': 'restricted',
  'Managed workforce and role-by-role hiring': 'restricted',
  'Managed annotation workforce': 'restricted',
  'Managed linguist and AI-data workforce': 'restricted',
  'Annotation software plus managed services': 'restricted',
  'Annotation software plus services': 'restricted',
  'Covered by separate worker brands': 'restricted',
};

const GEOGRAPHY_MAP: Record<string, GeographyScope> = {
  'Role-dependent': 'role-dependent',
  'Selected countries': 'region-restricted',
  'Country and project dependent': 'country-specific',
  'Country dependent': 'country-specific',
  'US, UK, Canada for many roles': 'region-restricted',
  'Role dependent': 'role-dependent',
  'Global, role dependent': 'global',
  'Global, project dependent': 'global',
  'Country specific': 'country-specific',
  'Country and language specific': 'country-specific',
  'Global, task dependent': 'global',
  'Many roles require US work authorisation': 'region-restricted',
  'Supported countries': 'region-restricted',
  'Global / unspecified': 'global',
  'Global, technical screening': 'global',
  'Global': 'global',
  'Europe-focused; role dependent': 'region-restricted',
  'Selected operating countries': 'region-restricted',
  'Operating locations / project dependent': 'country-specific',
  'Global, availability dependent': 'global',
  'Task and country dependent': 'country-specific',
  'Location dependent': 'country-specific',
  'Global, language dependent': 'global',
  'Primarily Ghana / operating locations': 'region-restricted',
};

const STATUS_MAP: Record<string, StatusCategory> = {
  'Active': 'active',
  'Waitlist': 'waitlist',
  'Campaign listing': 'campaign',
  'Active / location-limited': 'limited',
  'Active; strategic wind-down risk': 'limited',
  'Available but stale': 'limited',
  'Active / low freshness': 'limited',
  'Active when roles listed': 'limited',
  'Active / emerging': 'active',
  'No public worker portal': 'restricted',
};

const CONFIDENCE_MAP: Record<string, ConfidenceLevel> = {
  'Confirmed': 'confirmed',
  'High — reported, not disclosed on portal': 'high',
  'High': 'high',
  'Medium': 'medium',
};

function keywordFallbackAccess(raw: string): AccessModelCategory {
  const s = raw.toLowerCase();
  if (s.includes('waitlist')) return 'waitlist';
  if (s.includes('managed') || s.includes('partner') || s.includes('no public')) return 'restricted';
  if (s.includes('selective') || s.includes('assessment') || s.includes('vetted')) return 'selective';
  if (s.includes('open')) return 'open';
  return 'application';
}

function keywordFallbackGeography(raw: string): GeographyScope {
  const s = raw.toLowerCase();
  if (s.includes('global')) return 'global';
  if (s.includes('role')) return 'role-dependent';
  if (s.includes('country') || s.includes('location') || s.includes('operating')) return 'country-specific';
  return 'region-restricted';
}

function keywordFallbackStatus(raw: string): StatusCategory {
  const s = raw.toLowerCase();
  if (s.includes('waitlist')) return 'waitlist';
  if (s.includes('campaign')) return 'campaign';
  if (s.includes('no public') || s.includes('no self-serve')) return 'restricted';
  if (s.includes('stale') || s.includes('limited') || s.includes('low freshness') || s.includes('wind-down') || s.includes('when roles listed')) return 'limited';
  return 'active';
}

function keywordFallbackConfidence(raw: string): ConfidenceLevel {
  const s = raw.toLowerCase();
  if (s.includes('confirmed')) return 'confirmed';
  if (s.includes('medium')) return 'medium';
  return 'high';
}

export function accessModelCategory(raw: string): AccessModelCategory {
  return ACCESS_MODEL_MAP[raw] ?? keywordFallbackAccess(raw);
}

export function geographyScope(raw: string): GeographyScope {
  return GEOGRAPHY_MAP[raw] ?? keywordFallbackGeography(raw);
}

export function statusCategory(raw: string): StatusCategory {
  return STATUS_MAP[raw] ?? keywordFallbackStatus(raw);
}

export function confidenceLevel(raw: string): ConfidenceLevel {
  return CONFIDENCE_MAP[raw] ?? keywordFallbackConfidence(raw);
}

export const ACCESS_MODEL_LABELS: Record<AccessModelCategory, string> = {
  open: 'Open / self-serve',
  application: 'Apply',
  selective: 'Selective / vetted',
  waitlist: 'Waitlist',
  restricted: 'No public self-serve route',
};

export const GEOGRAPHY_LABELS: Record<GeographyScope, string> = {
  global: 'Global',
  'region-restricted': 'Region restricted',
  'country-specific': 'Country specific',
  'role-dependent': 'Role dependent',
};

export const STATUS_LABELS: Record<StatusCategory, string> = {
  active: 'Active',
  limited: 'Limited / caveat',
  waitlist: 'Waitlist',
  campaign: 'Campaign listing',
  restricted: 'No public worker portal',
};

export const DOMAIN_TAG_LABELS: Record<string, string> = {
  law: 'Law',
  medicine: 'Medicine',
  finance: 'Finance',
  coding: 'Coding',
  'science-stem': 'Science / STEM',
  linguistics: 'Linguistics',
  safety: 'Safety',
  'writing-creative': 'Writing / Creative',
  'consulting-ops': 'Consulting / Ops',
  'voice-speech': 'Voice / Speech',
  generalist: 'Generalist',
  'reasoning-agent': 'Reasoning / Agents',
};
