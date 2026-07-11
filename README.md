# Simple Documents Web App

Personal and multi-user document workspace built with Astro SSR, React islands, TipTap, Drizzle ORM, Bun, and optional Redis plus S3-compatible image storage.

## What It Does

- Create, edit, organize, import, export, and share Markdown-backed documents.
- Authenticate users with username/password, `bcryptjs`, HTTP-only JWT sessions, and Astro middleware guards.
- Store data in SQLite by default, or PostgreSQL/MySQL when `DATABASE_URL` is set.
- Render public documents with safe Markdown, SEO metadata, custom slugs, and public/unlisted/private visibility.
- Add images either by URL or, when storage is configured, by previewing and uploading optimized WebP images to S3-compatible object storage.
- Cache document reads through standard Redis when `REDIS_URL` is set. If Redis is empty or unavailable, reads fall back to the database.

## Stack

- Runtime/package manager: Bun
- Framework: Astro 6, server output, `@astrojs/node` standalone adapter
- UI/Markdown: React 19, Tailwind CSS 4, TipTap 3, `tiptap-markdown`, `markdown-it`
- Database: Drizzle ORM with SQLite, PostgreSQL, or MySQL/MariaDB
- Auth: `bcryptjs` password hashing plus native Web Crypto JWT signing
- Images: `@tiptap/extension-image`, `browser-image-compression`, `@aws-sdk/client-s3`
- Cache: official `redis` client, no Upstash-specific API
- SEO: runtime sitemap.xml, robots.txt, canonical URLs via `APP_BASE_URL`
- Sanitization: markdown-it `validateLink` at parse level (Edge-safe, no DOM dependency)

## Quick Start

```sh
bun install
cp .env.example .env
bun run dev
```

Production build:

```sh
bun test
bun run build
bun run preview
```

`bun run build` runs Biome check, unit tests (`bun test`), Astro check, then the production build. Current unit-test baseline is 11 tests under `tests/`.

## Required Environment

Required in production:

- `JWT_SECRET`: secret for HTTP-only session JWT signing. Generate a strong value, for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Optional:

- `ALLOW_REGISTRATION`: leave blank or `true` to allow sign-up; set `false` to reject `POST /api/auth/register`.
- `DATABASE_URL`: blank uses `./database/sqlite.db`; supports PostgreSQL and MySQL/MariaDB URLs.
- `REDIS_URL`: standard `redis://` or `rediss://` URL for document-read caching.
- `DOCUMENT_CACHE_TTL_SECONDS`: cache TTL, default `120`.
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`: enable image upload mode.
- `S3_FORCE_PATH_STYLE`: defaults to true for broad S3-compatible provider support.
- `IMAGE_UPLOAD_MAX_BYTES`: maximum server-accepted optimized WebP size, default 2 MiB.
- `MARKDOWN_IMPORT_MAX_BYTES`: maximum Markdown import size, default 5 MiB.
- `BACKUP_RESTORE_MAX_BYTES`: maximum backup ZIP restore size, default 50 MiB.
- `DEV_IMAGE_STORAGE_ENABLED`: development-only local image storage switch. Defaults to enabled only when `NODE_ENV=development`.
- `DEV_IMAGE_STORAGE_DIR`: development-only upload directory, default `database/dev-image-storage`.
- `DEV_IMAGE_PUBLIC_BASE_URL`: optional development public base URL. Blank returns same-origin `/files/...` URLs.
- `APP_NAME`, `APP_DESCRIPTION`, `APP_COVER_IMAGE`, `APP_LOGO`, `APP_ICON`, `VERSION_RETENTION_DAYS`: app metadata, public cover image path, and version history retention. The default cover image lives at `public/cover/cover-placeholder.png`.
- `APP_BASE_URL`: public canonical base URL for sitemaps, robots.txt, canonical links, and OpenGraph/Twitter meta tags. Defaults to `http://localhost:4321`. Set to your production origin (e.g. `https://docs.example.com`) in production.

Fallback values live in `src/utils/config.ts` and `src/utils/serverConfig.ts`, not in `.env.example`.

## Image Upload Behavior

The editor always supports inserting external image URLs. Upload mode appears when S3-compatible storage is configured, or when the development-only local image storage provider is active.

Client flow:

1. User chooses an image and previews it before upload.
2. User selects WebP quality and maximum output edge in the upload modal.
3. `browser-image-compression` converts/resizes it to WebP in the browser.
4. The browser posts the WebP file to `/api/images/upload`.
5. The server verifies authentication, file size, MIME type, and WebP magic bytes.
6. The server writes the object to S3-compatible storage with immutable cache headers and returns the public URL.

