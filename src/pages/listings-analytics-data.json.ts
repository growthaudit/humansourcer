// Build-time snapshot of every eligible active role in the compact shape
// the /market-data/ dashboard filters/aggregates client-side. Same
// single-shared-URL rationale as roles-data.json.ts.
import type { APIRoute } from 'astro';
import { getEligibleActiveRoles } from '../lib/role-rows';
import { toAnalyticsRow } from '../lib/listings-analytics';

export const prerender = true;

export const GET: APIRoute = async () => {
  const eligible = await getEligibleActiveRoles();
  const rows = eligible.map(toAnalyticsRow);
  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
};
