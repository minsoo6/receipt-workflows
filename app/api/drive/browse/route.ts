import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FOLDER_MIME, SPREADSHEET_MIME, listDriveItems } from '@/lib/google';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as (Session & { accessToken?: string }) | null;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.accessToken) {
    return NextResponse.json({ error: 'No Google access token on session. Please sign out and back in.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const parentId = searchParams.get('parent') ?? 'root';
  const search = searchParams.get('q') ?? '';

  if (type !== 'folder' && type !== 'spreadsheet') {
    return NextResponse.json({ error: 'type must be "folder" or "spreadsheet"' }, { status: 400 });
  }

  try {
    const items = await listDriveItems({
      accessToken: session.accessToken,
      mimeType: type === 'folder' ? FOLDER_MIME : SPREADSHEET_MIME,
      parentId,
      search
    });
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Could not read from Google Drive' },
      { status: 400 }
    );
  }
}
