export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { apiErrorFromCaught } from '@/utils/apiError';
import { comparePassword, signJWT } from '@/utils/auth';
import { config } from '@/utils/config';
import { readJsonObject } from '@/utils/json';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/utils/rateLimit';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const rateLimit = checkRateLimit({
      key: `login:${getClientIp(request)}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

    const body = await readJsonObject(request);
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, users } = await getDB();
    const cleanUsername = username.trim().toLowerCase();

    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    if (existingUsers.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = existingUsers[0];
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = await signJWT({ id: user.id, username: user.username }, config.jwtSecret);

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
  } catch (error: unknown) {
    return apiErrorFromCaught(error, 'Internal Server Error');
  }
};
