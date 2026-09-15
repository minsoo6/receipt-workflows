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
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000`. Only needed locally — see "Deploying to Vercel" below. |
| `NEXTAUTH_SECRET` | Random secret for session encryption — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From step 2 |
| `ANTHROPIC_API_KEY` | From step 3 |
| `ANTHROPIC_MODEL` | Optional, defaults to `claude-haiku-4-5` |

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and
you'll land on the dashboard.

## Deploying to Vercel

`NEXTAUTH_URL` is derived automatically at runtime from Vercel's own
`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` env vars (see `lib/env.ts`) —
**do not set it in the Vercel dashboard**, only locally. That leaves exactly
four things to configure per deploy:

1. Import the repo into Vercel (framework preset: Next.js — auto-detected)
   and deploy once, so you know the production URL Vercel assigned (e.g.
   `https://receipt-workflows.vercel.app`, or a custom domain if you add
   one).
2. Add that URL's callback (`https://<your-vercel-domain>/api/auth/callback/google`)
   to the Google OAuth client's authorized redirect URIs.
3. In **Project → Settings → Environment Variables**, set `NEXTAUTH_SECRET`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ANTHROPIC_API_KEY` — set
   these directly in the Vercel dashboard rather than committing them
   anywhere.
4. Redeploy (Vercel does this automatically on env var changes, or trigger
   one manually) so the new values take effect.

No database, blob store, or other storage needs provisioning — there isn't
any (see "No server-side storage" above). If you later add a custom domain,
update the Google OAuth redirect URI to match it — `NEXTAUTH_URL` will still
resolve automatically since `VERCEL_PROJECT_PRODUCTION_URL` tracks it.

**File size limit:** Vercel serverless functions cap request bodies at
4.5MB, so uploads are capped at 4MB client- and server-side to leave headroom
for multipart overhead. This is enforced in both `/api/extract` and
`/api/run` (`MAX_SIZE_BYTES` in `app/api/extract/route.ts` and
`app/api/run/route.ts`).

## Using it

1. **Sign in** with the Google account that owns (or has access to) your
   destination Drive folder and/or Sheet.
2. **Open "Workflow settings"** and choose your destinations:
   - **Destination folder in Google Drive** — click Choose to browse your
     Drive (with breadcrumbs and search) and pick a folder; no IDs to copy.
   - A filename template and a date format. A live preview shows exactly how
     a sample receipt would be named as you type.
     - Filename tokens: `{date}` `{vendor}` `{amount}` `{currency}` `{original}`
     - Date format tokens: `YYYY` `YY` `MMMM` `MMM` `MM` `M` `DD` `D` —
       anything else in the format is kept literally. So `YYYYMMDD` gives
       `20260831`, and a template of `{date} receipt - {vendor}` produces
       `20260831 receipt - K&F Concept.png`.
     - Only characters that are illegal in filenames (`/ \ ? % * : | " < >`)
       are replaced; spaces, `&`, and `-` are preserved as written.
   - **Google Sheet** — click Choose to search and pick a spreadsheet, then
     select a tab from the dropdown (tabs are read from the sheet you picked).
     Rows are written to the first free row below all existing content, so
     blank rows in the middle of the sheet never cause a row to land in the
     wrong place. If the tab is completely empty, a header row is written
     first.
   - **Header row** — a grid of the tab's first 10 rows lets you click the row
     that holds your column names, so sheets with a title row or blank rows
     above the headers work fine. Receipts are always added below the last row
     with content, never on or above the header row.
   - Columns are matched to your sheet's **existing header names** — a sheet
     with `Merchant` / `Total` / `Notes` gets the vendor, amount, and summary
     in the right places.
   - Columns that match no receipt field are **guessed** from the receipt plus
     the last few rows already in your sheet, so a `Month` column gets
     `August`, and a column where every existing row says `No` gets `No`.
     **Category is always guessed** rather than matched: every sheet uses its
     own category vocabulary, so a generic label read off the receipt
     ("Restaurant") rarely fits. The receipt's reading is passed to the
     guesser as a hint to translate into whatever wording your rows use.
     Guesses are tagged in the preview so you can tell them from matched
     values, and the model is told to leave a column blank rather than invent
     something it can't support. This costs one extra API call, so it runs on
     the first preview for a receipt and then only via "Suggest again". Before running, a preview shows the target row and exactly
     what value lands in each column — and **each value is editable**, so you
     can adjust what gets written without changing the extracted receipt
     details.
3. **Drop a receipt** (JPEG/PNG/WebP/GIF/PDF, up to 4MB). Claude extracts
   vendor, date, amount, currency, category, and a summary automatically.
4. **Review/edit** the extracted fields (vendor, date, amount, currency) under
   "Edit details & run workflows" if anything needs correcting — edits save to
   this browser as you tab away from a field. Category isn't edited here; it's
   guessed per-sheet in the preview and editable there.
5. **Check the workflows** you want to run (rename+upload, sheet row, or
   both). A preview appears showing exactly what will happen, and everything
   in it is editable: the Drive **file name** and each **column value**. Edits
   apply to that one run without changing the extracted receipt details, and
   a reset link restores the derived values. An edited filename is cleaned of
   illegal characters and keeps the original extension.
6. Click **Run selected workflows**. Results (success or error, with details
   including the name used and the exact per-column values written) show up in
   the run log under the receipt.

## Notes / limitations

- Built for single-user personal use in one browser — there's no
  multi-tenant isolation or cross-device sync.
- PDF extraction uses Claude's native PDF understanding; very low-quality
  scans may need manual correction after extraction.
- Google access tokens are refreshed automatically using the stored refresh
  token. If refresh ever fails (e.g. access revoked), the dashboard shows a
  banner prompting you to sign out and back in.
