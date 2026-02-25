import { checkinByBarcodeAction, checkinLoanAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { listActiveLoans } from "@/lib/data";
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

export default async function CheckinPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const status = await readStatusMessage(searchParams);
  const activeLoans = await listActiveLoans();

  return (
    <AppShell
      user={user}
      title="Check in items"
      subtitle="Return borrowed media by barcode or loan record"
    >
      <section className="stack">
        <StatusBanner type={status.type} message={status.message} />

        <form action={checkinByBarcodeAction} className="stack--sm">
          <div>
            <label htmlFor="checkin-barcode">Check in by barcode</label>
            <input
              id="checkin-barcode"
              name="barcode"
              placeholder="Scan or enter barcode to check in"
              required
            />
            <BarcodeScanner targetInputId="checkin-barcode" />
          </div>
          <button className="button" type="submit">
            Check in by barcode
          </button>
        </form>

        <section className="stack--sm">
          <h2>Active loans</h2>
          {activeLoans.length === 0 ? (
            <p className="text-muted">No active loans to check in.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Media</th>
                  <th>Barcode</th>
                  <th>Borrower</th>
                  <th>Checked out</th>
                  <th>Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.mediaTitle}</td>
                    <td>{loan.mediaBarcode ?? "—"}</td>
                    <td>{loan.borrowerName}</td>
                    <td>{formatDateTime(loan.checkedOutAt)}</td>
                    <td>{formatDateTime(loan.dueAt)}</td>
                    <td>
                      <form action={checkinLoanAction.bind(null, loan.id)}>
                        <button className="button button--secondary" type="submit">
                          Check in
                        </button>
                      </form>
                    </td>
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
