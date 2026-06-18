export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { hashPassword, signJWT } from '@/utils/auth';
import { config } from '@/utils/config';
import { readJsonObject } from '@/utils/json';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/utils/rateLimit';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const rateLimit = checkRateLimit({
      key: `register:${getClientIp(request)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

    const body = await readJsonObject(request);
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name : '';

    if (!username || !password || username.trim().length < 3 || password.length < 6) {
      return new Response(
        JSON.stringify({
          error: 'Username must be at least 3 chars and password at least 6 chars',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { db, users } = await getDB();
    const cleanUsername = username.trim().toLowerCase();

    // Check if username already exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    if (existingUsers.length > 0) {
      return new Response(JSON.stringify({ error: 'Username is already taken' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      username: cleanUsername,
      passwordHash,
      name: name && name.trim() ? name.trim() : cleanUsername,
      createdAt: new Date(),
    });

    const token = await signJWT({ id: userId, username: cleanUsername }, config.jwtSecret);

    cookies.set('session', token, {
      path: '/',
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

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
