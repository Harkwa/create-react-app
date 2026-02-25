# Library Media Catalog App

React/Next.js library/media catalog app with:

- Barcode scanning
- Local SQLite data storage
- CRUD for media items and borrowers
- Checkout and checkin workflows
- Dashboard home page
- User maintenance page
- Passwordless login by 5-digit email code
- Protected admin user rules

## Features implemented

### Catalog + lending

- **Media items**: add/edit/delete, barcode, metadata, copy counts
- **Borrowers**: add/edit/delete with contact details
- **Checkout**: assign item to borrower by selection or barcode
- **Checkin**: return by barcode or active-loan row action
- **Dashboard**: totals and overdue highlights

### Users + access control

- Users are maintained in `/users`
- Only the **protected admin user** can add/modify/delete users
- The protected admin user **cannot be deleted**
- No passwords are used

### Passwordless login

- User enters email at `/login`
- App generates a **5-digit code**
- Code is emailed via SMTP configuration
- User verifies code at `/login/verify`
- Session is stored in an HTTP-only cookie

If SMTP is not configured, in development the code is printed in server logs and shown in the success message for easier local testing.

## Default admin email

On first database initialization, the app seeds a protected admin user.

Default admin email resolution order:

1. `ADMIN_EMAIL` env var
2. `DEFAULT_ADMIN_EMAIL` env var
3. `git config user.email` value (if available)
4. fallback: `admin@example.com`

Set `ADMIN_EMAIL` to your own email before first run for best results.

## Environment variables

Copy `.env.example` to `.env.local` and update values:

```bash
cp .env.example .env.local
```

Important variables:

- `ADMIN_EMAIL` - seeded protected admin email
- `ADMIN_NAME` - seeded protected admin name
- `SQLITE_DB_PATH` - optional custom SQLite file path
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and run

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Create a Vercel project linked to this folder/repo.
2. Add the environment variables listed above in Vercel project settings.
3. Deploy:

```bash
npx vercel --prod
```

### Important SQLite note on Vercel

This app uses a local SQLite file. On Vercel serverless, local filesystem writes are ephemeral and not durable across deployments/instances.

- For production durability, consider a managed external database.
- Current implementation still works functionally with local SQLite semantics, but data persistence is limited by platform runtime behavior.
