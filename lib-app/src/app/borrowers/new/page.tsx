import Link from "next/link";

import { createBorrowerAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

export default async function NewBorrowerPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const status = await readStatusMessage(searchParams);

  return (
    <AppShell
      user={user}
      title="Add borrower"
      subtitle="Create a borrower account for checkouts"
    >
      <section className="stack">
        <div className="row--space">
          <StatusBanner type={status.type} message={status.message} />
          <Link className="button button--secondary" href="/borrowers">
            Back to borrowers
          </Link>
        </div>

        <form action={createBorrowerAction} className="stack">
          <div className="form-grid">
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" />
            </div>
            <div className="field--full">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" />
            </div>
          </div>

          <div className="row">
            <button className="button" type="submit">
              Create borrower
            </button>
            <Link className="button button--secondary" href="/borrowers">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
