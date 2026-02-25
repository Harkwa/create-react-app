import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/data";
import { readStatusMessage, type AppSearchParams } from "@/lib/page-helpers";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await requireUser();
  const status = await readStatusMessage(searchParams);
  const users = await listUsers();

  return (
    <AppShell
      user={user}
      title="Users"
      subtitle="Admin-only maintenance for application users"
    >
      <section className="stack">
        <StatusBanner type={status.type} message={status.message} />

        {!user.isProtectedAdmin ? (
          <p className="text-error">
            Only the protected admin user can add, modify, or delete users.
          </p>
        ) : (
          <>
            <section className="stack--sm">
              <h2>Add user</h2>
              <form action={createUserAction} className="form-grid">
                <div>
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" required />
                </div>
                <div>
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required />
                </div>
                <div>
                  <label htmlFor="isAdmin">Admin role</label>
                  <input id="isAdmin" name="isAdmin" type="checkbox" />
                </div>
                <div className="field--full">
                  <button className="button" type="submit">
                    Create user
                  </button>
                </div>
              </form>
            </section>

            <section className="stack--sm">
              <h2>Existing users</h2>
              {users.length === 0 ? (
                <p className="text-muted">No users found.</p>
              ) : (
                users.map((entry) => (
                  <article className="card" key={entry.id}>
                    <div className="stack--sm">
                      <form
                        action={updateUserAction.bind(null, entry.id)}
                        className="form-grid"
                      >
                        <div>
                          <label htmlFor={`user-name-${entry.id}`}>Name</label>
                          <input
                            id={`user-name-${entry.id}`}
                            name="name"
                            defaultValue={entry.name}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor={`user-email-${entry.id}`}>Email</label>
                          <input
                            id={`user-email-${entry.id}`}
                            name="email"
                            type="email"
                            defaultValue={entry.email}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor={`user-admin-${entry.id}`}>Admin role</label>
                          <input
                            id={`user-admin-${entry.id}`}
                            name="isAdmin"
                            type="checkbox"
                            defaultChecked={entry.isAdmin}
                            disabled={entry.isProtectedAdmin}
                          />
                        </div>
                        <div className="field--full row">
                          <button className="button button--secondary" type="submit">
                            Save user
                          </button>
                          {entry.isProtectedAdmin ? (
                            <span className="text-muted">
                              Protected admin (cannot be deleted)
                            </span>
                          ) : null}
                        </div>
                      </form>

                      <form action={deleteUserAction.bind(null, entry.id)}>
                        <button
                          className="button button--danger"
                          type="submit"
                          disabled={entry.isProtectedAdmin}
                          title={
                            entry.isProtectedAdmin
                              ? "Protected admin cannot be deleted."
                              : "Delete this user"
                          }
                        >
                          Delete user
                        </button>
                      </form>
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </section>
    </AppShell>
  );
}
