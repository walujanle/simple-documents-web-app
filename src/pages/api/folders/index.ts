export const prerender = false;

import type { APIRoute } from 'astro';
import { and, desc, eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { readJsonObject } from '@/utils/json';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, folders } = await getDB();
    const userFolders = await db
      .select()
      .from(folders)
      .where(eq(folders.userId, user.id))
      .orderBy(desc(folders.createdAt));

    return new Response(JSON.stringify(userFolders), {
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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await readJsonObject(request);
    const name = typeof body.name === 'string' ? body.name : '';
    const parentId =
      typeof body.parentId === 'string' ? body.parentId : body.parentId === null ? null : undefined;
    const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : false;
    if (!name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Folder name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, folders, dialect } = await getDB();
    if (parentId) {
      const parentRows = await db
        .select()
        .from(folders)
        .where(and(eq(folders.id, parentId), eq(folders.userId, user.id)))
        .limit(1);

      if (parentRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Parent folder not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const folderId = crypto.randomUUID();
    const now = new Date();

    const isPublicVal = isPublic
      ? dialect === 'mysql'
        ? 1
        : true
      : dialect === 'mysql'
        ? 0
        : false;

    const newFolder = {
      id: folderId,
      userId: user.id,
      name: name.trim(),
      parentId: parentId || null,
      isPublic: isPublicVal,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(folders).values(newFolder);

    return new Response(JSON.stringify(newFolder), {
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
