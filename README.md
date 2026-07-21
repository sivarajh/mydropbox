# 📦 myDropbox

A Dropbox-style file storage app — **upload, folders, accounts, and share links** —
that runs entirely on **free** infrastructure:

- **Frontend:** React + Vite, a fully static site hosted on **GitHub Pages**
- **Deploy:** **GitHub Actions** builds and publishes on every push to `main`
- **Backend:** **Supabase** free tier — Auth, Postgres, and Storage (no server code to run)

Because GitHub Pages can only serve static files, all the "backend" work
(authentication, the file database, and blob storage) is handled by Supabase
directly from the browser. Each user's data is isolated by Postgres
**Row-Level Security**, so files stay private per account.

## Features

- ✅ Email/password **sign up & sign in**
- ✅ **Upload / download / delete** files (drag-and-drop or picker, multi-file)
- ✅ **Folders** with nesting, breadcrumbs, rename, and recursive delete
- ✅ **Share links** — public, token-based, expiring download links
- ✅ Per-user isolation enforced in the database, not just the UI

---

## One-time setup (~5 minutes)

You only need a free Supabase account. No credit card, no server to run.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project (free tier).
2. Wait for it to finish provisioning.

### 2. Create the database + storage

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   This creates the tables, security policies, and the private `files` storage bucket.

### 3. Grab your API credentials

In the dashboard: **Project Settings → API**, copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

> These are public, browser-safe values. Your data is protected by the
> Row-Level Security policies from step 2 — never use the `service_role` key here.

### 4. (Optional) Turn off email confirmation for easy testing

**Authentication → Sign In / Providers → Email**: disable "Confirm email" if you
want accounts to work instantly without an inbox round-trip.

---

## Run locally

```bash
npm install
cp .env.example .env      # then paste your two values into .env
npm run dev
```

Open the printed `http://localhost:5173/mydropbox/` URL.

---

## Deploy to GitHub Pages (free, automatic)

1. **Add repo secrets** — GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Enable Pages** — **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Merge to `main`.** The [deploy workflow](.github/workflows/deploy.yml) builds
   the app and publishes it. Your site goes live at:

   ```
   https://<your-username>.github.io/mydropbox/
   ```

> The workflow triggers on pushes to `main`. This project is developed on a
> feature branch — open a PR and merge it (or push to `main`) to trigger the
> first deploy. You can also run it manually from the **Actions** tab
> (**Deploy to GitHub Pages → Run workflow**).

### Add your deployed URL to Supabase

So auth redirects behave, add your Pages URL under
**Authentication → URL Configuration → Site URL / Redirect URLs**:
`https://<your-username>.github.io/mydropbox/`

---

## How it works

| Concern | Implementation |
|---------|----------------|
| Auth | `supabase.auth` (email/password), session tracked in `AuthContext` |
| File blobs | Supabase Storage, private `files` bucket, paths namespaced by user id |
| Metadata | `folders` and `files` Postgres tables, filtered by `auth.uid()` via RLS |
| Downloads | Short-lived **signed URLs** generated on demand for the owner |
| Sharing | Owner pre-generates a 30-day signed URL, stored in a public `shares` row keyed by an unguessable token; the `/share/:token` page serves it — no server needed |
| SPA routing on Pages | `404.html` stashes the deep link and bounces to `index.html`, which restores it |

### Project layout

```
src/
  lib/supabase.js   Supabase client + bucket name
  lib/api.js        All data operations (folders, files, shares)
  lib/format.js     Byte + icon helpers
  context/          Auth provider
  pages/            Login, Dashboard, SharedFile, NotConfigured
  components/       Breadcrumbs, ShareModal
supabase/schema.sql Database + storage setup (run once)
.github/workflows/  GitHub Pages deploy
```

## Notes & limits (free-tier reality)

- Free Supabase Storage is **1 GB**, database **500 MB** — plenty for a demo.
- Share links use a pre-signed URL valid for 30 days. Deleting the share row
  hides the link in the app, but the underlying signed URL remains technically
  valid until it expires — fine for an MVP, worth hardening (via a Supabase Edge
  Function that mints URLs on demand) for real production use.
- Uploads go directly from the browser to Supabase; there is no virus scanning
  or file-type restriction out of the box.
