export const prerender = false;

import type { APIRoute } from 'astro';
import { absoluteAppUrl } from '@/utils/url';

export const GET: APIRoute = async () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /documents',
    'Disallow: /documents/',
    'Disallow: /api/',
    '',
    `Sitemap: ${absoluteAppUrl('/sitemap.xml')}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
