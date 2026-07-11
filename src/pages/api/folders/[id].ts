export const prerender = false;

import type { APIRoute } from 'astro';
import { and, eq, inArray } from 'drizzle-orm';
import { getDB } from '@/db';
import { apiErrorFromCaught } from '@/utils/apiError';
import { invalidateDocumentsCache } from '@/utils/documentCache';
import { readJsonObject } from '@/utils/json';

export const PUT: APIRoute = async ({ params, request, locals }) => {
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
    const name = typeof body.name === 'string' ? body.name : undefined;
    const parentId =
      typeof body.parentId === 'string' ? body.parentId : body.parentId === null ? null : undefined;
    const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : undefined;
    const { db, folders, documents, dialect } = await getDB();

    // Verify ownership
    const existing = await db.select().from(folders).where(eq(folders.id, id)).limit(1);

    if (existing.length === 0 || existing[0].userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Folder not found or unauthorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cycle check for nested folders
    if (parentId && parentId !== null) {
      const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id));

      if (!userFolders.some((f: any) => f.id === parentId)) {
        return new Response(JSON.stringify({ error: 'Parent folder not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (parentId === id) {
        return new Response(JSON.stringify({ error: 'Cannot move folder inside itself' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let currentParentId: string | null = parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          return new Response(
            JSON.stringify({ error: 'Cannot move folder inside its own subfolder' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        const parentFolder = userFolders.find((f: any) => f.id === currentParentId);
        currentParentId = parentFolder ? parentFolder.parentId : null;
      }
    }

    let cascadeDocsForCache: any[] = [];

    // Cascade visibility downgrades if folder changes to private or upgrades if it changes to public
    if (isPublic !== undefined) {
      const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id));

      const getSubfolderIds = (fid: string): string[] => {
        const children = userFolders.filter((f: any) => f.parentId === fid);
        let ids = children.map((c: any) => c.id);
        for (const child of children) {
          ids = [...ids, ...getSubfolderIds(child.id)];
        }
        return ids;
      };

      const folderIdsToCascade = [id, ...getSubfolderIds(id)];
      cascadeDocsForCache = await db
        .select({
          id: documents.id,
          userId: documents.userId,
          customSlug: documents.customSlug,
        })
        .from(documents)
        .where(inArray(documents.folderId, folderIdsToCascade));

      if (isPublic === false) {
        await db
          .update(documents)
          .set({ visibility: 'unlisted', updatedAt: new Date() })
          .where(
            and(
              inArray(documents.folderId, folderIdsToCascade),
              eq(documents.visibility, 'public'),
            ),
          );
      } else if (isPublic === true) {
        const isPublicDb = dialect === 'mysql' ? 1 : true;
        await db
          .update(documents)
          .set({
            visibility: 'public',
            isPublic: isPublicDb,
            updatedAt: new Date(),
          })
          .where(inArray(documents.folderId, folderIdsToCascade));
      }
    }

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateFields.name = name.trim();
    if (parentId !== undefined) updateFields.parentId = parentId || null;
    if (isPublic !== undefined) {
      updateFields.isPublic = isPublic
        ? dialect === 'mysql'
          ? 1
          : true
        : dialect === 'mysql'
          ? 0
          : false;
    }

    await db.update(folders).set(updateFields).where(eq(folders.id, id));
    if (cascadeDocsForCache.length > 0) {
      await invalidateDocumentsCache(cascadeDocsForCache);
    }

    return new Response(
      JSON.stringify({
        success: true,
        folder: {
          id,
          name: name ?? existing[0].name,
          parentId: parentId !== undefined ? parentId : existing[0].parentId,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    return apiErrorFromCaught(error, 'Internal Server Error');
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

    const { db, folders, documents } = await getDB();

    // Verify ownership
    const existing = await db.select().from(folders).where(eq(folders.id, id)).limit(1);

    if (existing.length === 0 || existing[0].userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Folder not found or unauthorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Recursively collect all nested subfolder IDs
    const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id));

    const getSubfolderIds = (folderId: string): string[] => {
      const children = userFolders.filter((f: any) => f.parentId === folderId);
      let ids = children.map((c: any) => c.id);
      for (const child of children) {
        ids = [...ids, ...getSubfolderIds(child.id)];
      }
      return ids;
    };

    const folderIdsToDelete = [id, ...getSubfolderIds(id)];
    const docsForCache = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        customSlug: documents.customSlug,
      })
      .from(documents)
      .where(inArray(documents.folderId, folderIdsToDelete));

    // 1. Downgrade 'public' documents inside these folders to 'unlisted' since Root is private
    await db
      .update(documents)
      .set({ visibility: 'unlisted', updatedAt: new Date() })
      .where(
        and(inArray(documents.folderId, folderIdsToDelete), eq(documents.visibility, 'public')),
      );

    // 2. Move all documents inside these folders to Root (set folderId to null)
    await db
      .update(documents)
      .set({ folderId: null, updatedAt: new Date() })
      .where(inArray(documents.folderId, folderIdsToDelete));

    // 3. Delete the folders
    await db.delete(folders).where(inArray(folders.id, folderIdsToDelete));
    if (docsForCache.length > 0) {
      await invalidateDocumentsCache(docsForCache);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return apiErrorFromCaught(error, 'Internal Server Error');
  }
};
