const readEnv = (key: string, defaultValue = ''): string => {
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env[key] as string | undefined)
      : undefined;
  const procEnv = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return procEnv || metaEnv || defaultValue;
};

const readPositiveInt = (key: string, defaultValue: number): number => {
  const value = Number.parseInt(readEnv(key), 10);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
};

const readBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = readEnv(key);
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const isDevelopmentRuntime = (): boolean => readEnv('NODE_ENV') === 'development';

export const serverConfig = {
  redisUrl: readEnv('REDIS_URL'),
  documentCacheTtlSeconds: readPositiveInt('DOCUMENT_CACHE_TTL_SECONDS', 120),
  imageUpload: {
    maxBytes: readPositiveInt('IMAGE_UPLOAD_MAX_BYTES', 2 * 1024 * 1024),
  },
  importMarkdown: {
    maxBytes: readPositiveInt('MARKDOWN_IMPORT_MAX_BYTES', 5 * 1024 * 1024),
  },
  backupRestore: {
    maxBytes: readPositiveInt('BACKUP_RESTORE_MAX_BYTES', 50 * 1024 * 1024),
  },
  devImageStorage: {
    enabled: readBoolean('DEV_IMAGE_STORAGE_ENABLED', isDevelopmentRuntime()),
    directory: readEnv('DEV_IMAGE_STORAGE_DIR', 'database/dev-image-storage'),
    publicBaseUrl: readEnv('DEV_IMAGE_PUBLIC_BASE_URL'),
  },
  s3: {
    endpoint: readEnv('S3_ENDPOINT'),
    region: readEnv('S3_REGION', 'auto'),
    accessKeyId: readEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: readEnv('S3_SECRET_ACCESS_KEY'),
    bucket: readEnv('S3_BUCKET'),
    publicBaseUrl: readEnv('S3_PUBLIC_BASE_URL'),
    forcePathStyle: readBoolean('S3_FORCE_PATH_STYLE', true),
  },
};

export type ServerConfig = typeof serverConfig;
