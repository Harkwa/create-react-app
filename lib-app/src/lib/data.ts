import "server-only";

import { getNowIso, getDb } from "@/lib/db";
import type {
  ActiveLoan,
  Borrower,
  BorrowerFormValue,
  BorrowerOption,
  DashboardData,
  MediaCheckoutOption,
  MediaFormValue,
  MediaListItem,
  UserListItem,
} from "@/lib/types";

export function getDashboardData(): DashboardData {
  const db = getDb();
  const now = getNowIso();

  const mediaCount =
    (
      db.prepare("SELECT COUNT(*) as count FROM media_items").get() as {
        count: number;
      }
    ).count ?? 0;
  const borrowerCount =
    (
      db.prepare("SELECT COUNT(*) as count FROM borrowers").get() as {
        count: number;
      }
    ).count ?? 0;
  const userCount =
    (
      db.prepare("SELECT COUNT(*) as count FROM users").get() as {
        count: number;
      }
    ).count ?? 0;
  const activeLoanCount =
    (
      db
        .prepare("SELECT COUNT(*) as count FROM loans WHERE checked_in_at IS NULL")
        .get() as { count: number }
    ).count ?? 0;
  const overdueLoanCount =
    (
      db
        .prepare(
          `
            SELECT COUNT(*) as count
            FROM loans
            WHERE checked_in_at IS NULL
              AND due_at IS NOT NULL
              AND due_at < ?
          `,
        )
        .get(now) as { count: number }
    ).count ?? 0;

  return {
    mediaCount,
    borrowerCount,
    userCount,
    activeLoanCount,
    overdueLoanCount,
  };
}

export function listMediaItems(): MediaListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          m.id,
          m.title,
          m.media_type,
          m.creator,
          m.publication_year,
          m.barcode,
          m.notes,
          m.total_copies,
          m.created_at,
          m.updated_at,
          m.total_copies - COALESCE(ol.open_count, 0) AS available_copies
        FROM media_items m
        LEFT JOIN (
          SELECT media_item_id, COUNT(*) AS open_count
          FROM loans
          WHERE checked_in_at IS NULL
          GROUP BY media_item_id
        ) ol ON ol.media_item_id = m.id
        ORDER BY m.title COLLATE NOCASE ASC
      `,
    )
    .all() as Array<{
    id: number;
    title: string;
    media_type: string;
    creator: string | null;
    publication_year: number | null;
    barcode: string | null;
    notes: string | null;
    total_copies: number;
    created_at: string;
    updated_at: string;
    available_copies: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mediaType: row.media_type,
    creator: row.creator,
    publicationYear: row.publication_year,
    barcode: row.barcode,
    notes: row.notes,
    totalCopies: row.total_copies,
    availableCopies: row.available_copies,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getMediaById(id: number): MediaFormValue | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id, title, media_type, creator, publication_year, barcode, notes, total_copies
        FROM media_items
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id) as
    | {
        id: number;
        title: string;
        media_type: string;
        creator: string | null;
        publication_year: number | null;
        barcode: string | null;
        notes: string | null;
        total_copies: number;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    mediaType: row.media_type,
    creator: row.creator ?? "",
    publicationYear: row.publication_year,
    barcode: row.barcode ?? "",
    notes: row.notes ?? "",
    totalCopies: row.total_copies,
  };
}

export function listBorrowers(): Borrower[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT id, name, email, phone, notes, created_at, updated_at
        FROM borrowers
        ORDER BY name COLLATE NOCASE ASC
      `,
    )
    .all() as Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getBorrowerById(id: number): BorrowerFormValue | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id, name, email, phone, notes
        FROM borrowers
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id) as
    | {
        id: number;
        name: string;
        email: string | null;
        phone: string | null;
        notes: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    notes: row.notes ?? "",
  };
}

export function listActiveLoans(): ActiveLoan[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          l.id,
          l.media_item_id,
          m.title AS media_title,
          m.barcode AS media_barcode,
          l.borrower_id,
          b.name AS borrower_name,
          l.checked_out_at,
          l.due_at,
          l.checked_in_at,
          l.notes
        FROM loans l
        INNER JOIN media_items m ON m.id = l.media_item_id
        INNER JOIN borrowers b ON b.id = l.borrower_id
        WHERE l.checked_in_at IS NULL
        ORDER BY l.checked_out_at ASC
      `,
    )
    .all() as Array<{
    id: number;
    media_item_id: number;
    media_title: string;
    media_barcode: string | null;
    borrower_id: number;
    borrower_name: string;
    checked_out_at: string;
    due_at: string | null;
    checked_in_at: string | null;
    notes: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    mediaId: row.media_item_id,
    mediaTitle: row.media_title,
    mediaBarcode: row.media_barcode,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    checkedOutAt: row.checked_out_at,
    dueAt: row.due_at,
    checkedInAt: row.checked_in_at,
    notes: row.notes,
  }));
}

export function listOverdueLoans(): ActiveLoan[] {
  const db = getDb();
  const now = getNowIso();
  const rows = db
    .prepare(
      `
        SELECT
          l.id,
          l.media_item_id,
          m.title AS media_title,
          m.barcode AS media_barcode,
          l.borrower_id,
          b.name AS borrower_name,
          l.checked_out_at,
          l.due_at,
          l.checked_in_at,
          l.notes
        FROM loans l
        INNER JOIN media_items m ON m.id = l.media_item_id
        INNER JOIN borrowers b ON b.id = l.borrower_id
        WHERE l.checked_in_at IS NULL
          AND l.due_at IS NOT NULL
          AND l.due_at < ?
        ORDER BY l.due_at ASC
      `,
    )
    .all(now) as Array<{
    id: number;
    media_item_id: number;
    media_title: string;
    media_barcode: string | null;
    borrower_id: number;
    borrower_name: string;
    checked_out_at: string;
    due_at: string | null;
    checked_in_at: string | null;
    notes: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    mediaId: row.media_item_id,
    mediaTitle: row.media_title,
    mediaBarcode: row.media_barcode,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    checkedOutAt: row.checked_out_at,
    dueAt: row.due_at,
    checkedInAt: row.checked_in_at,
    notes: row.notes,
  }));
}

export function listMediaCheckoutOptions(): MediaCheckoutOption[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          m.id,
          m.title,
          m.barcode,
          m.total_copies - COALESCE(ol.open_count, 0) AS available_copies
        FROM media_items m
        LEFT JOIN (
          SELECT media_item_id, COUNT(*) AS open_count
          FROM loans
          WHERE checked_in_at IS NULL
          GROUP BY media_item_id
        ) ol ON ol.media_item_id = m.id
        WHERE m.total_copies - COALESCE(ol.open_count, 0) > 0
        ORDER BY m.title COLLATE NOCASE ASC
      `,
    )
    .all() as Array<{
    id: number;
    title: string;
    barcode: string | null;
    available_copies: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    barcode: row.barcode,
    availableCopies: row.available_copies,
  }));
}

export function listBorrowerOptions(): BorrowerOption[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT id, name
        FROM borrowers
        ORDER BY name COLLATE NOCASE ASC
      `,
    )
    .all() as Array<{ id: number; name: string }>;

  return rows;
}

export function listUsers(): UserListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT id, name, email, is_admin, is_protected_admin, created_at, updated_at
        FROM users
        ORDER BY is_protected_admin DESC, name COLLATE NOCASE ASC
      `,
    )
    .all() as Array<{
    id: number;
    name: string;
    email: string;
    is_admin: number;
    is_protected_admin: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: row.is_admin === 1,
    isProtectedAdmin: row.is_protected_admin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
