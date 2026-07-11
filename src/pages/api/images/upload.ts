export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { apiErrorFromCaught } from '@/utils/apiError';
import {
  createImageObjectKey,
  getImageUploadSettings,
  putImageObject,
} from '@/utils/objectStorage';

const isWebP = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === 'RIFF' && webp === 'WEBP';
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const settings = getImageUploadSettings();
    if (!settings.uploadsEnabled) {
      return new Response(JSON.stringify({ error: 'Image upload storage is not configured.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentId = formData.get('documentId');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No image file uploaded.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (typeof documentId !== 'string' || !documentId.trim()) {
      return new Response(JSON.stringify({ error: 'Document ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents } = await getDB();
    const docs = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (docs.length === 0 || docs[0].userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Document not found or unauthorized.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.type !== 'image/webp') {
      return new Response(JSON.stringify({ error: 'Only optimized WebP uploads are accepted.' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > settings.maxBytes) {
      return new Response(JSON.stringify({ error: 'Image exceeds the configured upload limit.' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = new Uint8Array(await file.arrayBuffer());
    if (!isWebP(body)) {
      return new Response(JSON.stringify({ error: 'Invalid WebP image payload.' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const key = createImageObjectKey(documentId, file.name);
    const uploaded = await putImageObject({ key, body });

    return new Response(
      JSON.stringify({
        url: uploaded.url,
        key: uploaded.key,
        size: body.byteLength,
        contentType: 'image/webp',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    return apiErrorFromCaught(error, 'Image upload failed.');
  }
};
