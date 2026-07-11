import * as mysqlSchema from '@/db/schema/mysql';
import * as pgSchema from '@/db/schema/pg';
import * as sqliteSchema from '@/db/schema/sqlite';
import { config } from '@/utils/config';

let initialized = false;
let initPromise: Promise<void> | null = null;
let dbInstance: any = null;
let activeUsers: any = null;
let activeFolders: any = null;
let activeDocuments: any = null;
let activeDocumentVersions: any = null;
let activeDialect: 'sqlite' | 'pg' | 'mysql' = 'sqlite';

async function runInit(client: any, dialect: 'sqlite' | 'pg' | 'mysql') {
  if (dialect === 'sqlite') {
    client.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at INTEGER NOT NULL,
        website TEXT,
        facebook TEXT,
        instagram TEXT,
        twitter TEXT,
        linkedin TEXT,
        mastodon TEXT,
        bluesky TEXT,
        is_featured INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT,
        is_public INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        folder_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 0,
        visibility TEXT NOT NULL DEFAULT 'private',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        description TEXT,
        tags TEXT,
        custom_slug TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
    `);
    try {
      client.exec('ALTER TABLE users ADD COLUMN name TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN website TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN facebook TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN instagram TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN twitter TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN linkedin TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN mastodon TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN bluesky TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE users ADD COLUMN description TEXT;');
    } catch (e) {}

    try {
      client.exec('ALTER TABLE folders ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;');
    } catch (e) {}
    try {
      client.exec(
        'ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;',
      );
    } catch (e) {}
    try {
      client.exec("ALTER TABLE documents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';");
    } catch (e) {}
    try {
      client.exec('ALTER TABLE documents ADD COLUMN description TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE documents ADD COLUMN tags TEXT;');
    } catch (e) {}
    try {
      client.exec('ALTER TABLE documents ADD COLUMN custom_slug TEXT;');
    } catch (e) {}
    try {
      client.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_slug ON documents(user_id, custom_slug);',
      );
    } catch (e) {}
    try {
      client.exec("UPDATE documents SET visibility = 'public' WHERE is_public = 1;");
    } catch (e) {}
  } else if (dialect === 'pg') {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        website TEXT,
        facebook TEXT,
        instagram TEXT,
        twitter TEXT,
        linkedin TEXT,
        mastodon TEXT,
        bluesky TEXT,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        visibility TEXT NOT NULL DEFAULT 'private',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        description TEXT,
        tags TEXT,
        custom_slug TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
    `);
    try {
      await client.query('ALTER TABLE users ADD COLUMN name TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN website TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN facebook TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN instagram TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN twitter TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN linkedin TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN mastodon TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN bluesky TEXT;');
    } catch (e) {}
    try {
      await client.query(
        'ALTER TABLE users ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE;',
      );
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN description TEXT;');
    } catch (e) {}

    try {
      await client.query(
        'ALTER TABLE folders ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;',
      );
    } catch (e) {}
    try {
      await client.query(
        'ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;',
      );
    } catch (e) {}
    try {
      await client.query(
        "ALTER TABLE documents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';",
      );
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN description TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN tags TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN custom_slug TEXT;');
    } catch (e) {}
    try {
      await client.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_slug ON documents(user_id, custom_slug);',
      );
    } catch (e) {}
    try {
      await client.query("UPDATE documents SET visibility = 'public' WHERE is_public = TRUE;");
    } catch (e) {}
  } else if (dialect === 'mysql') {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at DATETIME NOT NULL,
        website VARCHAR(255),
        facebook VARCHAR(255),
        instagram VARCHAR(255),
        twitter VARCHAR(255),
        linkedin VARCHAR(255),
        mastodon VARCHAR(255),
        bluesky VARCHAR(255),
        is_featured TINYINT(1) NOT NULL DEFAULT 0
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id VARCHAR(255),
        is_public TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        folder_id VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        is_public TINYINT(1) NOT NULL DEFAULT 0,
        visibility VARCHAR(50) NOT NULL DEFAULT 'private',
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        description TEXT,
        tags VARCHAR(255),
        custom_slug VARCHAR(255),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id VARCHAR(255) PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
    `);
    try {
      await client.query(
        'CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);',
      );
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN name VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN website VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN facebook VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN instagram VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN twitter VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN linkedin VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN mastodon VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN bluesky VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE users ADD COLUMN description TEXT;');
    } catch (e) {}

    try {
      await client.query('ALTER TABLE folders ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN folder_id VARCHAR(255);');
      await client.query(
        'ALTER TABLE documents ADD FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;',
      );
    } catch (e) {}
    try {
      await client.query(
        "ALTER TABLE documents ADD COLUMN visibility VARCHAR(50) NOT NULL DEFAULT 'private';",
      );
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN description TEXT;');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN tags VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD COLUMN custom_slug VARCHAR(255);');
    } catch (e) {}
    try {
      await client.query(
        'ALTER TABLE documents ADD UNIQUE INDEX idx_documents_user_slug (user_id, custom_slug);',
      );
    } catch (e) {}
    try {
      await client.query("UPDATE documents SET visibility = 'public' WHERE is_public = 1;");
    } catch (e) {}
    try {
      await client.query('ALTER TABLE documents ADD INDEX idx_documents_user_id (user_id);');
    } catch (e) {}
    try {
      await client.query('ALTER TABLE folders ADD INDEX idx_folders_user_id (user_id);');
    } catch (e) {}
  }
}

async function initializeDB() {
  const url = config.databaseUrl;
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url });
    await client.connect();
    await runInit(client, 'pg');
    dbInstance = drizzle(client, { schema: pgSchema });
    activeUsers = pgSchema.users;
    activeFolders = pgSchema.folders;
    activeDocuments = pgSchema.documents;
    activeDocumentVersions = pgSchema.documentVersions;
    activeDialect = 'pg';
  } else if (url.startsWith('mysql://')) {
    const { drizzle } = await import('drizzle-orm/mysql2');
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection(url);
    await runInit(connection, 'mysql');
    dbInstance = drizzle(connection, { schema: mysqlSchema, mode: 'default' });
    activeUsers = mysqlSchema.users;
    activeFolders = mysqlSchema.folders;
    activeDocuments = mysqlSchema.documents;
    activeDocumentVersions = mysqlSchema.documentVersions;
    activeDialect = 'mysql';
  } else {
    // Default SQLite
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const fs = await import('fs');

    const dbDir = path.resolve(process.cwd(), 'database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'sqlite.db');
    const sqliteClient = new Database(dbPath);
    await runInit(sqliteClient, 'sqlite');
    dbInstance = drizzle(sqliteClient, { schema: sqliteSchema });
    activeUsers = sqliteSchema.users;
    activeFolders = sqliteSchema.folders;
    activeDocuments = sqliteSchema.documents;
    activeDocumentVersions = sqliteSchema.documentVersions;
    activeDialect = 'sqlite';
  }
  initialized = true;
}

export async function getDB() {
  if (!initialized) {
    if (!initPromise) {
      initPromise = initializeDB().finally(() => {
        initPromise = null;
      });
    }
    await initPromise;
  }
  return {
    db: dbInstance,
    users: activeUsers,
    folders: activeFolders,
    documents: activeDocuments,
    documentVersions: activeDocumentVersions,
    dialect: activeDialect,
  };
}
