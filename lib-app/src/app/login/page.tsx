import Link from "next/link";
import { redirect } from "next/navigation";

import { requestLoginCodeAction } from "@/app/actions";
import { StatusBanner } from "@/components/status-banner";
import { getCurrentUser } from "@/lib/auth";
import { readStatusAndEmail, type AppSearchParams } from "@/lib/page-helpers";

export default async function LoginPage({
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
        <h1>Sign in</h1>
        <p className="text-muted">
          Passwords are disabled. Enter your email and we will send a 5-digit
          login code.
        </p>

        <div className="stack">
          <StatusBanner type={type} message={message} />

          <form action={requestLoginCodeAction} className="stack--sm">
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
            <button className="button" type="submit">
              Send 5-digit code
            </button>
          </form>

          <p className="text-muted">
            Already have a code? <Link href="/login/verify">Verify code</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
