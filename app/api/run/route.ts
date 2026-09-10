import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runWorkflow } from '@/lib/workflows';
import type { ReceiptFields, Settings, WorkflowRun, WorkflowType } from '@/lib/types';

export const runtime = 'nodejs';

const VALID_TYPES: WorkflowType[] = ['rename_upload_drive', 'append_sheet_row'];
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as (Session & { accessToken?: string }) | null;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.accessToken) {
    return NextResponse.json({ error: 'No Google access token on session. Please sign out and back in.' }, { status: 401 });
  }

  const formData = await req.formData();

  const fieldsRaw = formData.get('fields');
  const settingsRaw = formData.get('settings');
  const workflowTypesRaw = formData.get('workflowTypes');
  const uploadedAt = formData.get('uploadedAt');
  const file = formData.get('file');

  if (typeof fieldsRaw !== 'string' || typeof settingsRaw !== 'string' || typeof workflowTypesRaw !== 'string') {
    return NextResponse.json({ error: 'Missing fields, settings, or workflowTypes' }, { status: 400 });
  }

  let fields: ReceiptFields;
  let settings: Settings;
  let workflowTypes: WorkflowType[];
  try {
    fields = JSON.parse(fieldsRaw);
    settings = JSON.parse(settingsRaw);
    workflowTypes = JSON.parse(workflowTypesRaw);
  } catch {
    return NextResponse.json({ error: 'fields, settings, and workflowTypes must be valid JSON' }, { status: 400 });
  }

  const invalid = workflowTypes.filter((t) => !VALID_TYPES.includes(t));
  if (workflowTypes.length === 0 || invalid.length > 0) {
    return NextResponse.json({ error: 'workflowTypes must be a non-empty array of valid workflow types' }, { status: 400 });
  }

  if (file instanceof File && file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 4MB)' }, { status: 400 });
  }

  const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : null;

  const results: (WorkflowRun & { workflowType: WorkflowType })[] = [];

  for (const workflowType of workflowTypes) {
    try {
      const { result } = await runWorkflow(workflowType, {
        accessToken: session.accessToken,
        fileBuffer,
        fields,
        settings,
        uploadedAt: typeof uploadedAt === 'string' ? uploadedAt : new Date().toISOString()
      });
      results.push({
        id: randomUUID(),
        workflowType,
        status: 'success',
        result,
        error: null,
        ranAt: new Date().toISOString()
      });
    } catch (err: any) {
      results.push({
        id: randomUUID(),
        workflowType,
        status: 'error',
        result: null,
        error: err?.message ?? 'Unknown error',
        ranAt: new Date().toISOString()
      });
    }
  }

  return NextResponse.json({ runs: results });
}
