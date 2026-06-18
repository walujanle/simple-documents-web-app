# Simple Documents Web App - Technical Documentation

This document describes the current implementation of `simple-documents-web-app`. It is written for developers and AI agents that need to understand the project without first reading every source file.

## 1. System Purpose

The application is a Bun-powered Astro SSR document workspace. Users can register with username/password, create Markdown-backed documents, organize them into folders, publish public or unlisted documents, maintain version history, import/export data, and optionally upload optimized WebP images to S3-compatible storage.

The project is configured for Node standalone deployment through `@astrojs/node`. It does not use Cloudflare Workers deployment in this repository.

## 2. Runtime Topology

- `astro.config.mjs` sets `output: 'server'` and uses the Node standalone adapter.
- React components are mounted as Astro islands for workspace interactions.
- `src/middleware.ts` verifies the `session` cookie and injects `locals.user` for protected pages and API routes.
- Database access is centralized in `src/db/index.ts`.
- Public document reads use `src/utils/documentCache.ts`, which layers Redis over database reads when configured.
- Image uploads use `/api/images/config` and `/api/images/upload` with S3-compatible storage.

## 3. Dependency Map

Core dependencies:

- `astro`, `@astrojs/node`, `@astrojs/react`
- `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/vite`
- `drizzle-orm`
- `better-sqlite3`, `pg`, `mysql2`
- `bcryptjs`
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `tiptap-markdown`
- `isomorphic-dompurify`
- `browser-image-compression`
- `@aws-sdk/client-s3`
- `redis`
- `jszip`

Native database drivers are externalized in Vite SSR configuration to avoid bundling native binaries.

## 4. Environment Variables

Required in production:

- `JWT_SECRET`: HMAC secret for HTTP-only JWT sessions.

Optional database:

- `DATABASE_URL`: blank uses `./database/sqlite.db`.
- PostgreSQL examples start with `postgres://` or `postgresql://`.
- MySQL/MariaDB examples start with `mysql://`.

Optional Redis cache:

- `REDIS_URL`: standard Redis URL. Blank disables cache.
- `DOCUMENT_CACHE_TTL_SECONDS`: positive integer TTL, default `120`.

Optional S3-compatible image uploads:

- `S3_ENDPOINT`
- `S3_REGION`, default `auto`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_PUBLIC_BASE_URL`
- `S3_FORCE_PATH_STYLE`, default `true`
- `IMAGE_UPLOAD_MAX_BYTES`, default 2 MiB
- `MARKDOWN_IMPORT_MAX_BYTES`, default 5 MiB
- `BACKUP_RESTORE_MAX_BYTES`, default 50 MiB
- `DEV_IMAGE_STORAGE_ENABLED`, default enabled only when `NODE_ENV=development`
- `DEV_IMAGE_STORAGE_DIR`, default `database/dev-image-storage`
- `DEV_IMAGE_PUBLIC_BASE_URL`, blank returns same-origin `/files/...` URLs

Optional metadata:

- `APP_NAME`
- `APP_DESCRIPTION`
- `APP_COVER_IMAGE`, default `/cover/cover-placeholder.png`
- `APP_LOGO`
- `APP_ICON`
- `VERSION_RETENTION_DAYS`, default `7`, minimum `1`

Fallbacks are implemented in `src/utils/config.ts` and `src/utils/serverConfig.ts`.

## 5. Authentication Model

This repository uses password-based authentication.

Registration:

- Endpoint: `POST /api/auth/register`
- Requires `username` length at least 3 and `password` length at least 6.
- Enforces unique usernames, not single-user locking.
- Hashes passwords with `bcryptjs`.
- Creates a user row and sets the `session` cookie.

Login:

- Endpoint: `POST /api/auth/login`
- Looks up the user by lowercase username.
- Verifies the password with `bcryptjs`.
- Issues an HTTP-only `session` JWT cookie.

Password change:

- Endpoint: `POST /api/auth/change-password`
- Requires an authenticated user, current password, and a new password of at least 6 characters.
- Verifies the current password before replacing `password_hash`.

Session security:

- JWT signing is implemented in `src/utils/auth.ts` with native Web Crypto HMAC SHA-256.
- Cookies are `httpOnly`, `sameSite: 'lax'`, path `/`, and `secure` in production.
- Middleware protects `/documents`, `/api/documents`, `/api/folders`, `/api/auth/profile`, `/api/auth/change-password`, and `/api/images`.

## 6. Database Architecture

`src/db/index.ts` chooses the dialect from `DATABASE_URL`.

- Blank: SQLite at `./database/sqlite.db`
- `postgres://` or `postgresql://`: PostgreSQL
- `mysql://`: MySQL/MariaDB

