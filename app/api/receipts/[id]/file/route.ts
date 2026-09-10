import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getReceipt } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const receipt = getReceipt(params.id);
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buffer = await fs.readFile(receipt.storedPath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': receipt.mimeType,
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
