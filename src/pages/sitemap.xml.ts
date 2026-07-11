export const prerender = false;

import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { absoluteAppUrl, getAppBaseUrl } from '@/utils/url';

type SitemapEntry = {
  loc: string;
  lastmod?: Date | string | null;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
};

type PublicSitemapDocument = {
  id: string;
  customSlug: string | null;
  updatedAt: Date | string | null;
  username: string;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const renderUrl = (entry: SitemapEntry): string => {
  const lastmod = formatDate(entry.lastmod);
  return [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
    entry.priority ? `    <priority>${entry.priority}</priority>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
};

export const GET: APIRoute = async () => {
  const origin = getAppBaseUrl();
  const { db, users, documents } = await getDB();

  const publicDocs = (await db
    .select({
      id: documents.id,
      customSlug: documents.customSlug,
      updatedAt: documents.updatedAt,
      username: users.username,
    })
    .from(documents)
    .innerJoin(users, eq(documents.userId, users.id))
    .where(eq(documents.visibility, 'public'))
    .orderBy(desc(documents.updatedAt))) as PublicSitemapDocument[];

  const latestProfileUpdates = new Map<string, Date | string | null>();
  for (const doc of publicDocs) {
    if (!latestProfileUpdates.has(doc.username)) {
      latestProfileUpdates.set(doc.username, doc.updatedAt);
    }
  }

  const entries: SitemapEntry[] = [
    {
      loc: `${origin}/`,
      changefreq: 'daily',
      priority: '1.0',
    },
    ...Array.from(latestProfileUpdates.entries()).map(([username, lastmod]) => ({
      loc: absoluteAppUrl(`/${encodeURIComponent(username)}`),
      lastmod,
      changefreq: 'weekly' as const,
      priority: '0.8',
    })),
    ...publicDocs.map((doc) => ({
      loc: absoluteAppUrl(
        `/${encodeURIComponent(doc.username)}/documents/${encodeURIComponent(doc.customSlug || doc.id)}`,
      ),
      lastmod: doc.updatedAt,
      changefreq: 'weekly' as const,
      priority: '0.7',
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(renderUrl)
    .join('\n')}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
