export const prerender = false;

import type { APIRoute } from 'astro';
import { getDB } from '@/db';
import { serverConfig } from '@/utils/serverConfig';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (file.size > serverConfig.importMarkdown.maxBytes) {
      return new Response(JSON.stringify({ error: 'Markdown file exceeds the import limit.' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let fileName = file.name || 'Untitled Document';
    // Remove .md extension if present
    if (fileName.endsWith('.md')) {
      fileName = fileName.substring(0, fileName.length - 3);
    }

    const content = await file.text();

    const { db, documents, dialect } = await getDB();
    const docId = crypto.randomUUID();
    const now = new Date();

    const newDoc = {
      id: docId,
      userId: user.id,
      title: fileName,
      content: content,
      isPublic: dialect === 'mysql' ? 0 : false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(documents).values(newDoc);

    return new Response(JSON.stringify({ success: true, docId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
