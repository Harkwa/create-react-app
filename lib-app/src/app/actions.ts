"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  logoutCurrentSession,
  requestLoginCode,
  requireProtectedAdminUser,
  requireUser,
  verifyLoginCodeAndCreateSession,
} from "@/lib/auth";
import { getDb, getNowIso, persistDbToBlob } from "@/lib/db";

function textField(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function checkboxField(formData: FormData, field: string): boolean {
  return formData.get(field) === "on";
}

function toNullable(value: string): string | null {
  return value.length > 0 ? value : null;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
  extraParams: Record<string, string | undefined> = {},
): never {
  const params = new URLSearchParams({
    type,
    message,
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  redirect(`${path}?${params.toString()}`);
}

function parsePublicationYear(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
    throw new Error("Publication year must be a valid year.");
  }

  return parsed;
}

function parseDueDate(value: string): string | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Due date must be in YYYY-MM-DD format.");
  }

  const dueAt = new Date(`${value}T23:59:59.000Z`);
  if (Number.isNaN(dueAt.getTime())) {
    throw new Error("Due date is invalid.");
  }

  return dueAt.toISOString();
}

function extractDbErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return "That value must be unique and already exists.";
    }
    return error.message || fallback;
  }
  return fallback;
}

const mediaSchema = z.object({
  title: z.string().min(1, "Title is required."),
  mediaType: z.string().min(1, "Media type is required."),
  creator: z.string(),
  publicationYear: z.string(),
  barcode: z.string(),
  notes: z.string(),
  totalCopies: z.coerce
    .number()
    .int("Total copies must be an integer.")
    .min(1, "Total copies must be at least 1."),
});

const borrowerSchema = z.object({
  name: z.string().min(1, "Borrower name is required."),
  email: z.string(),
  phone: z.string(),
  notes: z.string(),
});

const userSchema = z.object({
  name: z.string().min(1, "User name is required."),
  email: z.string().email("Email must be valid."),
  isAdmin: z.boolean(),
});

export async function requestLoginCodeAction(formData: FormData) {
  const email = textField(formData, "email");
  const result = await requestLoginCode(email);

  if (!result.success) {
    redirectWithMessage("/login", "error", result.message, {
      email,
    });
  }

  redirectWithMessage("/login/verify", "success", result.message, {
    email: result.suggestedEmail ?? email,
  });
}

export async function verifyLoginCodeAction(formData: FormData) {
  const email = textField(formData, "email");
  const code = textField(formData, "code");
  const result = await verifyLoginCodeAndCreateSession(email, code);

  if (!result.success) {
    redirectWithMessage("/login/verify", "error", result.message, {
      email,
    });
  }

  redirectWithMessage("/", "success", "Logged in successfully.");
}

export async function logoutAction() {
  await logoutCurrentSession();
  redirect("/login");
}

