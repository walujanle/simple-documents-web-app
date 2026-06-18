export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { invalidateUserCache } from '@/utils/documentCache';
import { readJsonObject } from '@/utils/json';

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
    const name = typeof body.name === 'string' ? body.name : undefined;
    const website = typeof body.website === 'string' ? body.website : undefined;
    const facebook = typeof body.facebook === 'string' ? body.facebook : undefined;
    const instagram = typeof body.instagram === 'string' ? body.instagram : undefined;
    const twitter = typeof body.twitter === 'string' ? body.twitter : undefined;
    const linkedin = typeof body.linkedin === 'string' ? body.linkedin : undefined;
    const mastodon = typeof body.mastodon === 'string' ? body.mastodon : undefined;
    const bluesky = typeof body.bluesky === 'string' ? body.bluesky : undefined;
    const isFeatured = typeof body.isFeatured === 'boolean' ? body.isFeatured : undefined;
    const description = typeof body.description === 'string' ? body.description : undefined;
    const updateFields: Record<string, any> = {};

    if (name !== undefined) {
      updateFields.name = name.trim();
    }
    if (website !== undefined) updateFields.website = website ? website.trim() : null;
    if (facebook !== undefined) updateFields.facebook = facebook ? facebook.trim() : null;
    if (instagram !== undefined) updateFields.instagram = instagram ? instagram.trim() : null;
    if (twitter !== undefined) updateFields.twitter = twitter ? twitter.trim() : null;
    if (linkedin !== undefined) updateFields.linkedin = linkedin ? linkedin.trim() : null;
    if (mastodon !== undefined) updateFields.mastodon = mastodon ? mastodon.trim() : null;
    if (bluesky !== undefined) updateFields.bluesky = bluesky ? bluesky.trim() : null;
    if (isFeatured !== undefined) updateFields.isFeatured = !!isFeatured;
    if (description !== undefined)
      updateFields.description = description ? description.trim() : null;

    if (Object.keys(updateFields).length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, users } = await getDB();

    await db.update(users).set(updateFields).where(eq(users.id, user.id));
    await invalidateUserCache(user.username);

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
