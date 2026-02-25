import Link from "next/link";

import { deleteBorrowerAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { listBorrowers } from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

export default async function BorrowersPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const borrowers = listBorrowers();
  const status = await readStatusMessage(searchParams);

  return (
    <AppShell
      user={user}
      title="Borrowers"
      subtitle="Maintain borrower records for lending"
    >
      <section className="stack">
        <div className="row--space">
          <StatusBanner type={status.type} message={status.message} />
          <Link className="button" href="/borrowers/new">
            Add borrower
          </Link>
        </div>

        {borrowers.length === 0 ? (
          <p className="text-muted">
            No borrowers added yet. Add at least one borrower to enable
            checkout.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {borrowers.map((borrower) => (
                <tr key={borrower.id}>
                  <td>{borrower.name}</td>
                  <td>{borrower.email ?? "—"}</td>
                  <td>{borrower.phone ?? "—"}</td>
                  <td>{formatDate(borrower.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="button button--secondary"
                        href={`/borrowers/${borrower.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={deleteBorrowerAction.bind(null, borrower.id)}>
                        <button className="button button--danger" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
