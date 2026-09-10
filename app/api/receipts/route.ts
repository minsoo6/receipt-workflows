import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listReceipts, listWorkflowRunsForReceipt } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const receipts = listReceipts();
  const withRuns = receipts.map((receipt) => ({
    ...receipt,
    runs: listWorkflowRunsForReceipt(receipt.id)
  }));

  return NextResponse.json({ receipts: withRuns });
}
