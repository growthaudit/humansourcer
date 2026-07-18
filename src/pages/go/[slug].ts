import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = false;

export const GET: APIRoute = async ({ params, redirect }) => {
  const { slug } = params;
  const providers = await getCollection('providers');
  const provider = providers.find((p) => p.data.slug === slug);

  if (!provider) {
    return new Response('Not found', { status: 404 });
  }

  // Click logging goes here once an analytics/store target is chosen (Phase 2).
  console.log(`[click] ${provider.data.slug} -> ${provider.data.workerUrl}`);

  return redirect(provider.data.workerUrl, 302);
};
