import type { ReceiptFields } from './types';
import { formatDate } from './dateFormat';

export type ReceiptField =
  | 'date'
  | 'vendor'
  | 'amount'
  | 'currency'
  | 'category'
  | 'summary'
  | 'filename'
  | 'uploadedAt';

export const FIELD_LABELS: Record<ReceiptField, string> = {
  date: 'Date',
  vendor: 'Vendor',
  amount: 'Amount',
  currency: 'Currency',
  category: 'Category',
  summary: 'Summary',
  filename: 'Original Filename',
  uploadedAt: 'Uploaded At'
};

// Header names (normalized) that map to each field. Kept deliberately
// conservative — a column left unmapped is obvious in the preview and
// harmless, whereas a wrong guess silently writes into someone's column.
const FIELD_ALIASES: Record<ReceiptField, string[]> = {
  date: ['date', 'receiptdate', 'transactiondate', 'purchasedate', 'datepaid'],
  vendor: ['vendor', 'merchant', 'store', 'payee', 'seller', 'supplier', 'company'],
  amount: ['amount', 'total', 'price', 'cost', 'subtotal', 'amountpaid'],
  currency: ['currency', 'ccy'],
  category: ['category', 'expensetype', 'expensecategory'],
  summary: ['summary', 'notes', 'note', 'description', 'memo', 'details', 'item', 'items'],
  filename: ['filename', 'file', 'originalfilename', 'attachment', 'receiptfile'],
  uploadedAt: ['uploadedat', 'timestamp', 'createdat', 'loggedat', 'dateadded', 'addedat']
};

const HEADER_TO_FIELD: Record<string, ReceiptField> = {};
for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [ReceiptField, string[]][]) {
  for (const alias of aliases) HEADER_TO_FIELD[alias] = field;
}

/** The column order used when creating a header row in an empty tab. */
export const DEFAULT_HEADERS: ReceiptField[] = [
  'date',
  'vendor',
  'amount',
  'currency',
  'category',
  'summary',
  'filename',
  'uploadedAt'
];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function columnLetter(index: number): string {
  let letters = '';
  let n = index;
  while (n >= 0) {
    letters = String.fromCharCode((n % 26) + 65) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return letters;
}

export function receiptFieldValues(
  fields: ReceiptFields,
  uploadedAt: string,
  dateFormat: string
): Record<ReceiptField, string> {
  return {
    date: fields.receiptDate ? formatDate(fields.receiptDate, dateFormat) : '',
    vendor: fields.vendor || '',
    amount: fields.amount != null ? String(fields.amount) : '',
    currency: fields.currency || '',
    category: fields.category || '',
    summary: fields.summary || '',
    filename: fields.filename,
    uploadedAt
  };
}

export interface ColumnAssignment {
  columnLetter: string;
  header: string;
  field: ReceiptField | null;
  value: string;
}

export interface SheetRowPlan {
  columns: ColumnAssignment[];
  /** Fields with no matching column — their values won't be written anywhere. */
  unmapped: { field: ReceiptField; label: string; value: string }[];
  createdHeader: boolean;
}

/**
 * Matches the sheet's existing headers to receipt fields by name. Columns whose
 * header matches nothing are left blank so existing data/formulas aren't touched.
 * When `headers` is empty the tab has no header row yet, so the default set is used.
 */
export function planSheetRow(
  headers: string[],
  values: Record<ReceiptField, string>
): SheetRowPlan {
  const effectiveHeaders =
    headers.length > 0 ? headers : DEFAULT_HEADERS.map((f) => FIELD_LABELS[f]);
  const createdHeader = headers.length === 0;

  const used = new Set<ReceiptField>();
  const columns: ColumnAssignment[] = effectiveHeaders.map((header, index) => {
    const field = HEADER_TO_FIELD[normalizeHeader(header)] ?? null;
    // Only the first column matching a field receives its value; a second
    // "Total" column stays blank rather than duplicating the amount.
    const claim = field && !used.has(field) ? field : null;
    if (claim) used.add(claim);
    return {
      columnLetter: columnLetter(index),
      header,
      field: claim,
      value: claim ? values[claim] : ''
    };
  });

  const unmapped = (Object.keys(values) as ReceiptField[])
    .filter((field) => !used.has(field) && values[field] !== '')
    .map((field) => ({ field, label: FIELD_LABELS[field], value: values[field] }));

  return { columns, unmapped, createdHeader };
}

export function planToRowValues(plan: SheetRowPlan): string[] {
  return plan.columns.map((column) => column.value);
}
