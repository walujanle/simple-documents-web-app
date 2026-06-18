import { datetime, mysqlTable, text, tinyint, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: datetime('created_at').notNull(),
  website: varchar('website', { length: 255 }),
  facebook: varchar('facebook', { length: 255 }),
  instagram: varchar('instagram', { length: 255 }),
  twitter: varchar('twitter', { length: 255 }),
  linkedin: varchar('linkedin', { length: 255 }),
  mastodon: varchar('mastodon', { length: 255 }),
  bluesky: varchar('bluesky', { length: 255 }),
  isFeatured: tinyint('is_featured').default(0).notNull(),
  description: text('description'),
});

export const folders = mysqlTable('folders', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: varchar('parent_id', { length: 255 }),
  isPublic: tinyint('is_public').default(0).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const documents = mysqlTable('documents', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  folderId: varchar('folder_id', { length: 255 }).references(() => folders.id, {
    onDelete: 'set null',
  }),
  title: varchar('title', { length: 255 }).default('Untitled Document').notNull(),
  content: text('content').notNull(),
  isPublic: tinyint('is_public').default(0).notNull(),
  visibility: varchar('visibility', { length: 50 }).default('private').notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
  description: text('description'),
  tags: varchar('tags', { length: 255 }),
  customSlug: varchar('custom_slug', { length: 255 }),
});

export const documentVersions = mysqlTable('document_versions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  documentId: varchar('document_id', { length: 255 })
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdAt: datetime('created_at').notNull(),
});
