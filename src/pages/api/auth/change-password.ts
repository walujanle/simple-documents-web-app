export const prerender = false;

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { comparePassword, hashPassword } from '@/utils/auth';
import { readJsonObject } from '@/utils/json';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/utils/rateLimit';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const rateLimit = checkRateLimit({
      key: `change-password:${user.id}:${getClientIp(request)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

    const body = await readJsonObject(request);
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return new Response(
        JSON.stringify({
          error: 'Current password and a new password of at least 6 characters are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { db, users } = await getDB();

    // Fetch user record to retrieve current password hash
    const dbUsers = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    if (dbUsers.length === 0) {
      return new Response(JSON.stringify({ error: 'User record not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dbUser = dbUsers[0];
    const isPasswordValid = await comparePassword(currentPassword, dbUser.passwordHash);

    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: 'Invalid current password' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newPasswordHash = await hashPassword(newPassword);

    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, user.id));

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
