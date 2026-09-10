import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getReceipt, getSettings, insertWorkflowRun, listWorkflowRunsForReceipt } from '@/lib/db';
import { runWorkflow } from '@/lib/workflows';
import type { WorkflowType } from '@/lib/types';

export const runtime = 'nodejs';

const VALID_TYPES: WorkflowType[] = ['rename_upload_drive', 'append_sheet_row'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as (Session & { accessToken?: string }) | null;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.accessToken) {
    return NextResponse.json({ error: 'No Google access token on session. Please sign out and back in.' }, { status: 401 });
  }

  const receipt = getReceipt(params.id);
  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

  const body = await req.json();
  const workflowTypes: WorkflowType[] = Array.isArray(body.workflowTypes) ? body.workflowTypes : [];
  const invalid = workflowTypes.filter((t) => !VALID_TYPES.includes(t));
  if (workflowTypes.length === 0 || invalid.length > 0) {
    return NextResponse.json({ error: 'workflowTypes must be a non-empty array of valid workflow types' }, { status: 400 });
  }

  const settings = getSettings();
  const results = [];

  for (const workflowType of workflowTypes) {
    const runId = randomUUID();
    try {
      const { result } = await runWorkflow(workflowType, {
        accessToken: session.accessToken,
        receipt,
        settings
      });
      insertWorkflowRun({
        id: runId,
        receiptId: receipt.id,
        workflowType,
        status: 'success',
        result,
        error: null,
        ranAt: new Date().toISOString()
      });
      results.push({ workflowType, status: 'success', result });
    } catch (err: any) {
      const message = err?.message ?? 'Unknown error';
      insertWorkflowRun({
        id: runId,
        receiptId: receipt.id,
        workflowType,
        status: 'error',
        result: null,
        error: message,
        ranAt: new Date().toISOString()
      });
      results.push({ workflowType, status: 'error', error: message });
    }
  }

  return NextResponse.json({ results, runs: listWorkflowRunsForReceipt(receipt.id) });
}
