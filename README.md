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
- SQLite (`better-sqlite3`) for local storage of receipts, workflow run
  history, and settings — stored in `data/receipts.db`
- NextAuth with Google OAuth for sign-in and Drive/Sheets API access
- `googleapis` for Drive uploads and Sheets appends
- `@anthropic-ai/sdk` (Claude) for receipt data extraction

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
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
     (add your production URL's equivalent too, if deploying)
5. Copy the generated Client ID and Client Secret.

> This app requests the broad `drive` and `spreadsheets` scopes (rather than
> the more restrictive `drive.file`) so it can upload into and append to any
> folder/sheet you paste an ID for, without needing a Google Picker
> integration. Since this is a personal-use tool, that tradeoff keeps setup
> simple — revoke access any time from your
> [Google Account permissions](https://myaccount.google.com/permissions).

### 3. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com/) and
set it as `ANTHROPIC_API_KEY`.

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
3. **Drop a receipt** (JPEG/PNG/WebP/GIF/PDF, up to 15MB) onto the upload
   area. Claude extracts vendor, date, amount, currency, category, and a
   summary automatically.
4. **Review/edit** the extracted fields under "Edit details & run workflows"
   if anything needs correcting.
5. **Check the workflows** you want to run (rename+upload, sheet row, or
   both) and click **Run selected workflows**. Results (success or error, with
   details) show up in the run log under the receipt.

## Data & files

- Uploaded receipt files are stored locally under `uploads/`.
- Receipt metadata, extraction results, workflow run history, and settings
  are stored in a local SQLite database at `data/receipts.db`.
- Both directories are gitignored — nothing here is meant to be committed.

## Notes / limitations

- This is built for single-user personal use — there's no multi-tenant
  isolation; whoever can sign in with Google sees all uploaded receipts and
  shares the same Drive/Sheet destination settings.
- PDF extraction uses Claude's native PDF understanding; very low-quality
  scans may need manual correction after extraction.
- Google access tokens are refreshed automatically using the stored refresh
  token. If refresh ever fails (e.g. access revoked), the dashboard shows a
  banner prompting you to sign out and back in.
