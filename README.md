# 📦 myDropbox

A Dropbox-style file storage app — **upload, folders, accounts, and share links** —
that runs entirely on **free** infrastructure:

- **Frontend:** React + Vite, a fully static site hosted on **GitHub Pages**
- **Deploy:** **GitHub Actions** builds and publishes on every push to `main`
- **Auth + metadata:** **Supabase** free tier — Google login + Postgres (no server code)
- **File storage:** **your personal Google Drive**, via a free **Google Apps Script** proxy

Because GitHub Pages can only serve static files, authentication and the file
*database* are handled by Supabase directly from the browser, and each user's
metadata is isolated by Postgres **Row-Level Security**. The file *bytes* live
in your own Google Drive: a small Apps Script Web App (which runs as you) is the
"proxy API" that reads and writes Drive on the frontend's behalf — so no Drive
credentials ever touch the browser. See
[`google-apps-script/`](google-apps-script/README.md).

## Features

- ✅ **Sign in with Google** (OAuth via Supabase)
- ✅ **Upload / download / delete** files (drag-and-drop or picker, multi-file)
- ✅ **Folders** with nesting, breadcrumbs, rename, and recursive delete
- ✅ **Share links** — public, token-based, expiring download links
- ✅ Files stored in **your** Google Drive; metadata isolated per user in the DB

---

## One-time setup (~10 minutes)

You need a free Supabase account and a Google account (for the Drive proxy). No
credit card, no server to run.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project (free tier).
2. Wait for it to finish provisioning.

### 2. Create the database

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   This creates the metadata tables and their Row-Level Security policies.
   (File bytes are not stored here — they go to your Google Drive, step 5.)

### 3. Grab your API credentials

In the dashboard: **Project Settings → API**, copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

> These are public, browser-safe values. Your data is protected by the
> Row-Level Security policies from step 2 — never use the `service_role` key here.

### 4. Enable Google sign-in

Sign-in uses Google OAuth, which needs a Google OAuth client wired into Supabase:

1. **Create a Google OAuth client** — in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   **Create credentials → OAuth client ID → Web application**.
   - Under **Authorized redirect URIs**, add the callback URL Supabase shows you
     in the next step. It looks like:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy the generated **Client ID** and **Client secret**.
2. **Turn it on in Supabase** — dashboard → **Authentication → Sign In / Providers
   → Google**: enable it and paste the Client ID and Client secret. Supabase
   displays the exact callback URL to paste back into Google (step 1).
3. **Allow your app URLs** — **Authentication → URL Configuration**, add both:
   - `http://localhost:5173/mydropbox/` (local dev)
   - `https://<your-username>.github.io/mydropbox/` (deployed)

### 5. Deploy the Google Drive proxy

Files are stored in your personal Google Drive through a free Google Apps Script
Web App. Follow [`google-apps-script/README.md`](google-apps-script/README.md) —
it takes ~5 minutes and gives you a `VITE_PROXY_URL` (a `…/exec` URL).

---

## Run locally

```bash
npm install
cp .env.example .env      # then paste your three values into .env
npm run dev
```

Open the printed `http://localhost:5173/mydropbox/` URL.

---

## Deploy to GitHub Pages (free, automatic)

1. **Add repo secrets** — GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PROXY_URL`
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
| Auth | `supabase.auth` Google OAuth, session tracked in `AuthContext` |
| File bytes | **Your Google Drive**, via the Apps Script proxy (`google-apps-script/Code.gs`) |
| Metadata | `folders` and `files` Postgres tables, filtered by `auth.uid()` via RLS; each file row stores its Drive `drive_id` |
| Uploads/Downloads | Frontend sends/receives base64 through the proxy, which verifies the Supabase login token before touching Drive |
| Sharing | A public `shares` row maps an unguessable token to a Drive id; the `/share/:token` page asks the proxy for the bytes, which validates the token first |
| SPA routing on Pages | `404.html` stashes the deep link and bounces to `index.html`, which restores it |

### Project layout

```
src/
  lib/supabase.js   Supabase client
  lib/proxy.js      Google Drive proxy client (upload/download/delete)
  lib/api.js        Data operations (folders, files, shares)
  lib/format.js     Byte + icon helpers
  context/          Auth provider
  pages/            Login, Dashboard, SharedFile, NotConfigured
  components/       Breadcrumbs, ShareModal
supabase/schema.sql   Database metadata + RLS (run once)
google-apps-script/   Google Drive proxy (deploy as a Web App)
.github/workflows/    GitHub Pages deploy
```

## Notes & limits (free-tier reality)

- Storage capacity is whatever your Google Drive has; the Supabase free
  database (500 MB) only holds lightweight metadata.
- The Apps Script proxy moves file bytes as base64, so it suits
  **small-to-medium files** (tens of MB), not multi-GB uploads. See the
  [proxy notes](google-apps-script/README.md#limits--caveats-free-tier-reality).
- All users' files land in **one** Drive folder (`myDropbox`) that you own.
  Per-user privacy is enforced at the metadata layer (RLS), so users only ever
  see their own files in the app.
- Share links stay valid for 30 days. Deleting the share row disables the link
  immediately, since the proxy re-checks the token in Supabase on every download.
- Uploads have no virus scanning or file-type restriction out of the box.
