// Per-provider lookup keys for scripts/fetch-ratings.mjs. Not secret data —
// just which Trustpilot page / Google Place ID belongs to which provider
// slug — so it lives in git, separate from the credential-bearing env vars.
//
// Add an entry here before fetch-ratings.mjs can pull that provider's
// numbers. In practice only the Google lookup reliably automates —
// Trustpilot 403s plain server-side fetches (Cloudflare bot protection),
// so trustpilotUrl is kept here mainly as a documented link to open and
// read by hand. Glassdoor is intentionally not looked up here at all
// (no public API — researched manually straight into providers.json).
//
// googlePlaceId: find via https://developers.google.com/maps/documentation/places/web-service/place-id

export const RATING_SOURCES = {
  'surge-workforce': {
    trustpilotUrl: 'https://www.trustpilot.com/review/surgehq.ai',
    googlePlaceId: null,
  },
  'mercor-experts': {
    trustpilotUrl: 'https://www.trustpilot.com/review/mercor.com',
    googlePlaceId: null,
  },
};
