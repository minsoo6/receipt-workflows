export type WorkflowType = 'rename_upload_drive' | 'append_sheet_row';

export interface WorkflowRun {
  id: string;
  workflowType: WorkflowType;
  status: 'success' | 'error';
  result: string | null;
  error: string | null;
  ranAt: string;
}

export interface ReceiptFields {
  filename: string;
  mimeType: string;
  vendor: string | null;
  receiptDate: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  summary: string | null;
}

export interface ReceiptRecord extends ReceiptFields {
  id: string;
  size: number;
  uploadedAt: string;
  status: 'extracted' | 'extraction_failed';
  runs: WorkflowRun[];
}

export interface Settings {
  driveFolderId: string;
  driveFolderName: string;
  filenameTemplate: string;
  sheetId: string;
  sheetName: string;
  sheetTabName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  driveFolderId: '',
  driveFolderName: '',
  filenameTemplate: '{date}_{vendor}_{amount}',
  sheetId: '',
  sheetName: '',
  sheetTabName: 'Receipts'
};

export interface ExtractedReceiptData {
  vendor: string | null;
  date: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  summary: string | null;
  items: { description: string; amount: number | null }[];
}
