import { google } from 'googleapis';
import { Readable } from 'stream';

function driveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

function sheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

export interface DriveItem {
  id: string;
  name: string;
  modifiedTime: string | null;
}

// Drive query strings are single-quote delimited, so a quote in user input
// would otherwise break out of the term.
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Lists folders or spreadsheets. With a search term the whole Drive is
 * searched; otherwise folders are listed as children of `parentId` so the
 * picker can browse, and spreadsheets are listed most-recent-first.
 */
export async function listDriveItems(opts: {
  accessToken: string;
  mimeType: string;
  parentId?: string;
  search?: string;
}): Promise<DriveItem[]> {
  const drive = driveClient(opts.accessToken);
  const search = opts.search?.trim();

  const clauses = [`mimeType='${opts.mimeType}'`, 'trashed=false'];
  if (search) {
    clauses.push(`name contains '${escapeDriveQuery(search)}'`);
  } else if (opts.mimeType === FOLDER_MIME) {
    clauses.push(`'${escapeDriveQuery(opts.parentId || 'root')}' in parents`);
  }

  const res = await drive.files.list({
    q: clauses.join(' and '),
    fields: 'files(id, name, modifiedTime)',
    orderBy: opts.mimeType === FOLDER_MIME && !search ? 'name' : 'modifiedTime desc',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  return (res.data.files ?? []).map((file) => ({
    id: file.id!,
    name: file.name ?? '(untitled)',
    modifiedTime: file.modifiedTime ?? null
  }));
}

export async function getDriveItemName(opts: {
  accessToken: string;
  fileId: string;
}): Promise<string | null> {
  const drive = driveClient(opts.accessToken);
  try {
    const res = await drive.files.get({
      fileId: opts.fileId,
      fields: 'name',
      supportsAllDrives: true
    });
    return res.data.name ?? null;
  } catch {
    return null;
  }
}

export async function listSheetTabs(opts: {
  accessToken: string;
  spreadsheetId: string;
}): Promise<string[]> {
  const sheets = sheetsClient(opts.accessToken);
  const res = await sheets.spreadsheets.get({
    spreadsheetId: opts.spreadsheetId,
    fields: 'sheets(properties(title))'
  });
  return (res.data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
}

export async function uploadFileToDrive(opts: {
  accessToken: string;
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
  folderId?: string;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const drive = driveClient(opts.accessToken);
  const res = await drive.files.create({
    requestBody: {
      name: opts.filename,
      parents: opts.folderId ? [opts.folderId] : undefined
    },
    media: {
      mimeType: opts.mimeType,
      body: Readable.from(opts.fileBuffer)
    },
    fields: 'id, webViewLink'
  });

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink ?? null
  };
}

// A1 notation requires single-quoting tab names containing spaces or punctuation,
// with any internal apostrophe doubled.
function quoteTabName(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

/**
 * Reads column names from `headerRow` and figures out where the next row goes.
 *
 * The target row is computed from the used range rather than via values.append:
 * append resolves the "table" containing its range, so a blank row anywhere in
 * the sheet makes it stop early and write into the middle. values.get trims
 * trailing empty rows, so the row count is the last row with content and
 * lastRow + 1 is always the true bottom — floored at headerRow + 1 so a row
 * can never land on or above the headers.
 */
export async function inspectSheetTab(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  headerRow: number;
}): Promise<{ headers: string[]; nextRow: number }> {
  const sheets = sheetsClient(opts.accessToken);
  const tab = quoteTabName(opts.tabName);
  const headerRow = Math.max(1, Math.floor(opts.headerRow || 1));

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.spreadsheetId,
    range: `${tab}!A:Z`
  });

  const rows = existing.data.values ?? [];
  const headers = (rows[headerRow - 1] ?? []).map((cell: unknown) => String(cell ?? ''));

  return {
    headers: headers.some((h) => h.trim() !== '') ? headers : [],
    nextRow: Math.max(rows.length + 1, headerRow + 1)
  };
}

/**
 * Returns the tab's first rows as a padded grid so the UI can show them with
 * stable row/column positions and let the user click the header row.
 */
export async function readTopRows(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  limit?: number;
}): Promise<string[][]> {
  const sheets = sheetsClient(opts.accessToken);
  const tab = quoteTabName(opts.tabName);
  const limit = opts.limit ?? 10;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.spreadsheetId,
    range: `${tab}!A1:Z${limit}`
  });

  const rows = (res.data.values ?? []).map((row: unknown[]) =>
    row.map((cell) => String(cell ?? ''))
  );

  // values.get drops trailing empties, so pad to a rectangle — otherwise a
  // short row would shift the columns the user is trying to line up.
  const width = Math.max(1, ...rows.map((row) => row.length));
  return Array.from({ length: limit }, (_, i) => {
    const row = rows[i] ?? [];
    return Array.from({ length: width }, (_, j) => row[j] ?? '');
  });
}

export async function writeSheetRow(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  rowNumber: number;
  values: (string | number)[];
  header?: string[];
  headerRow?: number;
}): Promise<void> {
  const sheets = sheetsClient(opts.accessToken);
  const tab = quoteTabName(opts.tabName);

  if (opts.header) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: opts.spreadsheetId,
      range: `${tab}!A${Math.max(1, Math.floor(opts.headerRow || 1))}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [opts.header] }
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: opts.spreadsheetId,
    range: `${tab}!A${opts.rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [opts.values] }
  });
}
