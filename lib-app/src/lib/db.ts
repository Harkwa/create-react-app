import "server-only";

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { list, put } from "@vercel/blob";
import Database from "better-sqlite3";

let database: Database.Database | null = null;
const SHARED_DB_BLOB_PATHNAME =
  process.env.SHARED_DB_BLOB_PATHNAME?.trim() || "lib-app/lib-app.sqlite";

function nowIso(): string {
  return new Date().toISOString();
}

function resolveDatabasePath(): string {
  if (process.env.SQLITE_DB_PATH?.trim()) {
    return process.env.SQLITE_DB_PATH.trim();
  }

  // Vercel serverless functions only allow writes in /tmp.
  if (process.env.VERCEL) {
    return "/tmp/lib-app.sqlite";
  }

  return path.join(process.cwd(), "data", "lib-app.sqlite");
}

function ensureDirectoryForFile(filePath: string): void {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function initializeSchema(db: Database.Database): { didMutate: boolean } {
  let didMutate = false;

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_protected_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hashed_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      media_type TEXT NOT NULL,
      creator TEXT,
      publication_year INTEGER,
      barcode TEXT UNIQUE,
      notes TEXT,
      total_copies INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS borrowers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL,
      borrower_id INTEGER NOT NULL,
      checked_out_at TEXT NOT NULL,
      due_at TEXT,
      checked_in_at TEXT,
      notes TEXT,
      FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE RESTRICT,
      FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_login_codes_user_created
      ON login_codes(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_sessions_token
      ON sessions(token);

    CREATE INDEX IF NOT EXISTS idx_loans_media_open
      ON loans(media_item_id, checked_in_at);

    CREATE INDEX IF NOT EXISTS idx_loans_borrower_open
      ON loans(borrower_id, checked_in_at);

    CREATE INDEX IF NOT EXISTS idx_media_items_barcode
      ON media_items(barcode);

    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
  `);

  const defaultAdminEmail = resolveDefaultAdminEmail();
  const defaultAdminName = (process.env.ADMIN_NAME ?? "Admin User").trim();
  const timestamp = nowIso();

  const protectedAdminRow = db
    .prepare("SELECT id FROM users WHERE is_protected_admin = 1 LIMIT 1")
    .get() as { id: number } | undefined;

  if (protectedAdminRow) {
    return { didMutate };
  }

  const matchingUser = db
    .prepare("SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1")
    .get(defaultAdminEmail) as { id: number } | undefined;

  if (matchingUser) {
    db.prepare(
      `
        UPDATE users
        SET is_admin = 1,
            is_protected_admin = 1,
            updated_at = ?
        WHERE id = ?
      `,
    ).run(timestamp, matchingUser.id);
    didMutate = true;
    return { didMutate };
  }

  db.prepare(
    `
      INSERT INTO users(name, email, is_admin, is_protected_admin, created_at, updated_at)
      VALUES (?, ?, 1, 1, ?, ?)
    `,
  ).run(defaultAdminName, defaultAdminEmail, timestamp, timestamp);
  didMutate = true;
  return { didMutate };
}

function resolveDefaultAdminEmail(): string {
  const explicitEmail =
    process.env.ADMIN_EMAIL ??
    process.env.DEFAULT_ADMIN_EMAIL ??
    process.env.GIT_AUTHOR_EMAIL ??
    process.env.GIT_COMMITTER_EMAIL;

  if (explicitEmail?.trim()) {
    return explicitEmail.trim().toLowerCase();
  }

  try {
    const gitEmail = execSync("git config --get user.email", {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    })
      .trim()
      .toLowerCase();

    if (gitEmail) {
      return gitEmail;
    }
  } catch {
    // Ignore and fall back to a safe default.
  }

  return "admin@example.com";
}

function isBlobBackedSharedDbEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function hydrateDbFromSharedBlob(dbPath: string): Promise<void> {
  if (!isBlobBackedSharedDbEnabled()) {
    return;
  }

  try {
    const listed = await list({
      prefix: SHARED_DB_BLOB_PATHNAME,
      limit: 10,
    });
    const blob = listed.blobs.find(
      (item) => item.pathname === SHARED_DB_BLOB_PATHNAME,
    );
    if (!blob) {
      return;
    }

    const response = await fetch(blob.url, {
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `[DB HYDRATE FAILED] Could not download shared DB blob (${response.status}).`,
      );
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(dbPath, Buffer.from(arrayBuffer));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[DB HYDRATE FAILED] ${error.message}`);
      return;
    }

    console.error("[DB HYDRATE FAILED] Unknown blob error");
  }
}

export async function persistDbToBlob(): Promise<void> {
  if (!isBlobBackedSharedDbEnabled()) {
    return;
  }

  const dbPath = resolveDatabasePath();
  if (!fs.existsSync(dbPath)) {
    return;
  }

  // Ensure all SQLite pages are flushed to disk before upload.
  if (database) {
    try {
      database.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // Ignore when WAL mode is not in use.
    }
    database.close();
    database = null;
  }

  const fileBuffer = fs.readFileSync(dbPath);
  await put(SHARED_DB_BLOB_PATHNAME, fileBuffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/x-sqlite3",
  });
}

export async function getDb(): Promise<Database.Database> {
  const dbPath = resolveDatabasePath();
  ensureDirectoryForFile(dbPath);

  if (isBlobBackedSharedDbEnabled()) {
    if (database) {
      database.close();
      database = null;
    }

    await hydrateDbFromSharedBlob(dbPath);
  }

  if (database) {
    return database;
  }

  database = new Database(dbPath);
  const schemaResult = initializeSchema(database);
  if (schemaResult.didMutate) {
    await persistDbToBlob();
    database = new Database(dbPath);
  }

  return database;
}

export function getNowIso(): string {
  return nowIso();
}
