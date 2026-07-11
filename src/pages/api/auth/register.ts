export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { apiErrorFromCaught } from '@/utils/apiError';
import { hashPassword, signJWT } from '@/utils/auth';
import { config } from '@/utils/config';
import { readJsonObject } from '@/utils/json';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/utils/rateLimit';
import {
  getUsernameValidationError,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
} from '@/utils/username';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (!config.allowRegistration) {
      return new Response(JSON.stringify({ error: 'Registration is disabled.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const usernameError = getUsernameValidationError(username);
    if (usernameError) {
      return new Response(JSON.stringify({ error: usernameError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { db, users } = await getDB();
    const cleanUsername = normalizeUsername(username);

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
  } catch (error: unknown) {
    return apiErrorFromCaught(error);
  }
};
