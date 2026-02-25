import Link from "next/link";

import { deleteMediaItemAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { listMediaItems } from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const mediaItems = listMediaItems();
  const status = await readStatusMessage(searchParams);

  return (
    <AppShell
      user={user}
      title="Media catalog"
      subtitle="Add, edit, delete, and track inventory by barcode"
    >
      <section className="stack">
        <div className="row--space">
          <StatusBanner type={status.type} message={status.message} />
          <Link className="button" href="/media/new">
            Add media item
          </Link>
        </div>

        {mediaItems.length === 0 ? (
          <p className="text-muted">
            No media items have been added yet. Use &quot;Add media item&quot;
            to start building your catalog.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Creator</th>
                <th>Year</th>
                <th>Barcode</th>
                <th>Availability</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mediaItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.mediaType}</td>
                  <td>{item.creator ?? "—"}</td>
                  <td>{item.publicationYear ?? "—"}</td>
                  <td>{item.barcode ?? "—"}</td>
                  <td>
                    {item.availableCopies} / {item.totalCopies}
                  </td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link className="button button--secondary" href={`/media/${item.id}/edit`}>
                        Edit
                      </Link>
                      <form action={deleteMediaItemAction.bind(null, item.id)}>
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
