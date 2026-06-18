import { serverConfig } from '@/utils/serverConfig';

type RedisClient = {
  isOpen?: boolean;
  connect: () => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  setEx: (key: string, seconds: number, value: string) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
  on: (event: string, listener: (...args: any[]) => void) => RedisClient;
};

let redisClientPromise: Promise<RedisClient | null> | null = null;
let redisUnavailableUntil = 0;
const cacheFailureCooldownMs = 60_000;

const markRedisUnavailable = () => {
  redisUnavailableUntil = Date.now() + cacheFailureCooldownMs;
  redisClientPromise = null;
};

const getRedisClient = async (): Promise<RedisClient | null> => {
  if (!serverConfig.redisUrl || Date.now() < redisUnavailableUntil) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const packageName = 'redis';
        const { createClient } = await import(/* @vite-ignore */ packageName);
        const client = createClient({ url: serverConfig.redisUrl }) as RedisClient;
        client.on('error', () => {
          markRedisUnavailable();
        });
        await client.connect();
        return client;
      } catch {
        markRedisUnavailable();
        return null;
      }
    })();
  }
  return redisClientPromise;
};

export const cacheGet = async (key: string, _runtimeEnv?: unknown): Promise<string | null> => {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get(key);
  } catch {
    markRedisUnavailable();
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: string,
  ttlSeconds = serverConfig.documentCacheTtlSeconds,
  _runtimeEnv?: unknown,
): Promise<void> => {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.setEx(key, ttlSeconds, value);
  } catch {
    markRedisUnavailable();
  }
};

export const cacheDelete = async (key: string, _runtimeEnv?: unknown): Promise<void> => {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch {
    markRedisUnavailable();
  }
};

export const cacheGetJson = async <T>(key: string, runtimeEnv?: unknown): Promise<T | null> => {
  const value = await cacheGet(key, runtimeEnv);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    await cacheDelete(key, runtimeEnv);
    return null;
  }
};

export const cacheSetJson = async (
  key: string,
  value: unknown,
  ttlSeconds = serverConfig.documentCacheTtlSeconds,
  runtimeEnv?: unknown,
): Promise<void> => {
  await cacheSet(key, JSON.stringify(value), ttlSeconds, runtimeEnv);
};