export async function createMediaItemAction(formData: FormData) {
  await requireUser();
  const parsed = mediaSchema.safeParse({
    title: textField(formData, "title"),
    mediaType: textField(formData, "mediaType"),
    creator: textField(formData, "creator"),
    publicationYear: textField(formData, "publicationYear"),
    barcode: textField(formData, "barcode"),
    notes: textField(formData, "notes"),
    totalCopies: textField(formData, "totalCopies"),
  });

  if (!parsed.success) {
    redirectWithMessage("/media/new", "error", parsed.error.issues[0].message);
  }

  try {
    const db = await getDb();
    const timestamp = getNowIso();
    const publicationYear = parsePublicationYear(parsed.data.publicationYear);

    db.prepare(
      `
        INSERT INTO media_items(
          title,
          media_type,
          creator,
          publication_year,
          barcode,
          notes,
          total_copies,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      parsed.data.title,
      parsed.data.mediaType,
      toNullable(parsed.data.creator),
      publicationYear,
      toNullable(parsed.data.barcode),
      toNullable(parsed.data.notes),
      parsed.data.totalCopies,
      timestamp,
      timestamp,
    );
    await persistDbToBlob();
  } catch (error) {
    redirectWithMessage(
      "/media/new",
      "error",
      extractDbErrorMessage(error, "Failed to create media item."),
    );
  }

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/checkout");
  redirectWithMessage("/media", "success", "Media item created.");
}

export async function updateMediaItemAction(mediaId: number, formData: FormData) {
  await requireUser();
  const parsed = mediaSchema.safeParse({
    title: textField(formData, "title"),
    mediaType: textField(formData, "mediaType"),
    creator: textField(formData, "creator"),
    publicationYear: textField(formData, "publicationYear"),
    barcode: textField(formData, "barcode"),
    notes: textField(formData, "notes"),
    totalCopies: textField(formData, "totalCopies"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      `/media/${mediaId}/edit`,
      "error",
      parsed.error.issues[0].message,
    );
  }

  try {
    const db = await getDb();
    const timestamp = getNowIso();
    const publicationYear = parsePublicationYear(parsed.data.publicationYear);

    const openLoanCount =
      (
        db
          .prepare(
            `
              SELECT COUNT(*) AS count
              FROM loans
              WHERE media_item_id = ? AND checked_in_at IS NULL
            `,
          )
          .get(mediaId) as { count: number }
      ).count ?? 0;

    if (parsed.data.totalCopies < openLoanCount) {
      redirectWithMessage(
        `/media/${mediaId}/edit`,
        "error",
        "Total copies cannot be less than active checkouts.",
      );
    }

    const result = db
      .prepare(
        `
          UPDATE media_items
          SET title = ?,
              media_type = ?,
              creator = ?,
              publication_year = ?,
              barcode = ?,
              notes = ?,
              total_copies = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        parsed.data.title,
        parsed.data.mediaType,
        toNullable(parsed.data.creator),
        publicationYear,
        toNullable(parsed.data.barcode),
        toNullable(parsed.data.notes),
        parsed.data.totalCopies,
        timestamp,
        mediaId,
      );

    if (result.changes === 0) {
      redirectWithMessage("/media", "error", "Media item not found.");
    }
    await persistDbToBlob();
  } catch (error) {
    redirectWithMessage(
      `/media/${mediaId}/edit`,
      "error",
      extractDbErrorMessage(error, "Failed to update media item."),
    );
  }

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/checkout");
  redirectWithMessage("/media", "success", "Media item updated.");
}

