'use client';

import { useState } from 'react';
import type { ReceiptWithRuns } from './Dashboard';
import type { Settings, WorkflowType } from '@/lib/types';
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
  onChanged
}: {
  receipt: ReceiptWithRuns;
  settings: Settings | null;
  onChanged: () => void;
}) {
  const [fields, setFields] = useState({
    vendor: receipt.vendor ?? '',
    receiptDate: receipt.receiptDate ?? '',
    amount: receipt.amount != null ? String(receipt.amount) : '',
    currency: receipt.currency ?? '',
    category: receipt.category ?? ''
  });
  const [dirty, setDirty] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [selected, setSelected] = useState<Set<WorkflowType>>(new Set());
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isImage = receipt.mimeType.startsWith('image/');

  const updateField = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    setDirty(true);
  };

  const saveFields = async () => {
    setSavingFields(true);
    try {
      await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: fields.vendor || null,
          receiptDate: fields.receiptDate || null,
          amount: fields.amount ? Number(fields.amount) : null,
          currency: fields.currency || null,
          category: fields.category || null
        })
      });
      setDirty(false);
      onChanged();
    } finally {
      setSavingFields(false);
    }
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
    try {
      if (dirty) await saveFields();
      await fetch(`/api/receipts/${receipt.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowTypes: Array.from(selected) })
      });
      onChanged();
    } finally {
      setRunning(false);
    }
  };

  const deleteReceipt = async () => {
    if (!confirm(`Delete "${receipt.filename}"? This cannot be undone.`)) return;
    await fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' });
    onChanged();
  };

  return (
    <div className="card receipt-card">
      <div className="receipt-thumb">
        {isImage ? (
          <img src={`/api/receipts/${receipt.id}/file`} alt={receipt.filename} />
        ) : (
          'PDF'
        )}
      </div>
      <div className="receipt-main">
        <div className="receipt-top-row">
          <div>
            <div className="receipt-title">{receipt.filename}</div>
            <div className="receipt-meta">
              {formatBytes(receipt.size)} · {new Date(receipt.uploadedAt).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge badge-${receipt.status}`}>{receipt.status.replace('_', ' ')}</span>
            <button className="btn-danger" onClick={deleteReceipt} title="Delete receipt">
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
                <input value={fields.vendor} onChange={updateField('vendor')} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={fields.receiptDate} onChange={updateField('receiptDate')} />
              </div>
              <div>
                <label>Amount</label>
                <input type="number" step="0.01" value={fields.amount} onChange={updateField('amount')} />
              </div>
              <div>
                <label>Currency</label>
                <input value={fields.currency} onChange={updateField('currency')} placeholder="USD" />
              </div>
              <div>
                <label>Category</label>
                <input value={fields.category} onChange={updateField('category')} />
              </div>
            </div>
            {dirty && (
              <button
                className="btn-secondary"
                style={{ marginTop: 8, fontSize: 12, padding: '4px 10px' }}
                onClick={saveFields}
                disabled={savingFields}
              >
                {savingFields ? 'Saving…' : 'Save changes'}
              </button>
            )}

            <div className="workflow-row">
              {WORKFLOW_TYPES.map((type) => (
                <label className="workflow-checkbox" key={type}>
                  <input
                    type="checkbox"
                    checked={selected.has(type)}
                    onChange={() => toggleWorkflow(type)}
                  />
                  {WORKFLOW_LABELS[type]}
                </label>
              ))}
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
