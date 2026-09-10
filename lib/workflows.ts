import path from 'path';
import type { Receipt, Settings, WorkflowType } from './types';
import { appendRowToSheet, ensureSheetHeaderRow, uploadFileToDrive } from './google';
export { WORKFLOW_LABELS } from './workflowLabels';

function sanitizeForFilename(value: string): string {
  return value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function buildFilename(template: string, receipt: Receipt): string {
  const ext = path.extname(receipt.filename) || '';
  const vendor = sanitizeForFilename(receipt.vendor || 'unknown-vendor');
  const date = receipt.receiptDate || 'unknown-date';
  const amount = receipt.amount != null ? receipt.amount.toFixed(2) : 'unknown-amount';
  const currency = receipt.currency || '';

  const name = template
    .replace('{vendor}', vendor)
    .replace('{date}', date)
    .replace('{amount}', amount)
    .replace('{currency}', currency)
    .replace('{original}', path.basename(receipt.filename, ext));

  const cleanName = sanitizeForFilename(name);
  return cleanName.toLowerCase().endsWith(ext.toLowerCase()) ? cleanName : `${cleanName}${ext}`;
}

export async function runRenameUploadDrive(opts: {
  accessToken: string;
  receipt: Receipt;
  settings: Settings;
}): Promise<{ result: string }> {
  const { accessToken, receipt, settings } = opts;
  if (!settings.driveFolderId) {
    throw new Error('No Google Drive folder configured. Set a Drive Folder ID in Settings.');
  }

  const filename = buildFilename(settings.filenameTemplate, receipt);
  const { fileId, webViewLink } = await uploadFileToDrive({
    accessToken,
    localPath: receipt.storedPath,
    filename,
    mimeType: receipt.mimeType,
    folderId: settings.driveFolderId
  });

  return {
    result: `Uploaded as "${filename}" (fileId: ${fileId})${webViewLink ? ` — ${webViewLink}` : ''}`
  };
}

export async function runAppendSheetRow(opts: {
  accessToken: string;
  receipt: Receipt;
  settings: Settings;
}): Promise<{ result: string }> {
  const { accessToken, receipt, settings } = opts;
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
      receipt.receiptDate || '',
      receipt.vendor || '',
      receipt.amount ?? '',
      receipt.currency || '',
      receipt.category || '',
      receipt.summary || '',
      receipt.filename,
      receipt.uploadedAt
    ]
  });

  return { result: `Appended row to "${tabName}" tab` };
}

export async function runWorkflow(
  type: WorkflowType,
  opts: { accessToken: string; receipt: Receipt; settings: Settings }
): Promise<{ result: string }> {
  switch (type) {
    case 'rename_upload_drive':
      return runRenameUploadDrive(opts);
    case 'append_sheet_row':
      return runAppendSheetRow(opts);
    default:
      throw new Error(`Unknown workflow type: ${type}`);
  }
}

