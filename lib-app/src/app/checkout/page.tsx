import Link from "next/link";

import { checkoutItemAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import {
  listActiveLoans,
  listBorrowerOptions,
  listMediaCheckoutOptions,
} from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const status = await readStatusMessage(searchParams);
  const mediaOptions = await listMediaCheckoutOptions();
  const borrowers = await listBorrowerOptions();
  const activeLoans = await listActiveLoans();

  return (
    <AppShell
      user={user}
      title="Check out items"
      subtitle="Assign media to borrowers with barcode support"
    >
      <section className="stack">
        <StatusBanner type={status.type} message={status.message} />

        {borrowers.length === 0 ? (
          <p className="text-error">
            Add at least one borrower before checking out items.
          </p>
        ) : null}
        {mediaOptions.length === 0 ? (
          <p className="text-error">
            Add media inventory (or check in items) before checking out.
          </p>
        ) : null}

        <form action={checkoutItemAction} className="stack">
          <div className="form-grid">
            <div className="field--full">
              <label htmlFor="checkout-barcode">
                Barcode (optional if selecting item below)
              </label>
              <input
                id="checkout-barcode"
                name="barcode"
                placeholder="Scan or enter barcode"
              />
              <BarcodeScanner targetInputId="checkout-barcode" />
            </div>

            <div>
              <label htmlFor="mediaId">Media item (optional if barcode used)</label>
              <select id="mediaId" name="mediaId" defaultValue="">
                <option value="">Choose media item</option>
                {mediaOptions.map((media) => (
                  <option key={media.id} value={media.id}>
                    {media.title} ({media.availableCopies} available
                    {media.barcode ? ` • ${media.barcode}` : ""})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="borrowerId">Borrower</label>
              <select id="borrowerId" name="borrowerId" defaultValue="" required>
                <option value="">Choose borrower</option>
                {borrowers.map((borrower) => (
                  <option key={borrower.id} value={borrower.id}>
                    {borrower.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dueAt">Due date (optional)</label>
              <input id="dueAt" name="dueAt" type="date" />
            </div>

            <div className="field--full">
              <label htmlFor="notes">Checkout notes (optional)</label>
              <textarea id="notes" name="notes" />
            </div>
          </div>

          <div className="row">
            <button className="button" type="submit">
              Check out item
            </button>
            <Link className="button button--secondary" href="/checkin">
              Go to check in
            </Link>
          </div>
        </form>

        <section className="stack--sm">
          <h2>Active loans</h2>
          {activeLoans.length === 0 ? (
            <p className="text-muted">No active loans.</p>
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
                {activeLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.mediaTitle}</td>
                    <td>{loan.borrowerName}</td>
                    <td>{formatDateTime(loan.checkedOutAt)}</td>
                    <td>{formatDateTime(loan.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </section>
    </AppShell>
  );
}
