import type { ReceiptFields, Settings, WorkflowType } from './types';
import { inspectSheetTab, uploadFileToDrive, writeSheetRow } from './google';
import { buildFilename } from './filename';
import { planSheetRow, planToRowValues, receiptFieldValues } from './sheetMapping';
export { WORKFLOW_LABELS } from './workflowLabels';
export { buildFilename } from './filename';

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

  const filename = buildFilename(settings.filenameTemplate, fields, settings.dateFormat);
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
  /** Per-column edits from the preview, keyed by column letter; these win over derived values. */
  columnOverrides?: Record<string, string>;
}): Promise<{ result: string }> {
  const { accessToken, fields, settings, uploadedAt, columnOverrides } = opts;
  if (!settings.sheetId) {
    throw new Error('No Google Sheet configured. Set a Sheet ID in Settings.');
  }

  const tabName = settings.sheetTabName || 'Receipts';

  const { headers, nextRow } = await inspectSheetTab({
    accessToken,
    spreadsheetId: settings.sheetId,
    tabName,
    headerRow: settings.headerRow
  });

  const values = receiptFieldValues(fields, uploadedAt, settings.dateFormat);
  const plan = planSheetRow(headers, values);

  if (columnOverrides) {
    for (const column of plan.columns) {
      if (Object.prototype.hasOwnProperty.call(columnOverrides, column.columnLetter)) {
        column.value = columnOverrides[column.columnLetter];
      }
    }
  }

  await writeSheetRow({
    accessToken,
    spreadsheetId: settings.sheetId,
    tabName,
    rowNumber: nextRow,
    values: planToRowValues(plan),
    header: plan.createdHeader ? plan.columns.map((c) => c.header) : undefined,
    headerRow: settings.headerRow
  });

  const written = plan.columns
    .filter((c) => c.value !== '')
    .map((c) => `${c.columnLetter} (${c.header}) = ${c.value}`)
    .join(' · ');

  const skipped = plan.unmapped.length
    ? ` — no column matched: ${plan.unmapped.map((u) => u.label).join(', ')}`
    : '';

  return {
    result: `Wrote row ${nextRow} of "${tabName}": ${written || '(no values matched any column)'}${skipped}`
  };
}

export async function runWorkflow(
  type: WorkflowType,
  opts: {
    accessToken: string;
    fileBuffer: Buffer | null;
    fields: ReceiptFields;
    settings: Settings;
    uploadedAt: string;
    columnOverrides?: Record<string, string>;
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
        uploadedAt: opts.uploadedAt,
        columnOverrides: opts.columnOverrides
      });
    default:
      throw new Error(`Unknown workflow type: ${type}`);
  }
}
