import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions";
import type { SessionUser } from "@/lib/types";

type AppShellProps = {
  user: SessionUser;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppShell({ user, title, subtitle, children }: AppShellProps) {
  return (
    <div className="shell">
      <header className="shell__header">
        <div>
          <h1 className="shell__title">{title}</h1>
          {subtitle ? <p className="shell__subtitle">{subtitle}</p> : null}
        </div>
        <div className="shell__user">
          <span>
            Signed in as <strong>{user.name}</strong> ({user.email})
          </span>
          <form action={logoutAction}>
            <button className="button button--secondary" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>

      <nav className="shell__nav">
        <Link href="/">Dashboard</Link>
        <Link href="/media">Media</Link>
        <Link href="/borrowers">Borrowers</Link>
        <Link href="/checkout">Check Out</Link>
        <Link href="/checkin">Check In</Link>
        {user.isProtectedAdmin ? <Link href="/users">Users</Link> : null}
      </nav>

      <main className="shell__content">{children}</main>
    </div>
  );
}
