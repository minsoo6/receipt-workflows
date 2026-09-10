import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Receipt, WorkflowRun, WorkflowType, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export { UPLOADS_DIR };

declare global {
  // eslint-disable-next-line no-var
  var __receiptDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const db = new Database(path.join(DATA_DIR, 'receipts.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      vendor TEXT,
      receipt_date TEXT,
      amount REAL,
      currency TEXT,
      category TEXT,
      summary TEXT,
      raw_extraction TEXT,
      status TEXT NOT NULL DEFAULT 'processing'
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      workflow_type TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      ran_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

function getDb(): Database.Database {
  if (!global.__receiptDb) {
    global.__receiptDb = createConnection();
  }
  return global.__receiptDb;
}

function rowToReceipt(row: any): Receipt {
  return {
    id: row.id,
    filename: row.filename,
    storedPath: row.stored_path,
    mimeType: row.mime_type,
    size: row.size,
    uploadedAt: row.uploaded_at,
    vendor: row.vendor,
    receiptDate: row.receipt_date,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    summary: row.summary,
    rawExtraction: row.raw_extraction,
    status: row.status
  };
}

function rowToRun(row: any): WorkflowRun {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    workflowType: row.workflow_type,
    status: row.status,
    result: row.result,
    error: row.error,
    ranAt: row.ran_at
  };
}

export function insertReceipt(receipt: Receipt): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO receipts (id, filename, stored_path, mime_type, size, uploaded_at, vendor, receipt_date, amount, currency, category, summary, raw_extraction, status)
     VALUES (@id, @filename, @storedPath, @mimeType, @size, @uploadedAt, @vendor, @receiptDate, @amount, @currency, @category, @summary, @rawExtraction, @status)`
  ).run({
    id: receipt.id,
    filename: receipt.filename,
    storedPath: receipt.storedPath,
    mimeType: receipt.mimeType,
    size: receipt.size,
    uploadedAt: receipt.uploadedAt,
    vendor: receipt.vendor,
    receiptDate: receipt.receiptDate,
    amount: receipt.amount,
    currency: receipt.currency,
    category: receipt.category,
    summary: receipt.summary,
    rawExtraction: receipt.rawExtraction,
    status: receipt.status
  });
}

export function updateReceiptExtraction(
  id: string,
  data: Partial<Pick<Receipt, 'vendor' | 'receiptDate' | 'amount' | 'currency' | 'category' | 'summary' | 'rawExtraction' | 'status'>>
): void {
  const db = getDb();
  const current = getReceipt(id);
  if (!current) return;
  const merged = { ...current, ...data };
  db.prepare(
    `UPDATE receipts SET vendor=@vendor, receipt_date=@receiptDate, amount=@amount, currency=@currency, category=@category, summary=@summary, raw_extraction=@rawExtraction, status=@status WHERE id=@id`
  ).run({
    id,
    vendor: merged.vendor,
    receiptDate: merged.receiptDate,
    amount: merged.amount,
    currency: merged.currency,
    category: merged.category,
    summary: merged.summary,
    rawExtraction: merged.rawExtraction,
    status: merged.status
  });
}

export function getReceipt(id: string): Receipt | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id);
  return row ? rowToReceipt(row) : null;
}

export function listReceipts(): Receipt[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM receipts ORDER BY uploaded_at DESC').all();
  return rows.map(rowToReceipt);
}

export function deleteReceipt(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM receipts WHERE id = ?').run(id);
}

export function insertWorkflowRun(run: WorkflowRun): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO workflow_runs (id, receipt_id, workflow_type, status, result, error, ran_at)
     VALUES (@id, @receiptId, @workflowType, @status, @result, @error, @ranAt)`
  ).run(run);
}

export function listWorkflowRunsForReceipt(receiptId: string): WorkflowRun[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM workflow_runs WHERE receipt_id = ? ORDER BY ran_at DESC')
    .all(receiptId);
  return rows.map(rowToRun);
}

export function getSettings(): Settings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    driveFolderId: map.driveFolderId ?? DEFAULT_SETTINGS.driveFolderId,
    driveFolderName: map.driveFolderName ?? DEFAULT_SETTINGS.driveFolderName,
    filenameTemplate: map.filenameTemplate ?? DEFAULT_SETTINGS.filenameTemplate,
    sheetId: map.sheetId ?? DEFAULT_SETTINGS.sheetId,
    sheetName: map.sheetName ?? DEFAULT_SETTINGS.sheetName,
    sheetTabName: map.sheetTabName ?? DEFAULT_SETTINGS.sheetTabName
  };
}

export function saveSettings(settings: Partial<Settings>): void {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );
  const tx = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) upsert.run({ key, value });
  });
  tx(Object.entries(settings).filter(([, v]) => v !== undefined) as [string, string][]);
}