Managed uploads use this public object shape:

```text
{S3_PUBLIC_BASE_URL}/files/documents/{document_id}/{uuid}.webp
```

Original filenames are never preserved in storage object names. The original filename may be used only as a default alt-text hint in the editor.

The server only treats URLs under `files/documents/{document_id}/` as managed images. When an image is removed from the current document, storage cleanup deletes it only if the current document and all retained document versions no longer reference the same object key. Deleting a document deletes every object under its document image prefix.

In development, when S3 is not configured, the same upload API uses a local dev-only provider. Files are written under `database/dev-image-storage/files/documents/...` and served through `/files/documents/...`. The `/files/*` route returns 404 outside development mode.

Public and editor rendering use responsive CSS with `max-width: 100%`, bounded viewport height, centered display, and `object-fit: contain` so portrait and landscape images do not stretch awkwardly.

## Backup and Restore Images

`GET /api/documents/backup` exports backup format `2.0`. Each document gets its own folder containing a Markdown file and, when needed, an `images/` directory. Managed Markdown image URLs are rewritten to relative paths such as `images/example.webp`, so the Markdown file can display its local images after extraction.

`POST /api/documents/backup` restores documents, versions, and backed-up image files. If a backup contains images, S3-compatible storage must be configured; the restore uploads those WebP files to storage, rewrites Markdown back to the new public URLs, and then removes any unreferenced objects for the restored documents.

## Markdown Behavior

Public document rendering uses `markdown-it` with raw HTML disabled, linkify enabled, and a small local task-list extension. Link safety is enforced at parse time through `validateLink`, which allows only HTTP, HTTPS, `mailto:`, root-relative paths, and fragment links.

Supported public rendering includes CommonMark-style headings, paragraphs, blockquotes, thematic breaks, fenced and indented code blocks, inline code, emphasis, strong emphasis, ordered/unordered/nested lists, links, images, reference links, GFM-style tables, strikethrough, autolinks, and task lists.

Raw HTML in Markdown is intentionally not rendered. It is treated as text to keep public document rendering safe and predictable. External links are rendered with `target="_blank"` and `rel="noopener noreferrer"`. Images are rendered with `loading="lazy"` and `decoding="async"`.

## SEO

Runtime routes generate SEO assets without a build step:

- `/sitemap.xml`: XML sitemap listing the homepage, public user profiles, and all public documents with last modification dates.
- `/robots.txt`: allows public pages, disallows `/documents`, `/documents/`, and `/api/`, and advertises `/sitemap.xml`.
- Canonical URLs, OpenGraph, and Twitter Card meta tags use `APP_BASE_URL` so links remain correct behind reverse proxies or CDNs.

Set `APP_BASE_URL` to your production origin in production deployments.

## Cache Behavior

Read caching is implemented in `src/utils/cache.ts` and `src/utils/documentCache.ts`.

Cached reads:

- Document by ID: `document:id:{id}`
- User by username: `user:username:{username}`
- Public document by user and identifier: `document:public:{userId}:{id-or-customSlug}`

Invalidation runs after document updates, deletes, version restores, folder visibility cascades, profile updates, and backup restores. Redis errors are swallowed deliberately so the database remains the source of truth.

When Redis fails, reaches a provider limit, or refuses a request, cache access is disabled for a short cooldown and reads continue from the database. After the cooldown, the app tries Redis again without requiring a restart.

## SPA and CDN Notes

Protected app/API responses set `Cache-Control: private, no-store, no-transform` and `Vary: Cookie` to reduce CDN mutation and stale authenticated responses. Middleware also sets baseline security headers (including Content-Security-Policy), and same-origin mutation checks for cookie-authenticated API requests. Astro-generated module scripts must still be served unmodified; disable JavaScript rewriting for app routes if enabled at the CDN level.


## Navigation / prefetch (locked)

View transitions use Astro `ClientRouter`, but **automatic link prefetch is disabled** (`prefetch: false` in `astro.config.mjs`). Do not re-enable it — concurrent hover prefetch caused production **503** under load. See `AGENTS.md` and run `bun run check:no-prefetch` before changing navigation.

## Documentation

Full architecture and operational documentation lives in:

```text
docs/PROJECT_DOCUMENTATION.md
```

Keep that document in sync when changing auth, database, cache, storage, public document rendering, or deployment behavior.

## License

This project is released under the MIT License. See [LICENSE](LICENSE).

Third-party dependencies keep their own licenses. The current direct dependency set is compatible with MIT distribution; `jszip` is used through its MIT license option.