The application performs runtime schema initialization with `CREATE TABLE IF NOT EXISTS` and additive `ALTER TABLE` calls. This keeps deployment simple, but schema changes must remain backward-compatible and additive unless a separate migration strategy is introduced.

Main tables:

- `users`: account, password hash, profile metadata, social links, featured flag.
- `folders`: nested folder tree through `parent_id`, with public/private folder visibility.
- `documents`: Markdown content, folder link, visibility, custom slug, SEO metadata.
- `document_versions`: title/content snapshots for restore.

## 7. Document and Folder Behavior

Document visibility:

- `private`: only owner can read.
- `public`: listed on public profile and indexable.
- `unlisted`: direct-link accessible but not listed/indexed.

Folder visibility rules:

- Public folders force nested documents to public visibility.
- Moving a public document into a private folder downgrades it to `unlisted`.
- Folder visibility changes cascade to nested folders/documents where required.

Version history:

- Stored in `document_versions`.
- A new version is created when title/content changes and more than 5 minutes passed since the last snapshot.
- Old versions are pruned according to `VERSION_RETENTION_DAYS`.
- Restoring a version overwrites the document title/content and removes newer versions for chronological consistency.

Backup/restore:

- `GET /api/documents/backup` creates backup format `2.0` as a ZIP with `metadata.json`, one Markdown file per document, and local image files for managed document images.
- Each document folder is based on the folder path plus `{sanitized-title}-{document_id}`. The Markdown file lives in that folder, and managed images live under that folder's `images/` directory.
- Markdown image URLs for managed storage objects are rewritten to local relative paths during export.
- `POST /api/documents/backup` restores profile, folders, documents, document versions, and backed-up image files.
- If backup metadata contains images, S3-compatible storage must be configured before restore. Restore uploads those WebP files to storage and rewrites Markdown back to the new public URLs.
- Restore invalidates affected document/user cache keys and runs image cleanup for restored documents.

## 8. Editor and Image Support

The editor is implemented in `src/components/Editor.tsx`.

Editor stack:

- TipTap `StarterKit`
- TipTap `Image`
- `tiptap-markdown`
- Public rendering through `markdown-it`
- Autosave debounce of 1.5 seconds
- Explicit save through `Ctrl+S` or `Cmd+S`

Image insertion:

- URL insertion is always available.
- Upload insertion appears only when `getImageUploadSettings()` reports storage enabled.
- Upload mode previews the selected file before upload.
- Users choose WebP quality and maximum output edge in the upload modal.
- Uploads are optimized client-side to WebP with `browser-image-compression`.
- Server accepts only authenticated multipart uploads with one WebP file.
- `src/pages/api/images/upload.ts` checks size, MIME type, and RIFF/WEBP magic bytes.
- Object keys are generated as `files/documents/{document_id}/{uuid}.webp`; original filenames are not preserved in storage.
- Objects are uploaded with `Content-Type: image/webp` and immutable cache-control.

Storage target selection:

- Node/self-host: S3-compatible API via `@aws-sdk/client-s3`.
- Development fallback: local file storage under `database/dev-image-storage` when `NODE_ENV=development` and S3 is not configured.

Development image route:

- Route: `GET /files/[...key]`.
- Active only when `DEV_IMAGE_STORAGE_ENABLED` resolves true and `NODE_ENV=development`.
- The route reconstructs object keys as `files/{key}` and serves only managed keys under `files/documents/`.
- In production, the same route returns 404.
- The local provider supports write/read/list/delete, so backup, restore, image cleanup, and document delete can be tested without S3 credentials.

Managed image lifecycle:

- Only URLs whose path contains `files/documents/{document_id}/` are treated as managed objects.
- On document update, the server compares old and new Markdown image references.
- A removed object is deleted from storage only when the current document and every retained version no longer reference that object key.
- On version restore, the restored content and remaining versions are treated as the source of truth, then unreferenced objects are deleted.
- On document delete, every object under `files/documents/{document_id}/` is deleted before the document row is removed.

Responsive rendering:

- Markdown image syntax is supported in `src/utils/markdown.ts`.
- Sanitization allows only safe image attributes.
- Global CSS constrains images with `max-width`, viewport-bounded `max-height`, centered layout, and `object-fit: contain`.

## 9. Markdown Rendering and Sanitization

`src/utils/markdown.ts` converts Markdown to HTML with `markdown-it` and sanitizes the rendered output with `isomorphic-dompurify`.

Supported image syntax:

