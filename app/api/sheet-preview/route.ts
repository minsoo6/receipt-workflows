import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { inspectSheetTab } from '@/lib/google';
import { guessColumnValues } from '@/lib/anthropic';
import { planSheetRow, receiptFieldValues } from '@/lib/sheetMapping';
import type { ReceiptFields, Settings } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as (Session & { accessToken?: string }) | null;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.accessToken) {
    return NextResponse.json({ error: 'No Google access token on session. Please sign out and back in.' }, { status: 401 });
  }

  const body = await req.json();
  const fields = body.fields as ReceiptFields | undefined;
  const settings = body.settings as Settings | undefined;
  const uploadedAt = typeof body.uploadedAt === 'string' ? body.uploadedAt : new Date().toISOString();

  if (!fields || !settings) {
    return NextResponse.json({ error: 'Missing fields or settings' }, { status: 400 });
  }
  if (!settings.sheetId) {
    return NextResponse.json({ error: 'No Google Sheet configured. Set a Sheet ID in Settings.' }, { status: 400 });
  }

  const tabName = settings.sheetTabName || 'Receipts';

  try {
    const { headers, nextRow, sampleRows } = await inspectSheetTab({
      accessToken: session.accessToken,
      spreadsheetId: settings.sheetId,
      tabName,
      headerRow: settings.headerRow
    });

    const values = receiptFieldValues(fields, uploadedAt, settings.dateFormat);
    const plan = planSheetRow(headers, values);

    let guesses: Record<string, string> = {};
    if (body.includeGuesses) {
      // Only columns that name-matching left empty, and only ones that are
      // actually labelled — an unlabelled column has nothing to reason from.
      const columnsToFill = plan.columns
        .filter((column) => column.value === '' && column.header.trim() !== '')
        .map((column) => ({ columnLetter: column.columnLetter, header: column.header }));

      try {
        guesses = await guessColumnValues({
          headers: plan.columns.map((c) => ({ columnLetter: c.columnLetter, header: c.header })),
          sampleRows,
          columnsToFill,
          fields
        });
      } catch {
        // A failed guess shouldn't cost the user the preview itself.
        guesses = {};
      }
    }

    return NextResponse.json({ tabName, nextRow, guesses, ...plan });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Could not read the sheet' },
      { status: 400 }
    );
  }
}
