import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listSheetTabs } from '@/lib/google';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as (Session & { accessToken?: string }) | null;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.accessToken) {
    return NextResponse.json({ error: 'No Google access token on session. Please sign out and back in.' }, { status: 401 });
  }

  const spreadsheetId = new URL(req.url).searchParams.get('sheetId');
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'sheetId is required' }, { status: 400 });
  }

  try {
    const tabs = await listSheetTabs({ accessToken: session.accessToken, spreadsheetId });
    return NextResponse.json({ tabs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Could not read the spreadsheet' },
      { status: 400 }
    );
  }
}
