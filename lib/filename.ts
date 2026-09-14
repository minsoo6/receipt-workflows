import type { ReceiptFields } from './types';
import { formatDate } from './dateFormat';

// Deliberately not node:path — this module is imported by client components,
// and the two helpers needed are a couple of string operations.
function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot) : '';
}

function stemOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

// Only strips characters that are illegal in filenames on common platforms.
// Spaces, "&", and "-" are preserved so templates read as written.
export function sanitizeForFilename(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFilename(
  template: string,
  fields: ReceiptFields,
  dateFormat: string
): string {
  const ext = extensionOf(fields.filename);
  const vendor = fields.vendor || 'unknown-vendor';
  const date = fields.receiptDate ? formatDate(fields.receiptDate, dateFormat) : 'unknown-date';
  const amount = fields.amount != null ? fields.amount.toFixed(2) : 'unknown-amount';
  const currency = fields.currency || '';

  const name = template
    .replace('{vendor}', vendor)
    .replace('{date}', date)
    .replace('{amount}', amount)
    .replace('{currency}', currency)
    .replace('{original}', stemOf(fields.filename));

  const cleanName = sanitizeForFilename(name).slice(0, 120).trim();
  return cleanName.toLowerCase().endsWith(ext.toLowerCase()) ? cleanName : `${cleanName}${ext}`;
}
