import Link from "next/link";
import { redirect } from "next/navigation";

import { verifyLoginCodeAction } from "@/app/actions";
import { StatusBanner } from "@/components/status-banner";
import { getCurrentUser } from "@/lib/auth";
import { readStatusAndEmail, type AppSearchParams } from "@/lib/page-helpers";

export default async function VerifyLoginCodePage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const { type, message, email } = await readStatusAndEmail(searchParams);

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>Verify login code</h1>
        <p className="text-muted">
          Enter the 5-digit code sent to your email address.
        </p>

        <div className="stack">
          <StatusBanner type={type} message={message} />

          <form action={verifyLoginCodeAction} className="stack--sm">
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={email ?? ""}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label htmlFor="code">5-digit code</label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}"
                placeholder="12345"
                required
              />
            </div>
            <button className="button" type="submit">
              Sign in
            </button>
          </form>

          <p className="text-muted">
            Need a new code? <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
