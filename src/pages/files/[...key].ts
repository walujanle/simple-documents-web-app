export const prerender = false;

import type { APIRoute } from 'astro';
import { isDevImageStorageEnabled, readDevImageObject } from '@/utils/devImageStorage';

export const GET: APIRoute = async ({ params }) => {
  if (!isDevImageStorageEnabled()) {
    return new Response('Not found', { status: 404 });
  }

  const key = params.key ? `files/${params.key}` : '';
  const body = await readDevImageObject(key);
  if (!body) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(body.slice().buffer, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
