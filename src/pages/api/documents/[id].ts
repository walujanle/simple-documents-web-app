export const prerender = false;

import type { APIRoute } from 'astro';
import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { getDB } from '@/db';
import { getCachedDocumentById, invalidateDocumentCache } from '@/utils/documentCache';
import {
  cleanupUnreferencedDocumentImages,
  deleteAllDocumentImages,
  extractManagedImageKeys,
} from '@/utils/documentImages';
import { readJsonObject } from '@/utils/json';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const doc = await getCachedDocumentById(id);

    if (!doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isPublic = doc.isPublic === true || doc.isPublic === 1;

    // Row-level Security: If private, verify ownership
    if (!isPublic) {
      const user = locals.user;
      if (!user || doc.userId !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({
        ...doc,
        isPublic,
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

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id } = params;
    const user = locals.user;

    if (!id || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized or missing params' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await readJsonObject(request);
    const title = typeof body.title === 'string' ? body.title : undefined;
    const content = typeof body.content === 'string' ? body.content : undefined;
    const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : undefined;
    const folderId =
      typeof body.folderId === 'string' ? body.folderId : body.folderId === null ? null : undefined;
    const visibility =
      body.visibility === 'private' ||
      body.visibility === 'public' ||
      body.visibility === 'unlisted'
        ? body.visibility
        : undefined;
    const description =
      typeof body.description === 'string'
        ? body.description
        : body.description === null
          ? null
          : undefined;
    const tags = typeof body.tags === 'string' ? body.tags : body.tags === null ? null : undefined;
    const customSlug =
      typeof body.customSlug === 'string'
        ? body.customSlug
        : body.customSlug === null
          ? null
          : undefined;

    const { db, documents, folders, documentVersions, dialect } = await getDB();

    let cleanSlug: string | null = null;
    if (customSlug) {
      const slugVal = customSlug.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slugVal)) {
        return new Response(
          JSON.stringify({
            error: 'Custom slug must only contain lowercase alphanumeric characters and dashes',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slugVal)
      ) {
        return new Response(JSON.stringify({ error: 'Custom slug cannot be a UUID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      cleanSlug = slugVal;

      const duplicate = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.userId, user.id),
            eq(documents.customSlug, cleanSlug),
            ne(documents.id, id),
          ),
        )
        .limit(1);

      if (duplicate.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Custom slug is already in use by another of your documents' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Verify ownership
    const docs = await db.select().from(documents).where(eq(documents.id, id)).limit(1);

    if (docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const existingDoc = docs[0];
    if (existingDoc.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const removedImageKeys =
      content !== undefined
        ? [...extractManagedImageKeys(existingDoc.content, id)].filter(
            (key) => !extractManagedImageKeys(content, id).has(key),
          )
        : [];

    // Version history logging
    const isContentChanged =
      (content !== undefined && content !== existingDoc.content) ||
      (title !== undefined && title !== existingDoc.title);

    if (isContentChanged) {
      const latestVersions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, id))
        .orderBy(desc(documentVersions.createdAt))
        .limit(1);

      const now = new Date();
      let shouldCreateVersion = false;

      if (latestVersions.length === 0) {
        shouldCreateVersion = true;
      } else {
        const lastVersionTime = new Date(latestVersions[0].createdAt).getTime();
        const fiveMinutes = 5 * 60 * 1000;
        if (now.getTime() - lastVersionTime > fiveMinutes) {
          shouldCreateVersion = true;
        }
      }

      if (shouldCreateVersion) {
        const crypto = await import('crypto');
        await db.insert(documentVersions).values({
          id: crypto.randomUUID(),
          documentId: id,
          title: existingDoc.title,
          content: existingDoc.content,
          createdAt: now,
        });
      }

      // Auto-pruning versions older than configured retention days
      const { config } = await import('@/utils/config');
      const retentionPeriod = config.versionRetentionDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(now.getTime() - retentionPeriod);
      await db
        .delete(documentVersions)
        .where(
          and(eq(documentVersions.documentId, id), lt(documentVersions.createdAt, cutoffDate)),
        );
    }

    // Fetch all user folders to validate folderId and resolve public folder status
    const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id));

    const isFolderPublic = (fid: string | null): boolean => {
      if (!fid) return false;
      const folder = userFolders.find((f: any) => f.id === fid);
      if (!folder) return false;
      if (folder.isPublic === true || folder.isPublic === 1) return true;
      return isFolderPublic(folder.parentId);
    };

    let targetFolderId = existingDoc.folderId;
    if (folderId !== undefined) {
      if (folderId !== null) {
        const folderExists = userFolders.some((f: any) => f.id === folderId);
        if (!folderExists) {
          return new Response(JSON.stringify({ error: 'Folder not found or unauthorized' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      targetFolderId = folderId;
    }

    let targetVisibility = existingDoc.visibility;
    if (visibility !== undefined) {
      targetVisibility = visibility;
    } else if (isPublic !== undefined) {
      targetVisibility = isPublic ? 'public' : 'private';
    }

    // Apply public/private folder visibility rules
    if (isFolderPublic(targetFolderId)) {
      targetVisibility = 'public';
    } else {
      if (targetVisibility === 'public') {
        targetVisibility = 'unlisted';
      }
    }

    const isPublicDb =
      targetVisibility === 'public' || targetVisibility === 'unlisted'
        ? dialect === 'mysql'
          ? 1
          : true
        : dialect === 'mysql'
          ? 0
          : false;

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
      visibility: targetVisibility,
      isPublic: isPublicDb,
    };

    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) updateFields.content = content;
    if (folderId !== undefined) updateFields.folderId = folderId;
    if (description !== undefined)
      updateFields.description = description ? description.trim() : null;
    if (tags !== undefined) updateFields.tags = tags ? tags.trim() : null;
    if (customSlug !== undefined) updateFields.customSlug = cleanSlug;

    await db.update(documents).set(updateFields).where(eq(documents.id, id));
    await invalidateDocumentCache(existingDoc, undefined, [cleanSlug]);
    if (removedImageKeys.length > 0) {
      await cleanupUnreferencedDocumentImages({
        db,
        documentVersions,
        documentId: id,
        currentContent: content ?? existingDoc.content,
        candidateKeys: removedImageKeys,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id,
          title: title ?? existingDoc.title,
          content: content ?? existingDoc.content,
          folderId: folderId !== undefined ? folderId : existingDoc.folderId,
          visibility: targetVisibility,
          isPublic: targetVisibility === 'public' || targetVisibility === 'unlisted',
          description:
            description !== undefined
              ? description
                ? description.trim()
                : null
              : existingDoc.description,
          tags: tags !== undefined ? (tags ? tags.trim() : null) : existingDoc.tags,
          customSlug: customSlug !== undefined ? cleanSlug : existingDoc.customSlug,
          updatedAt: updateFields.updatedAt,
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

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    const user = locals.user;

    if (!id || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents } = await getDB();

    // Verify ownership
    const docs = await db.select().from(documents).where(eq(documents.id, id)).limit(1);

    if (docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (docs[0].userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteAllDocumentImages(id);
    await db.delete(documents).where(eq(documents.id, id));
    await invalidateDocumentCache(docs[0]);

    return new Response(JSON.stringify({ success: true }), {
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
