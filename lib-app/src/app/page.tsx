import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { getDashboardData, listActiveLoans, listOverdueLoans } from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

function safeDate(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default async function Home({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const status = await readStatusMessage(searchParams);
  const stats = getDashboardData();
  const activeLoans = listActiveLoans();
  const overdueLoans = listOverdueLoans();

  return (
    <AppShell
      user={user}
      title="Library Dashboard"
      subtitle="Overview of media, borrowers, users, and active lending"
    >
      <section className="stack">
        <StatusBanner type={status.type} message={status.message} />

        <div className="cards">
          <article className="card">
            <h3>Media items</h3>
            <p>{stats.mediaCount}</p>
          </article>
          <article className="card">
            <h3>Borrowers</h3>
            <p>{stats.borrowerCount}</p>
          </article>
          <article className="card">
            <h3>Users</h3>
            <p>{stats.userCount}</p>
          </article>
          <article className="card">
            <h3>Active loans</h3>
            <p>{stats.activeLoanCount}</p>
          </article>
          <article className="card">
            <h3>Overdue loans</h3>
            <p>{stats.overdueLoanCount}</p>
          </article>
        </div>

        <div className="row">
          <Link className="button" href="/media/new">
            Add media item
          </Link>
          <Link className="button button--secondary" href="/borrowers/new">
            Add borrower
          </Link>
          <Link className="button button--secondary" href="/checkout">
            Check out item
          </Link>
          <Link className="button button--secondary" href="/checkin">
            Check in item
          </Link>
        </div>

        <section className="stack--sm">
          <h2>Currently checked out</h2>
          {activeLoans.length === 0 ? (
            <p className="text-muted">No items are currently checked out.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Media</th>
                  <th>Borrower</th>
                  <th>Checked out</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.slice(0, 10).map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.mediaTitle}</td>
                    <td>{loan.borrowerName}</td>
                    <td>{safeDate(loan.checkedOutAt)}</td>
                    <td>{safeDate(loan.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="stack--sm">
          <h2>Overdue items</h2>
          {overdueLoans.length === 0 ? (
            <p className="text-muted">No overdue items.</p>
          ) : (
            <ul>
              {overdueLoans.slice(0, 10).map((loan) => (
                <li key={loan.id}>
                  <strong>{loan.mediaTitle}</strong> checked out to{" "}
                  {loan.borrowerName}, due {safeDate(loan.dueAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </AppShell>
  );
}
