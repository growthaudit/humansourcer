import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from '../../lib/roles';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, redirect }) => {
  const { slug } = params;
  const providers = await getCollection('providers');
  const provider = providers.find((p) => p.data.slug === slug);

  if (!provider) {
    return new Response('Not found', { status: 404 });
  }

  // Best-effort: a click that fails to log should never block the redirect.
  const creds = getSupabaseCredentials();
  if (creds) {
    try {
      const supabase = createClient(creds.url, creds.key);
      await supabase.from('clicks').insert({
        provider_slug: provider.data.slug,
        target_url: provider.data.workerUrl,
        referrer: request.headers.get('referer'),
      });
    } catch (err) {
      console.warn(`Failed to log click for ${provider.data.slug}:`, err);
    }
  }

  return redirect(provider.data.workerUrl, 302);
};
