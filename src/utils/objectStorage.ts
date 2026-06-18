import {
  deleteDevImageObjects,
  isDevImageStorageEnabled,
  listDevImageObjectKeys,
  readDevImageObject,
  writeDevImageObject,
} from '@/utils/devImageStorage';
import { serverConfig } from '@/utils/serverConfig';

type RuntimeEnv = unknown;
type StoredImageObject = {
  body: Uint8Array;
  contentType: string;
};

const documentImagesRoot = 'files/documents';

const getPublicBaseUrl = (): string => serverConfig.s3.publicBaseUrl.replace(/\/+$/g, '');

const hasS3Config = (): boolean => {
  return Boolean(
    serverConfig.s3.bucket &&
      serverConfig.s3.accessKeyId &&
      serverConfig.s3.secretAccessKey &&
      serverConfig.s3.publicBaseUrl,
  );
};

export const isImageStorageEnabled = (_runtimeEnv?: RuntimeEnv): boolean => {
  return Boolean((hasS3Config() && getPublicBaseUrl()) || isDevImageStorageEnabled());
};

export const getImageUploadSettings = (runtimeEnv?: RuntimeEnv) => ({
  uploadsEnabled: isImageStorageEnabled(runtimeEnv),
  maxBytes: serverConfig.imageUpload.maxBytes,
});

export const createDocumentImagePrefix = (documentId: string): string => {
  const safeDocumentId = documentId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${documentImagesRoot}/${safeDocumentId}`;
};

export const sanitizeObjectFilename = (_filename: string): string => `${crypto.randomUUID()}.webp`;

export const createImageObjectKey = (documentId: string, filename: string): string => {
  return `${createDocumentImagePrefix(documentId)}/${sanitizeObjectFilename(filename)}`;
};

export const buildPublicObjectUrl = (key: string): string => {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${getPublicBaseUrl()}/${encodedKey}`;
};

const toUint8Array = async (body: any): Promise<Uint8Array> => {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof body?.transformToByteArray === 'function') {
    return new Uint8Array(await body.transformToByteArray());
  }
  if (typeof body?.arrayBuffer === 'function') {
    return new Uint8Array(await body.arrayBuffer());
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | ArrayBuffer | string>) {
    chunks.push(
      typeof chunk === 'string'
        ? new TextEncoder().encode(chunk)
        : chunk instanceof ArrayBuffer
          ? new Uint8Array(chunk)
          : new Uint8Array(chunk),
    );
  }
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

export const putImageObject = async ({
  key,
  body,
  runtimeEnv: _runtimeEnv,
}: {
  key: string;
  body: Uint8Array;
  runtimeEnv?: RuntimeEnv;
}): Promise<{ key: string; url: string }> => {
  const contentType = 'image/webp';
  const cacheControl = 'public, max-age=31536000, immutable';

  if (hasS3Config()) {
    const packageName = '@aws-sdk/client-s3';
    const { PutObjectCommand, S3Client } = await import(/* @vite-ignore */ packageName);
    const client = new S3Client({
      region: serverConfig.s3.region,
      endpoint: serverConfig.s3.endpoint || undefined,
      forcePathStyle: serverConfig.s3.forcePathStyle,
      credentials: {
        accessKeyId: serverConfig.s3.accessKeyId,
        secretAccessKey: serverConfig.s3.secretAccessKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: serverConfig.s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );

    return { key, url: buildPublicObjectUrl(key) };
  }

  if (isDevImageStorageEnabled()) {
    const url = await writeDevImageObject(key, body);
    return { key, url };
  }

  throw new Error('Image object storage is not configured.');
};

export const getImageObject = async (
  key: string,
  _runtimeEnv?: RuntimeEnv,
): Promise<StoredImageObject | null> => {
  if (!hasS3Config()) {
    const body = await readDevImageObject(key);
    return body ? { body, contentType: 'image/webp' } : null;
  }

  const packageName = '@aws-sdk/client-s3';
  const { GetObjectCommand, S3Client } = await import(/* @vite-ignore */ packageName);
  const client = new S3Client({
    region: serverConfig.s3.region,
    endpoint: serverConfig.s3.endpoint || undefined,
    forcePathStyle: serverConfig.s3.forcePathStyle,
    credentials: {
      accessKeyId: serverConfig.s3.accessKeyId,
      secretAccessKey: serverConfig.s3.secretAccessKey,
    },
  });
  const result = await client.send(
    new GetObjectCommand({
      Bucket: serverConfig.s3.bucket,
      Key: key,
    }),
  );
  if (!result.Body) return null;
  return {
    body: await toUint8Array(result.Body),
    contentType: result.ContentType || 'image/webp',
  };
};

export const listDocumentImageObjectKeys = async (
  documentId: string,
  _runtimeEnv?: RuntimeEnv,
): Promise<string[]> => {
  const prefix = `${createDocumentImagePrefix(documentId)}/`;
  if (!hasS3Config()) return listDevImageObjectKeys(prefix);

  const packageName = '@aws-sdk/client-s3';
  const { ListObjectsV2Command, S3Client } = await import(/* @vite-ignore */ packageName);
  const client = new S3Client({
    region: serverConfig.s3.region,
    endpoint: serverConfig.s3.endpoint || undefined,
    forcePathStyle: serverConfig.s3.forcePathStyle,
    credentials: {
      accessKeyId: serverConfig.s3.accessKeyId,
      secretAccessKey: serverConfig.s3.secretAccessKey,
    },
  });

  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: serverConfig.s3.bucket,
        Prefix: prefix,
        ContinuationToken,
      }),
    );
    keys.push(
      ...(result.Contents || [])
        .map((object: { Key?: string }) => object.Key)
        .filter((key: string | undefined): key is string => Boolean(key)),
    );
    ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
};

export const deleteImageObjects = async (
  keys: string[],
  _runtimeEnv?: RuntimeEnv,
): Promise<void> => {
  const uniqueKeys = [...new Set(keys)].filter(Boolean);
  if (uniqueKeys.length === 0) return;

  if (!hasS3Config()) {
    await deleteDevImageObjects(uniqueKeys);
    return;
  }

  const packageName = '@aws-sdk/client-s3';
  const { DeleteObjectCommand, S3Client } = await import(/* @vite-ignore */ packageName);
  const client = new S3Client({
    region: serverConfig.s3.region,
    endpoint: serverConfig.s3.endpoint || undefined,
    forcePathStyle: serverConfig.s3.forcePathStyle,
    credentials: {
      accessKeyId: serverConfig.s3.accessKeyId,
      secretAccessKey: serverConfig.s3.secretAccessKey,
    },
  });

  await Promise.all(
    uniqueKeys.map((key) =>
      client.send(
        new DeleteObjectCommand({
          Bucket: serverConfig.s3.bucket,
          Key: key,
        }),
      ),
    ),
  );
};

export const deleteDocumentImageObjects = async (
  documentId: string,
  runtimeEnv?: RuntimeEnv,
): Promise<void> => {
  const keys = await listDocumentImageObjectKeys(documentId, runtimeEnv);
  await deleteImageObjects(keys, runtimeEnv);
};
