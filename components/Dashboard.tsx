'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import UploadDropzone from './UploadDropzone';
import SettingsPanel from './SettingsPanel';
import ReceiptCard from './ReceiptCard';
import type { Receipt, Settings, WorkflowRun } from '@/lib/types';

export type ReceiptWithRuns = Receipt & { runs: WorkflowRun[] };

export default function Dashboard({ userEmail }: { userEmail: string | null }) {
  const { data: session } = useSession();
  const [receipts, setReceipts] = useState<ReceiptWithRuns[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [receiptsRes, settingsRes] = await Promise.all([
      fetch('/api/receipts'),
      fetch('/api/settings')
    ]);
    if (receiptsRes.ok) {
      const data = await receiptsRes.json();
      setReceipts(data.receipts);
    }
    if (settingsRes.ok) {
      const data = await settingsRes.json();
      setSettings(data.settings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sessionError = (session as any)?.error as string | undefined;
  const needsDriveOrSheetSetup =
    settings && !settings.driveFolderId && !settings.sheetId;

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Receipt Workflows</h1>
          <div className="sub">{userEmail}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => signOut()}>
          Sign out
        </button>
      </div>

      {sessionError === 'RefreshAccessTokenError' && (
        <div className="error-banner">
          Your Google session expired. Please sign out and sign back in to reauthorize Drive/Sheets
          access.
        </div>
      )}

      {!loading && needsDriveOrSheetSetup && (
        <div className="error-banner" style={{ background: '#fef6e6', color: '#8a6d1f' }}>
          No Drive folder or Sheet configured yet. Open Settings below to set a destination folder
          and/or spreadsheet before running workflows.
        </div>
      )}

      <UploadDropzone onUploaded={refresh} />

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setSettingsOpen((v) => !v)}>
        <span>Workflow settings</span>
        <span>{settingsOpen ? '−' : '+'}</span>
      </div>
      {settingsOpen && settings && (
        <SettingsPanel settings={settings} onSaved={(s) => setSettings(s)} />
      )}

      <div className="section-title">Receipts</div>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : receipts.length === 0 ? (
        <div className="empty-state">No receipts uploaded yet. Drop one above to get started.</div>
      ) : (
        <div className="receipt-list">
          {receipts.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              settings={settings}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
