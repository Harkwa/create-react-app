import Link from "next/link";
import { notFound } from "next/navigation";

import { updateBorrowerAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { getBorrowerById } from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

export default async function EditBorrowerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const routeParams = await params;
  const borrowerId = Number.parseInt(routeParams.id, 10);

  if (!Number.isInteger(borrowerId) || borrowerId <= 0) {
    notFound();
  }

  const borrower = getBorrowerById(borrowerId);
  if (!borrower) {
    notFound();
  }

  const status = await readStatusMessage(searchParams);

  return (
    <AppShell
      user={user}
      title={`Edit borrower #${borrower.id}`}
      subtitle="Update borrower profile details"
    >
      <section className="stack">
        <div className="row--space">
          <StatusBanner type={status.type} message={status.message} />
          <Link className="button button--secondary" href="/borrowers">
            Back to borrowers
          </Link>
        </div>

        <form action={updateBorrowerAction.bind(null, borrower.id)} className="stack">
          <div className="form-grid">
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" defaultValue={borrower.name} required />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" defaultValue={borrower.email} />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" defaultValue={borrower.phone} />
            </div>
            <div className="field--full">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" defaultValue={borrower.notes} />
            </div>
          </div>

          <div className="row">
            <button className="button" type="submit">
              Save changes
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
