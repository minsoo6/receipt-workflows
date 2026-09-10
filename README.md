# receipt-workflows

Upload a receipt (image or PDF) and run automated workflows against it:

- **Rename & upload to Google Drive** — renames the file using a template (e.g.
  `{date}_{vendor}_{amount}`) and uploads it to a Drive folder you configure.
- **Add row to Google Sheet** — appends the extracted receipt details (date,
  vendor, amount, currency, category, summary) as a new row in a Google Sheet
  tab you configure.

Receipt details are extracted automatically on upload using the Claude API
(vision), and are editable before you run workflows.

## Stack

- Next.js 14 (App Router) + TypeScript
- NextAuth with Google OAuth for sign-in and Drive/Sheets API access
- `googleapis` for Drive uploads and Sheets appends
- `@anthropic-ai/sdk` (Claude) for receipt data extraction

## No server-side storage, by design

This app keeps **no database and writes nothing to disk**. Every request is
stateless:

- Uploading a receipt sends it straight to `/api/extract`, which calls Claude
  and returns the extracted fields — the file is held in memory for that one
  request only and then discarded server-side.
- The receipt file stays in the browser's memory (the `File` object from your
  file picker/drop) for the rest of the page session. Clicking "Run selected
  workflows" sends it again, directly to `/api/run`, which uploads it to
  Drive and/or appends a Sheets row and returns the results — again, nothing
  is written to server disk or a database.
- Your **receipt history and workflow settings** (Drive folder ID, filename
  template, Sheet ID, tab name) are saved in the browser's `localStorage`,
  not on the server.

Practical implications:

- **Reloading the page** clears the in-memory file, so the "Rename & upload to
  Drive" workflow becomes unavailable for older history entries (re-upload to
  use it again) — but "Add row to Google Sheet" still works from the saved
  field values, since it doesn't need the file itself.
- History and settings are **per-browser**, not synced across devices or
  shared between users signed into the same Google account elsewhere.
- This makes the app a clean fit for serverless hosting (e.g. Vercel) — there's
  no database or persistent volume to provision.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Google OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create
   (or select) a project.
2. **APIs & Services → Library**: enable the **Google Drive API** and
   **Google Sheets API**.
3. **APIs & Services → OAuth consent screen**: configure it (External is fine
   for personal use — add yourself as a test user if it stays in Testing
   mode).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URI (local dev):
     `http://localhost:3000/api/auth/callback/google`
   - Authorized redirect URI (production, once deployed):
     `https://<your-vercel-domain>/api/auth/callback/google`
5. Copy the generated Client ID and Client Secret.

> This app requests the broad `drive` and `spreadsheets` scopes (rather than
> the more restrictive `drive.file`) so it can upload into and append to any
> folder/sheet you paste an ID for, without needing a Google Picker
> integration. Since this is a personal-use tool, that tradeoff keeps setup
> simple — revoke access any time from your
> [Google Account permissions](https://myaccount.google.com/permissions).

### 3. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com/).

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret for session encryption — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From step 2 |
| `ANTHROPIC_API_KEY` | From step 3 |
| `ANTHROPIC_MODEL` | Optional, defaults to `claude-sonnet-5` |

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and
you'll land on the dashboard.

## Deploying to Vercel

1. Import the repo into Vercel (framework preset: Next.js — auto-detected).
2. In **Project → Settings → Environment Variables**, add `NEXTAUTH_URL`
   (your production URL, e.g. `https://receipt-workflows.vercel.app`),
   `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `ANTHROPIC_API_KEY`. Set these directly in the Vercel dashboard rather than
   committing them anywhere.
3. Add the production callback URL
   (`https://<your-vercel-domain>/api/auth/callback/google`) to the Google
   OAuth client's authorized redirect URIs (step 2 above).
4. Deploy. No database, blob store, or other storage needs provisioning —
   there isn't any (see "No server-side storage" above).

**File size limit:** Vercel serverless functions cap request bodies at
4.5MB, so uploads are capped at 4MB client- and server-side to leave headroom
for multipart overhead. This is enforced in both `/api/extract` and
`/api/run` (`MAX_SIZE_BYTES` in `app/api/extract/route.ts` and
`app/api/run/route.ts`).

## Using it

1. **Sign in** with the Google account that owns (or has access to) your
   destination Drive folder and/or Sheet.
2. **Open "Workflow settings"** and paste in:
   - A Drive **Folder ID** (from its URL:
     `drive.google.com/drive/folders/<FOLDER_ID>`) and a filename template.
   - A Sheet **ID** (from its URL:
     `docs.google.com/spreadsheets/d/<SHEET_ID>`) and a tab name (created
     automatically with a header row on first append if the tab is empty and
     already exists).
3. **Drop a receipt** (JPEG/PNG/WebP/GIF/PDF, up to 4MB). Claude extracts
   vendor, date, amount, currency, category, and a summary automatically.
4. **Review/edit** the extracted fields under "Edit details & run workflows"
   if anything needs correcting — edits save to this browser as you tab away
   from a field.
5. **Check the workflows** you want to run (rename+upload, sheet row, or
   both) and click **Run selected workflows**. Results (success or error, with
   details) show up in the run log under the receipt.

## Notes / limitations

- Built for single-user personal use in one browser — there's no
  multi-tenant isolation or cross-device sync.
- PDF extraction uses Claude's native PDF understanding; very low-quality
  scans may need manual correction after extraction.
- Google access tokens are refreshed automatically using the stored refresh
  token. If refresh ever fails (e.g. access revoked), the dashboard shows a
  banner prompting you to sign out and back in.
