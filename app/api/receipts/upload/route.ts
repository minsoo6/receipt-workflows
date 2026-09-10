import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UPLOADS_DIR, insertReceipt, updateReceiptExtraction } from '@/lib/db';
import { extractReceiptData } from '@/lib/anthropic';
import type { Receipt } from '@/lib/types';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]);

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Upload an image (JPEG/PNG/WebP/GIF) or PDF.` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
  }

  const id = randomUUID();
  const ext = path.extname(file.name) || '';
  const storedPath = path.join(UPLOADS_DIR, `${id}${ext}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storedPath, buffer);

  const receipt: Receipt = {
    id,
    filename: file.name,
    storedPath,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    vendor: null,
    receiptDate: null,
    amount: null,
    currency: null,
    category: null,
    summary: null,
    rawExtraction: null,
    status: 'processing'
  };

  insertReceipt(receipt);

  try {
    const extracted = await extractReceiptData(storedPath, file.type);
    updateReceiptExtraction(id, {
      vendor: extracted.vendor,
      receiptDate: extracted.date,
      amount: extracted.amount,
      currency: extracted.currency,
      category: extracted.category,
      summary: extracted.summary,
      rawExtraction: JSON.stringify(extracted),
      status: 'extracted'
    });
  } catch (err: any) {
    updateReceiptExtraction(id, {
      status: 'extraction_failed',
      summary: `Extraction failed: ${err?.message ?? 'unknown error'}`
    });
  }

  return NextResponse.json({ id });
}
