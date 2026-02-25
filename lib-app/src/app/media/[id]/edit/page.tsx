import Link from "next/link";
import { notFound } from "next/navigation";

import { updateMediaItemAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { getMediaById } from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

export default async function EditMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const routeParams = await params;
  const mediaId = Number.parseInt(routeParams.id, 10);

  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    notFound();
  }

  const media = await getMediaById(mediaId);
  if (!media) {
    notFound();
  }

  const status = await readStatusMessage(searchParams);

  return (
    <AppShell
      user={user}
      title={`Edit media item #${media.id}`}
      subtitle="Update metadata and inventory"
    >
      <section className="stack">
        <div className="row--space">
          <StatusBanner type={status.type} message={status.message} />
          <Link className="button button--secondary" href="/media">
            Back to media list
          </Link>
        </div>

        <form action={updateMediaItemAction.bind(null, media.id)} className="stack">
          <div className="form-grid">
            <div>
              <label htmlFor="title">Title</label>
              <input id="title" name="title" defaultValue={media.title} required />
            </div>
            <div>
              <label htmlFor="mediaType">Media type</label>
              <input id="mediaType" name="mediaType" defaultValue={media.mediaType} required />
            </div>
            <div>
              <label htmlFor="creator">Creator / Author</label>
              <input id="creator" name="creator" defaultValue={media.creator} />
            </div>
            <div>
              <label htmlFor="publicationYear">Publication year</label>
              <input
                id="publicationYear"
                name="publicationYear"
                type="number"
                min="0"
                defaultValue={media.publicationYear ?? ""}
              />
            </div>
            <div>
              <label htmlFor="totalCopies">Total copies</label>
              <input
                id="totalCopies"
                name="totalCopies"
                type="number"
                min="1"
                defaultValue={media.totalCopies}
                required
              />
            </div>
            <div className="field--full">
              <label htmlFor="media-barcode">Barcode</label>
              <input id="media-barcode" name="barcode" defaultValue={media.barcode} />
              <BarcodeScanner targetInputId="media-barcode" />
            </div>
            <div className="field--full">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" defaultValue={media.notes} />
            </div>
          </div>

          <div className="row">
            <button className="button" type="submit">
              Save changes
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
