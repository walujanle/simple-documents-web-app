import { eq } from 'drizzle-orm';
import {
  deleteDocumentImageObjects,
  deleteImageObjects,
  listDocumentImageObjectKeys,
} from '@/utils/objectStorage';

type RuntimeEnv = Record<string, any> | undefined;
type ImageReplacer = (key: string, url: string) => string | null | Promise<string | null>;

const markdownImagePattern = /!\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|[^)]*))?\s*\)/g;

const decodeKey = (value: string): string => {
  return value
    .split('/')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join('/');
};

export const getManagedImageKeyFromUrl = (value: string, documentId?: string): string | null => {
  const cleanValue = value.trim().replace(/^<|>$/g, '');
  let path = cleanValue.split(/[?#]/, 1)[0];

  try {
    path = new URL(cleanValue, 'https://local.invalid').pathname;
  } catch {}

  const match = path.match(/(?:^|\/)(files\/documents\/([^/]+)\/[^?#]+)/);
  if (!match) return null;

  const key = decodeKey(match[1]);
  const matchedDocumentId = decodeKey(match[2]);
  if (documentId && matchedDocumentId !== documentId) return null;
  return key;
};

export const extractManagedImageKeys = (
  markdown: string | null | undefined,
  documentId?: string,
): Set<string> => {
  const keys = new Set<string>();
  if (!markdown) return keys;

  for (const match of markdown.matchAll(markdownImagePattern)) {
    const key = getManagedImageKeyFromUrl(match[1], documentId);
    if (key) keys.add(key);
  }

  return keys;
};

export const rewriteManagedImageUrls = async (
  markdown: string | null | undefined,
  documentId: string,
  replacer: ImageReplacer,
): Promise<string> => {
  const source = markdown || '';
  let output = '';
  let lastIndex = 0;

  for (const match of source.matchAll(markdownImagePattern)) {
    const fullMatch = match[0];
    const url = match[1];
    const index = match.index ?? 0;
    const key = getManagedImageKeyFromUrl(url, documentId);
    output += source.slice(lastIndex, index);

    if (!key) {
      output += fullMatch;
    } else {
      const replacement = await replacer(key, url);
      output += replacement ? fullMatch.replace(url, replacement) : fullMatch;
    }

    lastIndex = index + fullMatch.length;
  }

  return output + source.slice(lastIndex);
};

export const rewriteBackupImageUrls = (
  markdown: string | null | undefined,
  urlMap: Map<string, string>,
): string => {
  const source = markdown || '';
  return source.replace(markdownImagePattern, (fullMatch, url: string) => {
    const normalized = url.replace(/^\.\/+/, '');
    const replacement =
      urlMap.get(url) ||
      urlMap.get(normalized) ||
      urlMap.get(decodeKey(url)) ||
      urlMap.get(decodeKey(normalized));
    return replacement ? fullMatch.replace(url, replacement) : fullMatch;
  });
};

export const cleanupUnreferencedDocumentImages = async ({
  db,
  documentVersions,
  documentId,
  currentContent,
  candidateKeys,
  runtimeEnv,
}: {
  db: any;
  documentVersions: any;
  documentId: string;
  currentContent: string | null | undefined;
  candidateKeys?: Iterable<string>;
  runtimeEnv?: RuntimeEnv;
}): Promise<void> => {
  const candidates = new Set(
    candidateKeys || (await listDocumentImageObjectKeys(documentId, runtimeEnv)),
  );
  if (candidates.size === 0) return;

  const referenced = extractManagedImageKeys(currentContent, documentId);
  const versions = await db
    .select({ content: documentVersions.content })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));

  for (const version of versions) {
    for (const key of extractManagedImageKeys(version.content, documentId)) {
      referenced.add(key);
    }
  }

  const unused = [...candidates].filter((key) => !referenced.has(key));
  await deleteImageObjects(unused, runtimeEnv);
};

export const deleteAllDocumentImages = async (
  documentId: string,
  runtimeEnv?: RuntimeEnv,
): Promise<void> => {
  await deleteDocumentImageObjects(documentId, runtimeEnv);
};
