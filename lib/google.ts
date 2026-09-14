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
 * Writes a row into the first free row below all existing content.
 *
 * Deliberately not values.append: that resolves the "table" containing the
 * given range, so a blank row anywhere in the sheet makes it stop early and
 * write into the middle. Reading the used range and targeting lastRow + 1
 * always lands at the true bottom. Writes the header row first if the tab is
 * completely empty.
 */
export async function writeRowAtBottom(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  header: string[];
  row: (string | number)[];
}): Promise<{ rowNumber: number; wroteHeader: boolean }> {
  const sheets = sheetsClient(opts.accessToken);
  const tab = quoteTabName(opts.tabName);

  // values.get trims trailing empty rows, so this length is the last row with content.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.spreadsheetId,
    range: `${tab}!A:Z`
  });
  const usedRows = existing.data.values?.length ?? 0;

  let wroteHeader = false;
  if (usedRows === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: opts.spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [opts.header] }
    });
    wroteHeader = true;
  }

  const rowNumber = wroteHeader ? 2 : usedRows + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: opts.spreadsheetId,
    range: `${tab}!A${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [opts.row] }
  });

  return { rowNumber, wroteHeader };
}
