export const prerender = false;

import type { APIRoute } from 'astro';
import { and, eq, inArray } from 'drizzle-orm';
import JSZip from 'jszip';
import { getDB } from '@/db';
import { invalidateDocumentsCache, invalidateUserCache } from '@/utils/documentCache';
import {
  cleanupUnreferencedDocumentImages,
  rewriteBackupImageUrls,
  rewriteManagedImageUrls,
} from '@/utils/documentImages';
import {
  createImageObjectKey,
  getImageObject,
  isImageStorageEnabled,
  putImageObject,
} from '@/utils/objectStorage';
import { serverConfig } from '@/utils/serverConfig';

type BackupImage = {
  originalUrl: string;
  objectKey: string;
  relativePath: string;
  backupPath: string;
  filename: string;
  contentType: string;
  size: number;
};

const sanitizeFilename = (name: string): string => {
  return (name || 'untitled')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
};

const uniquePath = (path: string, usedPaths: Set<string>): string => {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const dotIndex = path.lastIndexOf('.');
  const base = dotIndex > -1 ? path.slice(0, dotIndex) : path;
  const ext = dotIndex > -1 ? path.slice(dotIndex) : '';
  let index = 2;
  let candidate = `${base}-${index}${ext}`;
  while (usedPaths.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}${ext}`;
  }
  usedPaths.add(candidate);
  return candidate;
};

const getFolderPath = (folderId: string | null, folders: any[]): string => {
  if (!folderId) return '';
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return '';
  const parent = getFolderPath(folder.parentId, folders);
  return parent ? `${parent}/${sanitizeFilename(folder.name)}` : sanitizeFilename(folder.name);
};

const getBackupImageFilename = (key: string, usedFilenames: Set<string>): string => {
  const rawName = key.split('/').pop() || 'image.webp';
  const dotIndex = rawName.lastIndexOf('.');
  const name = dotIndex > -1 ? rawName.slice(0, dotIndex) : rawName;
  const ext = dotIndex > -1 ? rawName.slice(dotIndex) : '.webp';
  return uniquePath(`${sanitizeFilename(name)}${ext.toLowerCase()}`, usedFilenames);
};

export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { db, documents, folders, users, documentVersions } = await getDB();
    const dbUserRows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const dbUser = dbUserRows[0];
    if (!dbUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id));
    const userDocs = await db.select().from(documents).where(eq(documents.userId, user.id));
    const cleanFolders = userFolders.map((folder: any) => ({
      ...folder,
      isPublic: folder.isPublic === true || folder.isPublic === 1,
    }));
    const docIds = userDocs.map((doc: any) => doc.id);
    const userVersions =
      docIds.length > 0
        ? await db
            .select()
            .from(documentVersions)
            .where(inArray(documentVersions.documentId, docIds))
        : [];

    const versionsByDocument = new Map<string, any[]>();
    for (const version of userVersions) {
      const list = versionsByDocument.get(version.documentId) || [];
      list.push(version);
      versionsByDocument.set(version.documentId, list);
    }

    const zip = new JSZip();
    const usedZipPaths = new Set<string>();
    const backupDocuments: any[] = [];
    const backupVersions: any[] = [];

    for (const doc of userDocs) {
      const folderPath = getFolderPath(doc.folderId, cleanFolders);
      const directoryName = `${sanitizeFilename(doc.title || 'Untitled Document')}-${doc.id}`;
      const documentDirectory = uniquePath(
        folderPath ? `${folderPath}/${directoryName}` : directoryName,
        usedZipPaths,
      );
      const markdownPath = uniquePath(
        `${documentDirectory}/${sanitizeFilename(doc.title || 'document')}.md`,
        usedZipPaths,
      );
      const imageEntries = new Map<string, BackupImage>();
      const usedImageFilenames = new Set<string>();

      const resolveLocalImage = async (
        key: string,
        originalUrl: string,
      ): Promise<string | null> => {
        const existing = imageEntries.get(key);
        if (existing) return existing.relativePath;

        const object = await getImageObject(key);
        if (!object) return null;

        const filename = getBackupImageFilename(key, usedImageFilenames);
        const relativePath = `images/${filename}`;
        const backupPath = `${documentDirectory}/${relativePath}`;
        zip.file(backupPath, object.body);
        imageEntries.set(key, {
          originalUrl,
          objectKey: key,
          relativePath,
          backupPath,
          filename,
          contentType: object.contentType,
          size: object.body.byteLength,
        });
        return relativePath;
      };

      const rewrittenContent = await rewriteManagedImageUrls(
        doc.content || '',
        doc.id,
        resolveLocalImage,
      );

      for (const version of versionsByDocument.get(doc.id) || []) {
        backupVersions.push({
          ...version,
          content: await rewriteManagedImageUrls(version.content || '', doc.id, resolveLocalImage),
        });
      }

      zip.file(markdownPath, rewrittenContent);
      backupDocuments.push({
        ...doc,
        isPublic: doc.isPublic === true || doc.isPublic === 1,
        content: rewrittenContent,
        backupDirectory: documentDirectory,
        markdownPath,
        images: [...imageEntries.values()],
      });
    }

    const metadata = {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      user: {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        website: dbUser.website,
        facebook: dbUser.facebook,
        instagram: dbUser.instagram,
        twitter: dbUser.twitter,
        linkedin: dbUser.linkedin,
        mastodon: dbUser.mastodon,
        bluesky: dbUser.bluesky,
      },
      folders: cleanFolders,
      documents: backupDocuments,
      documentVersions: backupVersions,
    };

    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    return new Response(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="simple_documents_backup_${Date.now()}.zip"`,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (file.size > serverConfig.backupRestore.maxBytes) {
      return new Response(JSON.stringify({ error: 'Backup ZIP exceeds the restore limit.' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      return new Response(
        JSON.stringify({ error: 'Invalid backup: metadata.json not found in ZIP' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const backupData = JSON.parse(await metadataFile.async('text'));
    const { db, users, folders, documents, documentVersions, dialect } = await getDB();
    const restoreImageMaps = new Map<string, Map<string, string>>();
    const restoredContentByDocument = new Map<string, string>();

    const restoreImagesForDocument = async (doc: any, targetDocumentId: string) => {
      const imageMap = new Map<string, string>();
      const images = Array.isArray(doc.images) ? doc.images : [];
      if (images.length > 0 && !isImageStorageEnabled()) {
        throw new Error('Image storage must be configured before restoring a backup with images.');
      }

      for (const image of images) {
        const imageFile = zip.file(image.backupPath);
        if (!imageFile) {
          throw new Error(`Backup image missing: ${image.backupPath}`);
        }
        const body = await imageFile.async('uint8array');
        const key = createImageObjectKey(targetDocumentId, image.filename || 'image.webp');
        const uploaded = await putImageObject({ key, body });
        imageMap.set(image.relativePath, uploaded.url);
        imageMap.set(`./${image.relativePath}`, uploaded.url);
        imageMap.set(image.backupPath, uploaded.url);
        if (image.originalUrl) imageMap.set(image.originalUrl, uploaded.url);
        if (image.objectKey) imageMap.set(image.objectKey, uploaded.url);
      }

      return imageMap;
    };

    if (backupData.user) {
      const u = backupData.user;
      await db
        .update(users)
        .set({
          name: u.name,
          website: u.website,
          facebook: u.facebook,
          instagram: u.instagram,
          twitter: u.twitter,
          linkedin: u.linkedin,
          mastodon: u.mastodon,
          bluesky: u.bluesky,
        })
        .where(eq(users.id, user.id));
      await invalidateUserCache(user.username);
    }

    if (Array.isArray(backupData.folders)) {
      for (const folder of backupData.folders) {
        if (!folder.name) continue;

        const folderId = folder.id || crypto.randomUUID();
        const isPublicVal = folder.isPublic === true || folder.isPublic === 1;
        const isPublicDb = isPublicVal
          ? dialect === 'mysql'
            ? 1
            : true
          : dialect === 'mysql'
            ? 0
            : false;
        const createdAt = folder.createdAt ? new Date(folder.createdAt) : new Date();
        const updatedAt = folder.updatedAt ? new Date(folder.updatedAt) : new Date();
        const existing = await db.select().from(folders).where(eq(folders.id, folderId)).limit(1);

        if (existing.length > 0) {
          if (existing[0].userId === user.id) {
            await db
              .update(folders)
              .set({ name: folder.name, isPublic: isPublicDb, updatedAt })
              .where(eq(folders.id, folderId));
          }
        } else {
          await db.insert(folders).values({
            id: folderId,
            userId: user.id,
            name: folder.name,
            parentId: null,
            isPublic: isPublicDb,
            createdAt,
            updatedAt,
          });
        }
      }

      for (const folder of backupData.folders) {
        if (!folder.parentId) continue;
        const parentExists = await db
          .select()
          .from(folders)
          .where(and(eq(folders.id, folder.parentId), eq(folders.userId, user.id)))
          .limit(1);
        if (parentExists.length > 0) {
          await db
            .update(folders)
            .set({ parentId: folder.parentId })
            .where(eq(folders.id, folder.id));
        }
      }
    }

    const docIdMap = new Map<string, string>();
    const docsForCache: any[] = [];
    if (Array.isArray(backupData.documents)) {
      for (const doc of backupData.documents) {
        if (!doc.title || doc.content === undefined) continue;

        const preferredDocId = doc.id || crypto.randomUUID();
        const existing = await db
          .select()
          .from(documents)
          .where(eq(documents.id, preferredDocId))
          .limit(1);
        const shouldImportAsNew = existing.length > 0 && existing[0].userId !== user.id;
        const targetDocId = shouldImportAsNew ? crypto.randomUUID() : preferredDocId;
        const sourceDocId = doc.id || targetDocId;
        const imageMap = await restoreImagesForDocument(doc, targetDocId);
        const restoredContent = rewriteBackupImageUrls(doc.content, imageMap);
        restoreImageMaps.set(sourceDocId, imageMap);
        restoredContentByDocument.set(targetDocId, restoredContent);

        const isPublicVal = doc.isPublic === true || doc.isPublic === 1;
        const isPublicDb = isPublicVal
          ? dialect === 'mysql'
            ? 1
            : true
          : dialect === 'mysql'
            ? 0
            : false;
        const createdAt = doc.createdAt ? new Date(doc.createdAt) : new Date();
        const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : new Date();
        let targetFolderId: string | null = doc.folderId || null;
        if (targetFolderId) {
          const folderExists = await db
            .select()
            .from(folders)
            .where(eq(folders.id, targetFolderId))
            .limit(1);
          if (folderExists.length === 0) targetFolderId = null;
        }

        if (existing.length > 0 && !shouldImportAsNew) {
          docsForCache.push({
            id: targetDocId,
            userId: user.id,
            customSlug: existing[0].customSlug,
          });
          await db
            .update(documents)
            .set({
              title: doc.title,
              content: restoredContent,
              folderId: targetFolderId,
              visibility: doc.visibility || 'private',
              isPublic: isPublicDb,
              description: doc.description || null,
              tags: doc.tags || null,
              customSlug: doc.customSlug || null,
              updatedAt,
            })
            .where(eq(documents.id, targetDocId));
        } else {
          await db.insert(documents).values({
            id: targetDocId,
            userId: user.id,
            folderId: targetFolderId,
            title: shouldImportAsNew ? `${doc.title} (Imported)` : doc.title,
            content: restoredContent,
            visibility: doc.visibility || 'private',
            isPublic: isPublicDb,
            description: doc.description || null,
            tags: doc.tags || null,
            customSlug: shouldImportAsNew ? null : doc.customSlug || null,
            createdAt,
            updatedAt,
          });
        }

        docsForCache.push({
          id: targetDocId,
          userId: user.id,
          customSlug: shouldImportAsNew ? null : doc.customSlug || null,
        });
        docIdMap.set(sourceDocId, targetDocId);
      }
    }

    if (Array.isArray(backupData.documentVersions)) {
      const { config } = await import('@/utils/config');
      const retentionPeriod = config.versionRetentionDays * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - retentionPeriod);

      for (const version of backupData.documentVersions) {
        if (!version.documentId || version.content === undefined) continue;

        const resolvedDocId = docIdMap.get(version.documentId) || version.documentId;
        const docExists = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, resolvedDocId), eq(documents.userId, user.id)))
          .limit(1);
        if (docExists.length === 0) continue;

        const imageMap = restoreImageMaps.get(version.documentId) || new Map<string, string>();
        const restoredVersionContent = rewriteBackupImageUrls(version.content, imageMap);
        const versionId = version.id || crypto.randomUUID();
        let createdAt = version.createdAt ? new Date(version.createdAt) : new Date();
        if (createdAt.getTime() < cutoff.getTime()) createdAt = new Date();

        const existingVersion = await db
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.id, versionId))
          .limit(1);

        if (existingVersion.length > 0) {
          if (existingVersion[0].documentId === resolvedDocId) {
            await db
              .update(documentVersions)
              .set({
                title: version.title || 'Untitled Version',
                content: restoredVersionContent,
                createdAt,
              })
              .where(eq(documentVersions.id, versionId));
          }
        } else {
          await db.insert(documentVersions).values({
            id: versionId,
            documentId: resolvedDocId,
            title: version.title || 'Untitled Version',
            content: restoredVersionContent,
            createdAt,
          });
        }
      }
    }

    for (const [documentId, currentContent] of restoredContentByDocument) {
      await cleanupUnreferencedDocumentImages({
        db,
        documentVersions,
        documentId,
        currentContent,
      });
    }

    if (docsForCache.length > 0) {
      await invalidateDocumentsCache(docsForCache);
    }

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
