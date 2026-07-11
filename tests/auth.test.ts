import { describe, expect, test } from 'bun:test';
import { isWeakJwtSecret, signJWT, verifyJWT } from '../src/utils/auth';
import { checkRateLimit } from '../src/utils/rateLimit';
import {
  getUsernameValidationError,
  isReservedUsername,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
} from '../src/utils/username';

describe('auth JWT', () => {
  test('isWeakJwtSecret detects fallback and short secrets', () => {
    expect(isWeakJwtSecret('')).toBe(true);
    expect(isWeakJwtSecret('super-secret-key-change-me')).toBe(true);
    expect(isWeakJwtSecret('short')).toBe(true);
    expect(isWeakJwtSecret('a'.repeat(32))).toBe(false);
  });

  test('signJWT + verifyJWT round-trip', async () => {
    const secret = 'test-secret-key-at-least-32-chars!!';
    const token = await signJWT({ id: 'u1', username: 'alice' }, secret, 1);
    const payload = await verifyJWT(token, secret);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe('u1');
    expect(payload?.username).toBe('alice');
  });

  test('verifyJWT rejects wrong secret', async () => {
    const token = await signJWT({ id: 'u1' }, 'test-secret-key-at-least-32-chars!!', 1);
    const payload = await verifyJWT(token, 'other-secret-key-at-least-32-chars!');
    expect(payload).toBeNull();
  });
});

describe('username', () => {
  test('normalizes and rejects reserved names', () => {
    expect(normalizeUsername('  Alice  ')).toBe('alice');
    expect(isReservedUsername('documents')).toBe(true);
    expect(getUsernameValidationError('ab')).toMatch(/at least 3/);
    expect(getUsernameValidationError('api')).toMatch(/reserved/i);
    expect(getUsernameValidationError('valid-user')).toBeNull();
  });

  test('password floor constant', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });
});

describe('rateLimit', () => {
  test('allows under limit then blocks', () => {
    const key = `test:${crypto.randomUUID()}`;
    const first = checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    const second = checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    const third = checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});
