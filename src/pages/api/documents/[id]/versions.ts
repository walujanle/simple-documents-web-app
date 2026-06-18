export const prerender = false;

import type { APIRoute } from 'astro';
import { and, desc, eq, gt } from 'drizzle-orm';
import { getDB } from '@/db';
import { invalidateDocumentCache } from '@/utils/documentCache';
import { cleanupUnreferencedDocumentImages } from '@/utils/documentImages';
import { readJsonObject } from '@/utils/json';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    const user = locals.user;

    if (!id || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents, documentVersions } = await getDB();

    // Verify ownership
    const docs = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const doc = docs[0];
    if (doc.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch versions sorted by creation date descending
    const list = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, id))
      .orderBy(desc(documentVersions.createdAt));

    return new Response(JSON.stringify({ versions: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id } = params;
    const user = locals.user;

    if (!id || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await readJsonObject(request);
    const versionId = typeof body.versionId === 'string' ? body.versionId : '';
    if (!versionId) {
      return new Response(JSON.stringify({ error: 'Version ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents, documentVersions } = await getDB();

    // Verify ownership
    const docs = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const doc = docs[0];
    if (doc.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the version to restore
    const versions = await db
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, id)))
      .limit(1);

    if (versions.length === 0) {
      return new Response(JSON.stringify({ error: 'Version not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetVersion = versions[0];

    // Restore content and title to the document, updating updatedAt timestamp
    await db
      .update(documents)
      .set({
        title: targetVersion.title,
        content: targetVersion.content,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));
    await invalidateDocumentCache(doc);

    // Delete all version history entries that are newer than the restored version's timestamp
    await db
      .delete(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, id),
          gt(documentVersions.createdAt, targetVersion.createdAt),
        ),
      );
    await cleanupUnreferencedDocumentImages({
      db,
      documentVersions,
      documentId: id,
      currentContent: targetVersion.content,
    });

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id,
          title: targetVersion.title,
          content: targetVersion.content,
          updatedAt: new Date(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
