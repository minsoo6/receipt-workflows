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
 * Reads the tab's header row and figures out where the next row goes.
 *
 * The target row is computed from the used range rather than via values.append:
 * append resolves the "table" containing its range, so a blank row anywhere in
 * the sheet makes it stop early and write into the middle. values.get trims
 * trailing empty rows, so the row count is the last row with content and
 * lastRow + 1 is always the true bottom.
 */
export async function inspectSheetTab(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
}): Promise<{ headers: string[]; nextRow: number }> {
  const sheets = sheetsClient(opts.accessToken);
  const tab = quoteTabName(opts.tabName);

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.spreadsheetId,
    range: `${tab}!A:Z`
  });

  const rows = existing.data.values ?? [];
  const headers = (rows[0] ?? []).map((cell: unknown) => String(cell ?? ''));

  return {
    headers: headers.some((h) => h.trim() !== '') ? headers : [],
    nextRow: rows.length === 0 ? 2 : rows.length + 1
  };
}

export async function writeSheetRow(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  rowNumber: number;
  values: (string | number)[];
  header?: string[];
}): Promise<void> {
  const sheets = sheetsClient(opts.accessToken);
  const tab = quoteTabName(opts.tabName);

  if (opts.header) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: opts.spreadsheetId,
      range: `${tab}!A1`,
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
