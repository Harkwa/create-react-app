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

type SessionPayload = {
  uid: number;
  name: string;
  email: string;
  isAdmin: boolean;
  isProtectedAdmin: boolean;
  expiresAt: string;
};

function getSessionSecret(): string {
  const explicitSecret = process.env.SESSION_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "lib-app-insecure-default-session-secret";

  return fallbackSecret;
}

function createSessionToken(payload: SessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function parseSessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");

  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      typeof parsed.uid !== "number" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.isAdmin !== "boolean" ||
      typeof parsed.isProtectedAdmin !== "boolean" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
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

  const payload = parseSessionToken(sessionToken);
  if (!payload) {
    return null;
  }

  const now = getNowIso();
  if (payload.expiresAt <= now) {
    return null;
  }

  return {
    id: payload.uid,
    name: payload.name,
    email: payload.email,
    isAdmin: payload.isAdmin,
    isProtectedAdmin: payload.isProtectedAdmin,
  };
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

  const sessionExpiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60_000,
  ).toISOString();

  const sessionToken = createSessionToken({
    uid: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.is_admin === 1,
    isProtectedAdmin: user.is_protected_admin === 1,
    expiresAt: sessionExpiresAt,
  });

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
  cookieStore.delete(SESSION_COOKIE_NAME);
}
