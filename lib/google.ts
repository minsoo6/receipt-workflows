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

export async function appendRowToSheet(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  row: (string | number)[];
}): Promise<void> {
  const sheets = sheetsClient(opts.accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId: opts.spreadsheetId,
    range: `${opts.tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [opts.row]
    }
  });
}

export async function ensureSheetHeaderRow(opts: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  header: string[];
}): Promise<void> {
  const sheets = sheetsClient(opts.accessToken);
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.spreadsheetId,
    range: `${opts.tabName}!A1:Z1`
  });

  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: opts.spreadsheetId,
      range: `${opts.tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [opts.header] }
    });
  }
}
