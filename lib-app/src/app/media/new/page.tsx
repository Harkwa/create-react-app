import Link from "next/link";

import { createMediaItemAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

export default async function NewMediaPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const status = await readStatusMessage(searchParams);

  return (
    <AppShell
      user={user}
      title="Add media item"
      subtitle="Capture barcode, metadata, and inventory count"
    >
      <section className="stack">
        <div className="row--space">
          <StatusBanner type={status.type} message={status.message} />
          <Link className="button button--secondary" href="/media">
            Back to media list
          </Link>
        </div>

        <form action={createMediaItemAction} className="stack">
          <div className="form-grid">
            <div>
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required />
            </div>
            <div>
              <label htmlFor="mediaType">Media type</label>
              <input
                id="mediaType"
                name="mediaType"
                placeholder="Book, DVD, Blu-ray, Game..."
                required
              />
            </div>
            <div>
              <label htmlFor="creator">Creator / Author</label>
              <input id="creator" name="creator" />
            </div>
            <div>
              <label htmlFor="publicationYear">Publication year</label>
              <input id="publicationYear" name="publicationYear" type="number" min="0" />
            </div>
            <div>
              <label htmlFor="totalCopies">Total copies</label>
              <input
                id="totalCopies"
                name="totalCopies"
                type="number"
                min="1"
                defaultValue="1"
                required
              />
            </div>
            <div className="field--full">
              <label htmlFor="media-barcode">Barcode</label>
              <input id="media-barcode" name="barcode" />
              <BarcodeScanner targetInputId="media-barcode" />
            </div>
            <div className="field--full">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" />
            </div>
          </div>

          <div className="row">
            <button className="button" type="submit">
              Create media item
            </button>
            <Link className="button button--secondary" href="/media">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
