import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractReceiptData } from '@/lib/anthropic';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]);

// Vercel serverless functions cap request bodies at 4.5MB — stay comfortably under that.
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

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
    return NextResponse.json({ error: 'File too large (max 4MB)' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const extracted = await extractReceiptData(buffer, file.type);
    return NextResponse.json({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      status: 'extracted',
      ...extracted
    });
  } catch (err: any) {
    return NextResponse.json({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      status: 'extraction_failed',
      error: err?.message ?? 'Unknown error'
    });
  }
}
