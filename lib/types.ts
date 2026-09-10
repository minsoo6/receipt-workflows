export interface Receipt {
  id: string;
  filename: string;
  storedPath: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  vendor: string | null;
  receiptDate: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  summary: string | null;
  rawExtraction: string | null;
  status: 'processing' | 'extracted' | 'extraction_failed';
}

export interface WorkflowRun {
  id: string;
  receiptId: string;
  workflowType: WorkflowType;
  status: 'success' | 'error';
  result: string | null;
  error: string | null;
  ranAt: string;
}

export type WorkflowType = 'rename_upload_drive' | 'append_sheet_row';

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
