export const prerender = false;

import type { APIRoute } from 'astro';
import { getImageUploadSettings } from '@/utils/objectStorage';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(getImageUploadSettings()), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
