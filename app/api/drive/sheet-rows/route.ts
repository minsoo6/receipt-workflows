import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readTopRows } from '@/lib/google';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as (Session & { accessToken?: string }) | null;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.accessToken) {
    return NextResponse.json({ error: 'No Google access token on session. Please sign out and back in.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get('sheetId');
  const tabName = searchParams.get('tab');

  if (!spreadsheetId || !tabName) {
    return NextResponse.json({ error: 'sheetId and tab are required' }, { status: 400 });
  }

  try {
    const rows = await readTopRows({
      accessToken: session.accessToken,
      spreadsheetId,
      tabName,
      limit: 10
    });
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Could not read the sheet' },
      { status: 400 }
    );
  }
}
