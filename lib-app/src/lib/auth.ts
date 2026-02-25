import "server-only";

import crypto from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb, getNowIso } from "@/lib/db";
import { sendLoginCodeEmail } from "@/lib/email";
import type { SessionUser } from "@/lib/types";

const SESSION_COOKIE_NAME = "lib_app_session";
const LOGIN_CODE_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 7;
const ALLOW_PLAINTEXT_CODE_FALLBACK =
  process.env.ALLOW_PLAINTEXT_LOGIN_CODE_FALLBACK !== "false";

type UserRow = {
  id: number;
  name: string;
  email: string;
  is_admin: number;
  is_protected_admin: number;
};

type SessionLookupRow = UserRow & {
  expires_at: string;
};

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: row.is_admin === 1,
    isProtectedAdmin: row.is_protected_admin === 1,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateFiveDigitCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT u.id, u.name, u.email, u.is_admin, u.is_protected_admin, s.expires_at
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        LIMIT 1
      `,
    )
    .get(sessionToken) as SessionLookupRow | undefined;

  if (!row) {
    return null;
  }

  const now = getNowIso();
  if (row.expires_at <= now) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(sessionToken);
    return null;
  }

  return toSessionUser(row);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireProtectedAdminUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isProtectedAdmin) {
    const params = new URLSearchParams({
      type: "error",
      message: "Only the protected admin user can manage users.",
    });
    redirect(`/?${params.toString()}`);
  }
  return user;
}

export async function requestLoginCode(
  rawEmail: string,
): Promise<{ success: boolean; message: string; suggestedEmail?: string }> {
  const email = normalizeEmail(rawEmail);

  if (!email.includes("@")) {
    return { success: false, message: "Enter a valid email address." };
  }

  const db = getDb();
  const user = db
    .prepare(
      `
        SELECT id, name, email, is_admin, is_protected_admin
        FROM users
        WHERE lower(email) = lower(?)
        LIMIT 1
      `,
    )
    .get(email) as UserRow | undefined;

  // Keep lookup response generic.
  if (!user) {
    return {
      success: true,
      message:
        "If an account exists for that email, a 5-digit code has been sent.",
      suggestedEmail: email,
    };
  }

  const code = generateFiveDigitCode();
  const now = getNowIso();
  const expiresAt = new Date(
    Date.now() + LOGIN_CODE_TTL_MINUTES * 60_000,
  ).toISOString();

  db.prepare(
    `
      INSERT INTO login_codes(user_id, hashed_code, expires_at, consumed_at, created_at)
      VALUES (?, ?, ?, NULL, ?)
    `,
  ).run(user.id, hashCode(code), expiresAt, now);

  const emailResult = await sendLoginCodeEmail({
    to: user.email,
    userName: user.name,
    code,
  });

  const message = !emailResult.delivered
    ? ALLOW_PLAINTEXT_CODE_FALLBACK
      ? `${emailResult.reason} One-time code: ${code}`
      : "Login email could not be sent. Ask your admin to configure SMTP."
    : emailResult.reason;

  return {
    success: true,
    message,
    suggestedEmail: user.email,
  };
}

export async function verifyLoginCodeAndCreateSession(
  rawEmail: string,
  rawCode: string,
): Promise<{ success: boolean; message: string }> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();

  if (!email.includes("@")) {
    return { success: false, message: "Enter a valid email address." };
  }

  if (!/^\d{5}$/.test(code)) {
    return { success: false, message: "Code must be exactly 5 digits." };
  }

  const db = getDb();
  const user = db
    .prepare(
      `
        SELECT id, name, email, is_admin, is_protected_admin
        FROM users
        WHERE lower(email) = lower(?)
        LIMIT 1
      `,
    )
    .get(email) as UserRow | undefined;

  if (!user) {
    return { success: false, message: "Invalid email or code." };
  }

  const now = getNowIso();
  const latestCode = db
    .prepare(
      `
        SELECT id, hashed_code, expires_at
        FROM login_codes
        WHERE user_id = ?
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .get(user.id) as { id: number; hashed_code: string; expires_at: string } | undefined;

  if (!latestCode) {
    return { success: false, message: "No active code found for this email." };
  }

  if (latestCode.expires_at <= now) {
    db.prepare("UPDATE login_codes SET consumed_at = ? WHERE id = ?").run(
      now,
      latestCode.id,
    );
    return { success: false, message: "Code expired. Request a new code." };
  }

  if (latestCode.hashed_code !== hashCode(code)) {
    return { success: false, message: "Invalid email or code." };
  }

  db.prepare("UPDATE login_codes SET consumed_at = ? WHERE id = ?").run(
    now,
    latestCode.id,
  );

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60_000,
  ).toISOString();

  db.prepare(
    `
      INSERT INTO sessions(user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
  ).run(user.id, sessionToken, sessionExpiresAt, now);

  // Best-effort cleanup of stale sessions.
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(sessionExpiresAt),
  });

  return { success: true, message: "Signed in successfully." };
}

export async function logoutCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE token = ?").run(sessionToken);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
