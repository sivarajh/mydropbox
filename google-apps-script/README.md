# Google Drive proxy (Google Apps Script)

This is the free "proxy API" that lets myDropbox store files in **your personal
Google Drive**. It's a [Google Apps Script](https://script.google.com) Web App,
so it costs nothing, needs no server, and — because it runs **as you** — it can
access your Drive without you storing any Drive key or refresh token anywhere.

Security: the proxy verifies the caller's **Supabase login token** on every
upload/download/delete, so only people signed into your app can use it. Public
share links are the one exception — those are validated by looking the share
token up in Supabase before the file is served.

## Deploy it (~5 minutes)

1. Go to <https://script.google.com> → **New project**.
2. Delete the starter code and paste in [`Code.gs`](Code.gs).
3. (Optional but recommended) Click the ⚙️ **Project Settings** → check
   **"Show appsscript.json manifest file"**, then open `appsscript.json` in the
   editor and replace it with [this repo's `appsscript.json`](appsscript.json).
4. Add your Supabase values as **Script Properties**:
   **Project Settings → Script Properties → Add script property**:
   | Property | Value |
   |----------|-------|
   | `SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | your Supabase **anon public** key |
5. **Deploy → New deployment → type: Web app**:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
   - Click **Deploy** and authorize the Drive + external-request permissions
     when prompted (it's your own script accessing your own Drive).
6. Copy the **Web app URL** (ends in `/exec`). That is your `VITE_PROXY_URL`.

## Wire it into the app

- **Local:** put the URL in `.env` as `VITE_PROXY_URL`.
- **Deployed:** add it as a GitHub repo secret named `VITE_PROXY_URL`
  (Settings → Secrets and variables → Actions).

## Test it

Open the `/exec` URL in a browser — you should see
`{"ok":true,"service":"myDropbox-drive-proxy"}`. Uploaded files land in a folder
named **myDropbox** at the root of your Drive.

## How it works

| Action | Method | Auth | What it does |
|--------|--------|------|--------------|
| `upload` | POST | Supabase token | Writes base64 bytes to a file in your `myDropbox` Drive folder; returns its Drive id |
| `download` | POST | Supabase token | Returns a file's bytes (base64) by Drive id |
| `delete` | POST | Supabase token | Trashes one or more Drive files by id |
| `shared` | POST | share token | Validates the token in Supabase, then returns the file's bytes |

Requests use a `text/plain` JSON body with no custom headers, which keeps them
CORS "simple requests" — Apps Script web apps don't handle preflight (`OPTIONS`).

## Limits & caveats (free-tier reality)

- Apps Script moves file bytes as base64 through the script, so this suits
  **small-to-medium files** (roughly tens of MB each), not multi-GB uploads.
- Apps Script has daily quotas (URL fetch calls, runtime). Fine for personal use.
- Redeploying with **"Manage deployments → Edit → New version"** keeps the same
  `/exec` URL; creating a brand-new deployment gives a new URL (update the
  secret if so).
- `download` currently authorizes any signed-in user (ownership is enforced by
  the app's Supabase RLS, which only ever hands a user their own Drive ids). For
  stricter isolation you could pass the file id through Supabase for an ownership
  check — noted as a future hardening step.
