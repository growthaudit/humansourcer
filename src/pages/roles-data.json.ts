// Build-time snapshot of every eligible active role, served as a single
// static JSON file so RolesFilter.tsx (client-side) can filter/search
// across the *entire* /roles/ dataset instead of just whatever 24-role
// page it happens to be mounted on. One shared URL means the browser only
// downloads this once no matter how many /roles/* pages a visitor browses.
import type { APIRoute } from 'astro';
import { getEligibleActiveRoles, toRoleRow } from '../lib/role-rows';

export const prerender = true;

export const GET: APIRoute = async () => {
  const eligible = await getEligibleActiveRoles();
  const rows = eligible.map(({ role, provider }) => toRoleRow(role, provider));
  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
};
