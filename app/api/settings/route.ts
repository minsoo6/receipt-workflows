import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  return NextResponse.json({ settings: getSettings() });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const allowed = ['driveFolderId', 'driveFolderName', 'filenameTemplate', 'sheetId', 'sheetName', 'sheetTabName'];
  const update: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body[key] === 'string') update[key] = body[key];
  }

  saveSettings(update);
  return NextResponse.json({ settings: getSettings() });
}
