import { and, eq, or } from 'drizzle-orm';
import { getDB } from '@/db';
import { cacheDelete, cacheGetJson, cacheSetJson } from '@/utils/cache';
import { serverConfig } from '@/utils/serverConfig';

type RuntimeEnv = Record<string, any> | undefined;
type CachedDocument = Record<string, any>;
type CachedUser = Record<string, any>;

const docByIdKey = (id: string) => `document:id:${id}`;
const userByUsernameKey = (username: string) => `user:username:${username.toLowerCase()}`;
const publicDocKey = (userId: string, identifier: string) =>
  `document:public:${userId}:${identifier}`;

export const getCachedDocumentById = async (
  id: string,
  runtimeEnv?: RuntimeEnv,
): Promise<CachedDocument | null> => {
  const key = docByIdKey(id);
  const cached = await cacheGetJson<CachedDocument>(key, runtimeEnv);
  if (cached) return cached;

  const { db, documents } = await getDB();
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  const doc = rows[0] ?? null;
  if (doc) {
    await cacheSetJson(key, doc, serverConfig.documentCacheTtlSeconds, runtimeEnv);
  }
  return doc;
};

export const getCachedUserByUsername = async (
  username: string,
  runtimeEnv?: RuntimeEnv,
): Promise<CachedUser | null> => {
  const cleanUsername = username.toLowerCase();
  const key = userByUsernameKey(cleanUsername);
  const cached = await cacheGetJson<CachedUser>(key, runtimeEnv);
  if (cached) return cached;

  const { db, users } = await getDB();
  const rows = await db.select().from(users).where(eq(users.username, cleanUsername)).limit(1);
  const user = rows[0] ?? null;
  if (user) {
    await cacheSetJson(key, user, serverConfig.documentCacheTtlSeconds, runtimeEnv);
  }
  return user;
};

export const getCachedPublicDocument = async (
  username: string,
  identifier: string,
  runtimeEnv?: RuntimeEnv,
): Promise<{ user: CachedUser | null; doc: CachedDocument | null }> => {
  const user = await getCachedUserByUsername(username, runtimeEnv);
  if (!user) return { user: null, doc: null };

  const key = publicDocKey(user.id, identifier);
  const cachedDoc = await cacheGetJson<CachedDocument>(key, runtimeEnv);
  if (cachedDoc) return { user, doc: cachedDoc };

  const { db, documents } = await getDB();
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, user.id),
        or(eq(documents.id, identifier), eq(documents.customSlug, identifier)),
        or(eq(documents.visibility, 'public'), eq(documents.visibility, 'unlisted')),
      ),
    )
    .limit(1);
  const doc = rows[0] ?? null;

  if (doc) {
    await cacheSetJson(key, doc, serverConfig.documentCacheTtlSeconds, runtimeEnv);
  }

  return { user, doc };
};

export const invalidateDocumentCache = async (
  doc: { id?: string | null; userId?: string | null; customSlug?: string | null },
  runtimeEnv?: RuntimeEnv,
  extraIdentifiers: Array<string | null | undefined> = [],
): Promise<void> => {
  const keys = new Set<string>();
  if (doc.id) {
    keys.add(docByIdKey(doc.id));
    if (doc.userId) keys.add(publicDocKey(doc.userId, doc.id));
  }
  if (doc.userId && doc.customSlug) keys.add(publicDocKey(doc.userId, doc.customSlug));
  for (const identifier of extraIdentifiers) {
    if (doc.userId && identifier) keys.add(publicDocKey(doc.userId, identifier));
  }

  await Promise.all([...keys].map((key) => cacheDelete(key, runtimeEnv)));
};

export const invalidateUserCache = async (
  username: string | null | undefined,
  runtimeEnv?: RuntimeEnv,
): Promise<void> => {
  if (!username) return;
  await cacheDelete(userByUsernameKey(username), runtimeEnv);
};

export const invalidateDocumentsCache = async (
  docs: Array<{ id?: string | null; userId?: string | null; customSlug?: string | null }>,
  runtimeEnv?: RuntimeEnv,
): Promise<void> => {
  await Promise.all(docs.map((doc) => invalidateDocumentCache(doc, runtimeEnv)));
};
