export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const sessionUser = locals.user;
    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, users } = await getDB();
    const dbUsers = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        website: users.website,
        facebook: users.facebook,
        instagram: users.instagram,
        twitter: users.twitter,
        linkedin: users.linkedin,
        mastodon: users.mastodon,
        bluesky: users.bluesky,
        isFeatured: users.isFeatured,
        description: users.description,
      })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);

    if (dbUsers.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(dbUsers[0]), {
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
