export const prerender = false;

import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { apiErrorFromCaught } from '@/utils/apiError';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents } = await getDB();

    // Query documents for current user, ordered by updatedAt descending
    // We only select metadata columns to save memory and database transfer load
    const userDocs = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        folderId: documents.folderId,
        title: documents.title,
        isPublic: documents.isPublic,
        visibility: documents.visibility,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        description: documents.description,
        tags: documents.tags,
        customSlug: documents.customSlug,
      })
      .from(documents)
      .where(eq(documents.userId, user.id))
      .orderBy(desc(documents.updatedAt));

    return new Response(JSON.stringify(userDocs), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return apiErrorFromCaught(error, 'Internal Server Error');
  }
};

export const POST: APIRoute = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents, dialect } = await getDB();
    const docId = crypto.randomUUID();
    const now = new Date();

    const newDoc = {
      id: docId,
      userId: user.id,
      folderId: null as string | null,
      title: 'Untitled Document',
      content: '', // Start with empty markdown content
      isPublic: dialect === 'mysql' ? 0 : false,
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(documents).values(newDoc);

    // Return the newly created document details (adjusting isPublic type for JSON response consistency)
    return new Response(
      JSON.stringify({
        ...newDoc,
        isPublic: false,
        visibility: 'private',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    return apiErrorFromCaught(error, 'Internal Server Error');
  }
};