export async function deleteMediaItemAction(mediaId: number) {
  await requireUser();

  const db = await getDb();
  const openLoanCount =
    (
      db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM loans
            WHERE media_item_id = ? AND checked_in_at IS NULL
          `,
        )
        .get(mediaId) as { count: number }
    ).count ?? 0;

  if (openLoanCount > 0) {
    redirectWithMessage(
      "/media",
      "error",
      "Cannot delete a media item with active checkouts.",
    );
  }

  const result = db.prepare("DELETE FROM media_items WHERE id = ?").run(mediaId);
  if (result.changes === 0) {
    redirectWithMessage("/media", "error", "Media item not found.");
  }
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/checkout");
  redirectWithMessage("/media", "success", "Media item deleted.");
}

export async function createBorrowerAction(formData: FormData) {
  await requireUser();
  const parsed = borrowerSchema.safeParse({
    name: textField(formData, "name"),
    email: textField(formData, "email"),
    phone: textField(formData, "phone"),
    notes: textField(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/borrowers/new",
      "error",
      parsed.error.issues[0].message,
    );
  }

  try {
    const db = await getDb();
    const timestamp = getNowIso();
    db.prepare(
      `
        INSERT INTO borrowers(name, email, phone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(
      parsed.data.name,
      toNullable(parsed.data.email),
      toNullable(parsed.data.phone),
      toNullable(parsed.data.notes),
      timestamp,
      timestamp,
    );
    await persistDbToBlob();
  } catch (error) {
    redirectWithMessage(
      "/borrowers/new",
      "error",
      extractDbErrorMessage(error, "Failed to create borrower."),
    );
  }

  revalidatePath("/");
  revalidatePath("/borrowers");
  revalidatePath("/checkout");
  redirectWithMessage("/borrowers", "success", "Borrower created.");
}

export async function updateBorrowerAction(borrowerId: number, formData: FormData) {
  await requireUser();
  const parsed = borrowerSchema.safeParse({
    name: textField(formData, "name"),
    email: textField(formData, "email"),
    phone: textField(formData, "phone"),
    notes: textField(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      `/borrowers/${borrowerId}/edit`,
      "error",
      parsed.error.issues[0].message,
    );
  }

  const db = await getDb();
  const timestamp = getNowIso();
  const result = db
    .prepare(
      `
        UPDATE borrowers
        SET name = ?, email = ?, phone = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(
      parsed.data.name,
      toNullable(parsed.data.email),
      toNullable(parsed.data.phone),
      toNullable(parsed.data.notes),
      timestamp,
      borrowerId,
    );

  if (result.changes === 0) {
    redirectWithMessage("/borrowers", "error", "Borrower not found.");
  }
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/borrowers");
  revalidatePath("/checkout");
  redirectWithMessage("/borrowers", "success", "Borrower updated.");
}

export async function deleteBorrowerAction(borrowerId: number) {
  await requireUser();

  const db = await getDb();
  const openLoanCount =
    (
      db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM loans
            WHERE borrower_id = ? AND checked_in_at IS NULL
          `,
        )
        .get(borrowerId) as { count: number }
    ).count ?? 0;

  if (openLoanCount > 0) {
    redirectWithMessage(
      "/borrowers",
      "error",
      "Cannot delete a borrower with active checkouts.",
    );
  }

  const result = db.prepare("DELETE FROM borrowers WHERE id = ?").run(borrowerId);
  if (result.changes === 0) {
    redirectWithMessage("/borrowers", "error", "Borrower not found.");
  }
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/borrowers");
  revalidatePath("/checkout");
  redirectWithMessage("/borrowers", "success", "Borrower deleted.");
}

export async function checkoutItemAction(formData: FormData) {
  await requireUser();

  const borrowerId = Number.parseInt(textField(formData, "borrowerId"), 10);
  const selectedMediaId = Number.parseInt(textField(formData, "mediaId"), 10);
  const barcode = textField(formData, "barcode");
  const dueAt = textField(formData, "dueAt");
  const notes = textField(formData, "notes");

  if (!Number.isInteger(borrowerId) || borrowerId <= 0) {
    redirectWithMessage("/checkout", "error", "Select a valid borrower.");
  }

  if ((!Number.isInteger(selectedMediaId) || selectedMediaId <= 0) && !barcode) {
    redirectWithMessage(
      "/checkout",
      "error",
      "Choose a media item or scan/enter a barcode.",
    );
  }

  const db = await getDb();
  const borrower = db
    .prepare("SELECT id FROM borrowers WHERE id = ?")
    .get(borrowerId) as { id: number } | undefined;
  if (!borrower) {
    redirectWithMessage("/checkout", "error", "Borrower not found.");
  }

  const media =
    Number.isInteger(selectedMediaId) && selectedMediaId > 0
      ? (db
          .prepare("SELECT id, title FROM media_items WHERE id = ?")
          .get(selectedMediaId) as { id: number; title: string } | undefined)
      : (db
          .prepare("SELECT id, title FROM media_items WHERE barcode = ?")
          .get(barcode) as { id: number; title: string } | undefined);

  if (!media) {
    redirectWithMessage("/checkout", "error", "Media item not found.");
  }

  const availability =
    (
      db
        .prepare(
          `
            SELECT
              m.total_copies - COALESCE(ol.open_count, 0) AS available_copies
            FROM media_items m
            LEFT JOIN (
              SELECT media_item_id, COUNT(*) AS open_count
              FROM loans
              WHERE checked_in_at IS NULL
              GROUP BY media_item_id
            ) ol ON ol.media_item_id = m.id
            WHERE m.id = ?
            LIMIT 1
          `,
        )
        .get(media.id) as { available_copies: number } | undefined
    )?.available_copies ?? 0;

  if (availability <= 0) {
    redirectWithMessage("/checkout", "error", "No available copies to check out.");
  }

  let dueAtIso: string | null = null;
  try {
    dueAtIso = parseDueDate(dueAt);
  } catch (error) {
    redirectWithMessage(
      "/checkout",
      "error",
      extractDbErrorMessage(error, "Invalid due date."),
    );
  }

  const now = getNowIso();
  db.prepare(
    `
      INSERT INTO loans(
        media_item_id,
        borrower_id,
        checked_out_at,
        due_at,
        checked_in_at,
        notes
      )
      VALUES (?, ?, ?, ?, NULL, ?)
    `,
  ).run(media.id, borrowerId, now, dueAtIso, toNullable(notes));
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/checkout");
  revalidatePath("/checkin");
  redirectWithMessage("/checkout", "success", "Item checked out.");
}

export async function checkinLoanAction(loanId: number) {
  await requireUser();

  const db = await getDb();
  const now = getNowIso();
  const result = db
    .prepare(
      `
        UPDATE loans
        SET checked_in_at = ?
        WHERE id = ?
          AND checked_in_at IS NULL
      `,
    )
    .run(now, loanId);

  if (result.changes === 0) {
    redirectWithMessage("/checkin", "error", "Loan not found or already checked in.");
  }
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/checkout");
  revalidatePath("/checkin");
  redirectWithMessage("/checkin", "success", "Item checked in.");
}

export async function checkinByBarcodeAction(formData: FormData) {
  await requireUser();

  const barcode = textField(formData, "barcode");
  if (!barcode) {
    redirectWithMessage("/checkin", "error", "Enter or scan a barcode.");
  }

  const db = await getDb();
  const loan = db
    .prepare(
      `
        SELECT l.id
        FROM loans l
        INNER JOIN media_items m ON m.id = l.media_item_id
        WHERE l.checked_in_at IS NULL
          AND m.barcode = ?
        ORDER BY l.checked_out_at ASC
        LIMIT 1
      `,
    )
    .get(barcode) as { id: number } | undefined;

  if (!loan) {
    redirectWithMessage(
      "/checkin",
      "error",
      "No active loan was found for that barcode.",
    );
  }

  const now = getNowIso();
  db.prepare(
    `
      UPDATE loans
      SET checked_in_at = ?
      WHERE id = ?
    `,
  ).run(now, loan.id);
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/media");
  revalidatePath("/checkout");
  revalidatePath("/checkin");
  redirectWithMessage("/checkin", "success", "Item checked in by barcode.");
}

export async function createUserAction(formData: FormData) {
  await requireProtectedAdminUser();
  const parsed = userSchema.safeParse({
    name: textField(formData, "name"),
    email: textField(formData, "email").toLowerCase(),
    isAdmin: checkboxField(formData, "isAdmin"),
  });

  if (!parsed.success) {
    redirectWithMessage("/users", "error", parsed.error.issues[0].message);
  }

  try {
    const db = await getDb();
    const timestamp = getNowIso();
    db.prepare(
      `
        INSERT INTO users(name, email, is_admin, is_protected_admin, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `,
    ).run(
      parsed.data.name,
      parsed.data.email,
      parsed.data.isAdmin ? 1 : 0,
      timestamp,
      timestamp,
    );
    await persistDbToBlob();
  } catch (error) {
    redirectWithMessage(
      "/users",
      "error",
      extractDbErrorMessage(error, "Failed to create user."),
    );
  }

  revalidatePath("/");
  revalidatePath("/users");
  redirectWithMessage("/users", "success", "User created.");
}

export async function updateUserAction(userId: number, formData: FormData) {
  await requireProtectedAdminUser();
  const parsed = userSchema.safeParse({
    name: textField(formData, "name"),
    email: textField(formData, "email").toLowerCase(),
    isAdmin: checkboxField(formData, "isAdmin"),
  });

  if (!parsed.success) {
    redirectWithMessage("/users", "error", parsed.error.issues[0].message);
  }

  const db = await getDb();
  const user = db
    .prepare(
      `
        SELECT id, is_protected_admin
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(userId) as { id: number; is_protected_admin: number } | undefined;

  if (!user) {
    redirectWithMessage("/users", "error", "User not found.");
  }

  const timestamp = getNowIso();
  const isProtectedAdmin = user.is_protected_admin === 1;

  try {
    db.prepare(
      `
        UPDATE users
        SET name = ?,
            email = ?,
            is_admin = ?,
            updated_at = ?
        WHERE id = ?
      `,
    ).run(
      parsed.data.name,
      parsed.data.email,
      isProtectedAdmin ? 1 : parsed.data.isAdmin ? 1 : 0,
      timestamp,
      userId,
    );
    await persistDbToBlob();
  } catch (error) {
    redirectWithMessage(
      "/users",
      "error",
      extractDbErrorMessage(error, "Failed to update user."),
    );
  }

  revalidatePath("/");
  revalidatePath("/users");
  redirectWithMessage("/users", "success", "User updated.");
}

export async function deleteUserAction(userId: number) {
  await requireProtectedAdminUser();

  const db = await getDb();
  const user = db
    .prepare(
      `
        SELECT id, is_protected_admin
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(userId) as { id: number; is_protected_admin: number } | undefined;

  if (!user) {
    redirectWithMessage("/users", "error", "User not found.");
  }

  if (user.is_protected_admin === 1) {
    redirectWithMessage("/users", "error", "The protected admin user cannot be deleted.");
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  await persistDbToBlob();

  revalidatePath("/");
  revalidatePath("/users");
  redirectWithMessage("/users", "success", "User deleted.");
}
