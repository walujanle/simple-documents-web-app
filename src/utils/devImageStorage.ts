import { serverConfig } from '@/utils/serverConfig';

const managedRoot = 'files/documents';

const getEnv = (): Record<string, string | undefined> => {
  return typeof process !== 'undefined' ? process.env : {};
};

export const isDevImageStorageEnabled = (): boolean => {
  const env = getEnv();
  return env.NODE_ENV === 'development' && serverConfig.devImageStorage.enabled;
};

const encodeObjectKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/');

export const buildDevImageObjectUrl = (key: string): string => {
  const baseUrl = serverConfig.devImageStorage.publicBaseUrl.replace(/\/+$/g, '');
  const path = `/${encodeObjectKey(key)}`;
  return baseUrl ? `${baseUrl}${path}` : path;
};

const normalizeObjectKey = (key: string): string | null => {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith(`${managedRoot}/`)) return null;
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return normalized;
};

const normalizePrefix = (prefix: string): string | null => {
  const normalized = prefix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized.startsWith(`${managedRoot}/`)) return null;
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return normalized;
};

const getNodeModules = async () => {
  const fs = await import(/* @vite-ignore */ 'node:fs/promises');
  const path = await import(/* @vite-ignore */ 'node:path');
  return { fs, path };
};

const resolveStoragePath = async (key: string) => {
  const normalized = normalizeObjectKey(key);
  if (!normalized) return null;

  const { path } = await getNodeModules();
  const root = path.resolve(process.cwd(), serverConfig.devImageStorage.directory);
  const target = path.resolve(root, normalized);
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!target.toLowerCase().startsWith(rootWithSeparator.toLowerCase())) return null;
  return { key: normalized, root, target };
};

export const writeDevImageObject = async (key: string, body: Uint8Array): Promise<string> => {
  if (!isDevImageStorageEnabled()) {
    throw new Error('Development image storage is not enabled.');
  }

  const resolved = await resolveStoragePath(key);
  if (!resolved) {
    throw new Error('Invalid development image object key.');
  }

  const { fs, path } = await getNodeModules();
  await fs.mkdir(path.dirname(resolved.target), { recursive: true });
  await fs.writeFile(resolved.target, body);
  return buildDevImageObjectUrl(resolved.key);
};

export const readDevImageObject = async (key: string): Promise<Uint8Array | null> => {
  if (!isDevImageStorageEnabled()) return null;

  const resolved = await resolveStoragePath(key);
  if (!resolved) return null;

  try {
    const { fs } = await getNodeModules();
    return new Uint8Array(await fs.readFile(resolved.target));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

export const listDevImageObjectKeys = async (prefix: string): Promise<string[]> => {
  if (!isDevImageStorageEnabled()) return [];

  const normalizedPrefix = normalizePrefix(prefix);
  if (!normalizedPrefix) return [];

  const { fs, path } = await getNodeModules();
  const root = path.resolve(process.cwd(), serverConfig.devImageStorage.directory);
  const start = path.resolve(root, normalizedPrefix);
  const keys: string[] = [];

  const walk = async (directory: string) => {
    let entries: any[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        keys.push(path.relative(root, entryPath).replace(/\\/g, '/'));
      }
    }
  };

  await walk(start);
  return keys;
};

export const deleteDevImageObjects = async (keys: string[]): Promise<void> => {
  if (!isDevImageStorageEnabled()) return;

  const { fs } = await getNodeModules();
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      const resolved = await resolveStoragePath(key);
      if (!resolved) return;
      try {
        await fs.unlink(resolved.target);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }),
  );
};
