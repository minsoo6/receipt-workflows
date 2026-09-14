'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReceiptRecord, Settings, WorkflowRun, WorkflowType } from '@/lib/types';
import { WORKFLOW_LABELS } from '@/lib/workflowLabels';

const WORKFLOW_TYPES: WorkflowType[] = ['rename_upload_drive', 'append_sheet_row'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReceiptCard({
  receipt,
  settings,
  file,
  onUpdate,
  onRuns,
  onDelete
}: {
  receipt: ReceiptRecord;
  settings: Settings;
  file: File | null;
  onUpdate: (id: string, updates: Partial<ReceiptRecord>) => void;
  onRuns: (id: string, runs: WorkflowRun[]) => void;
  onDelete: (id: string) => void;
}) {
  const [fields, setFields] = useState({
    vendor: receipt.vendor ?? '',
    receiptDate: receipt.receiptDate ?? '',
    amount: receipt.amount != null ? String(receipt.amount) : '',
    currency: receipt.currency ?? '',
    category: receipt.category ?? ''
  });
  const [selected, setSelected] = useState<Set<WorkflowType>>(new Set());
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isImage = receipt.mimeType.startsWith('image/');
  const objectUrl = useMemo(() => {
    if (file && isImage) return URL.createObjectURL(file);
    return null;
  }, [file, isImage]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const updateField = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
  };

  const currentFieldValues = () => ({
    vendor: fields.vendor || null,
    receiptDate: fields.receiptDate || null,
    amount: fields.amount ? Number(fields.amount) : null,
    currency: fields.currency || null,
    category: fields.category || null
  });

  const saveFields = () => {
    onUpdate(receipt.id, currentFieldValues());
  };

  const toggleWorkflow = (type: WorkflowType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const runWorkflows = async () => {
    if (selected.size === 0) return;
    setRunning(true);
    setRunError(null);
    const finalFields = currentFieldValues();
    onUpdate(receipt.id, finalFields);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append(
        'fields',
        JSON.stringify({
          filename: receipt.filename,
          mimeType: receipt.mimeType,
          ...finalFields,
          summary: receipt.summary
        })
      );
      formData.append('settings', JSON.stringify(settings));
      formData.append('workflowTypes', JSON.stringify(Array.from(selected)));
      formData.append('uploadedAt', receipt.uploadedAt);

      const res = await fetch('/api/run', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run workflows');

      onRuns(receipt.id, data.runs as WorkflowRun[]);
    } catch (err: any) {
      setRunError(err.message || 'Failed to run workflows');
    } finally {
      setRunning(false);
    }
  };

  const deleteReceipt = () => {
    if (!confirm(`Remove "${receipt.filename}" from your history? This cannot be undone.`)) return;
    onDelete(receipt.id);
  };

  return (
    <div className="card receipt-card">
      <div className="receipt-thumb">
        {objectUrl ? <img src={objectUrl} alt={receipt.filename} /> : receipt.mimeType === 'application/pdf' ? 'PDF' : '—'}
      </div>
      <div className="receipt-main">
        <div className="receipt-top-row">
          <div>
            <div className="receipt-title">{receipt.filename}</div>
            <div className="receipt-meta">
              {formatBytes(receipt.size)} · {new Date(receipt.uploadedAt).toLocaleString()}
              {!file && ' · file not in this session'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge badge-${receipt.status}`}>{receipt.status.replace('_', ' ')}</span>
            <button className="btn-danger" onClick={deleteReceipt} title="Remove from history">
              Delete
            </button>
          </div>
        </div>

        {receipt.summary && receipt.status !== 'extraction_failed' && (
          <div className="receipt-meta" style={{ marginTop: 6 }}>{receipt.summary}</div>
        )}
        {receipt.status === 'extraction_failed' && (
          <div className="error-banner" style={{ marginTop: 8 }}>{receipt.summary}</div>
        )}

        <button
          className="btn-secondary"
          style={{ marginTop: 10, fontSize: 12, padding: '4px 10px' }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide details' : 'Edit details & run workflows'}
        </button>

        {expanded && (
          <>
            <div className="field-grid">
              <div>
                <label>Vendor</label>
                <input value={fields.vendor} onChange={updateField('vendor')} onBlur={saveFields} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={fields.receiptDate} onChange={updateField('receiptDate')} onBlur={saveFields} />
              </div>
              <div>
                <label>Amount</label>
                <input type="number" step="0.01" value={fields.amount} onChange={updateField('amount')} onBlur={saveFields} />
              </div>
              <div>
                <label>Currency</label>
                <input value={fields.currency} onChange={updateField('currency')} onBlur={saveFields} placeholder="USD" />
              </div>
              <div>
                <label>Category</label>
                <input value={fields.category} onChange={updateField('category')} onBlur={saveFields} />
              </div>
            </div>

            <div className="workflow-row">
              {WORKFLOW_TYPES.map((type) => {
                const disabled = type === 'rename_upload_drive' && !file;
                return (
                  <label
                    className="workflow-checkbox"
                    key={type}
                    style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    title={disabled ? 'Original file not available in this session — re-upload to use this workflow' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(type)}
                      disabled={disabled}
                      onChange={() => toggleWorkflow(type)}
                    />
                    {WORKFLOW_LABELS[type]}
                  </label>
                );
              })}
              <button className="btn" onClick={runWorkflows} disabled={running || selected.size === 0}>
                {running ? (
                  <>
                    <span className="spinner" /> Running…
                  </>
                ) : (
                  'Run selected workflows'
                )}
              </button>
            </div>

            {runError && <div className="error-banner" style={{ marginTop: 8 }}>{runError}</div>}

            {receipt.runs.length > 0 && (
              <div className="run-log">
                {receipt.runs.map((run) => (
                  <div key={run.id}>
                    <span className={`badge badge-${run.status}`}>{run.status}</span>{' '}
                    <strong>{WORKFLOW_LABELS[run.workflowType]}</strong> —{' '}
                    {run.status === 'success' ? run.result : run.error} ·{' '}
                    {new Date(run.ranAt).toLocaleString()}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
