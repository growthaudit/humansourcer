import type { APIRoute } from 'astro';

export const prerender = false;

// Temporary diagnostic endpoint — confirms whether Supabase env vars are
// visible at runtime on Vercel, without exposing the actual secret values.
// Delete this file once the roles pipeline is confirmed working.
export const GET: APIRoute = async () => {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  return new Response(
    JSON.stringify({
      hasUrl: Boolean(url),
      urlPrefix: url ? url.slice(0, 20) : null,
      hasKey: Boolean(key),
      keyPrefix: key ? key.slice(0, 12) : null,
    }),
    { headers: { 'content-type': 'application/json' } }
  );
};
