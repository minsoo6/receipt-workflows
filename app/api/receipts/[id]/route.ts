import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteReceipt, getReceipt, listWorkflowRunsForReceipt, updateReceiptExtraction } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const receipt = getReceipt(params.id);
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ receipt: { ...receipt, runs: listWorkflowRunsForReceipt(receipt.id) } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const receipt = getReceipt(params.id);
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const allowed = ['vendor', 'receiptDate', 'amount', 'currency', 'category', 'summary'] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  updateReceiptExtraction(params.id, update);
  return NextResponse.json({ receipt: getReceipt(params.id) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const receipt = getReceipt(params.id);
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await fs.rm(receipt.storedPath, { force: true });
  deleteReceipt(params.id);

  return NextResponse.json({ ok: true });
}
