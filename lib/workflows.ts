import path from 'path';
import type { ReceiptFields, Settings, WorkflowType } from './types';
import { appendRowToSheet, ensureSheetHeaderRow, uploadFileToDrive } from './google';
export { WORKFLOW_LABELS } from './workflowLabels';

function sanitizeForFilename(value: string): string {
  return value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function buildFilename(template: string, fields: ReceiptFields): string {
  const ext = path.extname(fields.filename) || '';
  const vendor = sanitizeForFilename(fields.vendor || 'unknown-vendor');
  const date = fields.receiptDate || 'unknown-date';
  const amount = fields.amount != null ? fields.amount.toFixed(2) : 'unknown-amount';
  const currency = fields.currency || '';

  const name = template
    .replace('{vendor}', vendor)
    .replace('{date}', date)
    .replace('{amount}', amount)
    .replace('{currency}', currency)
    .replace('{original}', path.basename(fields.filename, ext));

  const cleanName = sanitizeForFilename(name);
  return cleanName.toLowerCase().endsWith(ext.toLowerCase()) ? cleanName : `${cleanName}${ext}`;
}

export async function runRenameUploadDrive(opts: {
  accessToken: string;
  fileBuffer: Buffer;
  fields: ReceiptFields;
  settings: Settings;
}): Promise<{ result: string }> {
  const { accessToken, fileBuffer, fields, settings } = opts;
  if (!settings.driveFolderId) {
    throw new Error('No Google Drive folder configured. Set a Drive Folder ID in Settings.');
  }

  const filename = buildFilename(settings.filenameTemplate, fields);
  const { fileId, webViewLink } = await uploadFileToDrive({
    accessToken,
    fileBuffer,
    filename,
    mimeType: fields.mimeType,
    folderId: settings.driveFolderId
  });

  return {
    result: `Uploaded as "${filename}" (fileId: ${fileId})${webViewLink ? ` — ${webViewLink}` : ''}`
  };
}

export async function runAppendSheetRow(opts: {
  accessToken: string;
  fields: ReceiptFields;
  settings: Settings;
  uploadedAt: string;
}): Promise<{ result: string }> {
  const { accessToken, fields, settings, uploadedAt } = opts;
  if (!settings.sheetId) {
    throw new Error('No Google Sheet configured. Set a Sheet ID in Settings.');
  }

  const tabName = settings.sheetTabName || 'Receipts';

  try {
    await ensureSheetHeaderRow({
      accessToken,
      spreadsheetId: settings.sheetId,
      tabName,
      header: ['Date', 'Vendor', 'Amount', 'Currency', 'Category', 'Summary', 'Original Filename', 'Uploaded At']
    });
  } catch (err) {
    // If the tab doesn't exist or header check fails, continue — append will still surface a clear error.
  }

  await appendRowToSheet({
    accessToken,
    spreadsheetId: settings.sheetId,
    tabName,
    row: [
      fields.receiptDate || '',
      fields.vendor || '',
      fields.amount ?? '',
      fields.currency || '',
      fields.category || '',
      fields.summary || '',
      fields.filename,
      uploadedAt
    ]
  });

  return { result: `Appended row to "${tabName}" tab` };
}

export async function runWorkflow(
  type: WorkflowType,
  opts: {
    accessToken: string;
    fileBuffer: Buffer | null;
    fields: ReceiptFields;
    settings: Settings;
    uploadedAt: string;
  }
): Promise<{ result: string }> {
  switch (type) {
    case 'rename_upload_drive':
      if (!opts.fileBuffer) {
        throw new Error('Original file is no longer available in this browser session — re-upload the receipt to run this workflow.');
      }
      return runRenameUploadDrive({
        accessToken: opts.accessToken,
        fileBuffer: opts.fileBuffer,
        fields: opts.fields,
        settings: opts.settings
      });
    case 'append_sheet_row':
      return runAppendSheetRow({
        accessToken: opts.accessToken,
        fields: opts.fields,
        settings: opts.settings,
        uploadedAt: opts.uploadedAt
      });
    default:
      throw new Error(`Unknown workflow type: ${type}`);
  }
}