- `![alt](https://example.com/image.webp)`
- `![alt](/relative/path.webp "optional title")`

The public renderer enables standard document Markdown behavior through `markdown-it`: headings `h1`-`h6`, paragraphs, blockquotes, thematic breaks, fenced and indented code blocks, inline code, emphasis, strong emphasis, ordered/unordered/nested lists, links, images, reference links, GFM-style tables, strikethrough, autolinks, and a local task-list extension.

Raw HTML is disabled in the Markdown parser. It is rendered as text, then the generated HTML is passed through the sanitizer. Allowed URL protocols are HTTP, HTTPS, `mailto:`, root-relative paths, and fragment links. Base64 images and arbitrary protocols are not allowed.

Public document routes render sanitized content only:

- `/[username]/documents/[id-or-customSlug]`
- `/shared/doc/[id]`, which redirects to the canonical public URL.

## 10. Document Read Cache

Cache helpers:

- `src/utils/cache.ts`
- `src/utils/documentCache.ts`

Provider behavior:

- If `REDIS_URL` exists, the official `redis` client is used.
- If Redis is blank, fails to connect, or errors at runtime, cache operations no-op and database reads continue.
- Redis failures set a short in-process cooldown before reconnect is attempted again, so a provider quota or transient outage does not block document reads.

Keys:

- `document:id:{id}`
- `user:username:{username}`
- `document:public:{userId}:{identifier}`

Invalidation occurs after:

- Document update/delete.
- Version restore.
- Folder visibility cascade/delete.
- Profile update.
- Backup restore.

The database is always the source of truth. Cache failures must not block reads or writes.

## 11. SPA and CDN Behavior

The workspace behaves as an Astro SSR app with React islands. To reduce CDN-caused SPA anomalies:

- Protected app/API responses set `Cache-Control: private, no-store, no-transform`.
- Protected app/API responses set `Vary: Cookie` so authenticated responses are not reused across users.
- All responses get `X-Content-Type-Options: nosniff`.
- Middleware applies baseline security headers.
- Cookie-authenticated mutation requests under protected/auth APIs must be same-origin when the browser sends `Origin` or cross-site fetch metadata.
- Production API `5xx` responses are normalized so internal exception messages are not exposed to clients.
- Astro-generated module scripts must still be served unmodified. If JavaScript rewriting or similar CDN optimizers are enabled, disable them for authenticated app routes and Astro asset routes.

## 12. API Surface

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/profile`
- `POST /api/auth/change-password`

Documents:

- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/[id]`
- `PUT /api/documents/[id]`
- `DELETE /api/documents/[id]`
- `GET /api/documents/[id]/versions`
- `POST /api/documents/[id]/versions`
- `POST /api/documents/import-markdown`
- `GET /api/documents/backup`
- `POST /api/documents/backup`

Folders:

- `GET /api/folders`
- `POST /api/folders`
- `PUT /api/folders/[id]`
- `DELETE /api/folders/[id]`

Images:

- `GET /api/images/config`
- `POST /api/images/upload`

## 13. Commands

```sh
bun install
bun run dev
bun run build
bun run preview
```

The production build runs Biome, Astro type checks, and Astro build.

## 14. Security Notes

- Do not deploy with the fallback `JWT_SECRET`.
- Keep S3 credentials server-only. The browser only receives upload capability status and maximum accepted size.
- Uploaded images are stored as WebP only.
- Public image URLs are assumed to be safe to expose because they are embedded into documents.
- Markdown HTML is sanitized before public rendering.
- Redis is treated as a performance cache only, never as durable state.

## 15. Operational Checklist

Before production:

- Set `JWT_SECRET`.
- Choose database mode and set `DATABASE_URL` if not using local SQLite.
- Set `REDIS_URL` only if document-read caching is needed.
- Configure all S3 variables if upload mode should be visible.
- Keep `DEV_IMAGE_STORAGE_ENABLED` blank or false in production. The local `/files/*` route intentionally returns 404 outside development.
- Run `bun run build`.
- Test register, login, document CRUD, public document read, image URL insert, and image upload if storage is configured.

## 16. License

The project is released under the MIT License.

Direct dependency license audit:

- Main runtime and UI dependencies are MIT, Apache-2.0, BSD-3-Clause, or similarly permissive.
- `jszip` is dual-licensed as `(MIT OR GPL-3.0-or-later)` and this project uses the MIT option.
- Transitive build/runtime packages include weak-copyleft or notice-bearing licenses such as MPL-2.0 and LGPL-3.0-or-later through tooling/binary packages. They do not require changing this project license, but redistribution should keep third-party notices intact.
