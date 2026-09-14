'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import UploadDropzone from './UploadDropzone';
import SettingsPanel from './SettingsPanel';
import ReceiptCard from './ReceiptCard';
import { loadHistory, loadSettings, saveHistory, saveSettings } from '@/lib/clientStorage';
import { DEFAULT_SETTINGS } from '@/lib/types';
import type { ReceiptRecord, Settings, WorkflowRun } from '@/lib/types';

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Dashboard({ userEmail }: { userEmail: string | null }) {
  const { data: session } = useSession();
  const [history, setHistory] = useState<ReceiptRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const filesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    setHistory(loadHistory());
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const persistHistory = useCallback((next: ReceiptRecord[]) => {
    setHistory(next);
    saveHistory(next);
  }, []);

  const handleSettingsSaved = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleExtracted = useCallback(
    (file: File, record: Omit<ReceiptRecord, 'id' | 'runs'>) => {
      const id = genId();
      filesRef.current.set(id, file);
      const full: ReceiptRecord = { ...record, id, runs: [] };
      persistHistory([full, ...history]);
    },
    [history, persistHistory]
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ReceiptRecord>) => {
      persistHistory(history.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    },
    [history, persistHistory]
  );

  const handleRuns = useCallback(
    (id: string, runs: WorkflowRun[]) => {
      persistHistory(
        history.map((r) => (r.id === id ? { ...r, runs: [...runs, ...r.runs] } : r))
      );
    },
    [history, persistHistory]
  );

  const handleDelete = useCallback(
    (id: string) => {
      filesRef.current.delete(id);
      persistHistory(history.filter((r) => r.id !== id));
    },
    [history, persistHistory]
  );

  const sessionError = (session as any)?.error as string | undefined;
  const needsDriveOrSheetSetup = loaded && !settings.driveFolderId && !settings.sheetId;

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

      {needsDriveOrSheetSetup && (
        <div className="error-banner" style={{ background: '#fef6e6', color: '#8a6d1f' }}>
          No Drive folder or Sheet configured yet. Open Settings below to set a destination folder
          and/or spreadsheet before running workflows.
        </div>
      )}

      <div className="hint" style={{ marginBottom: 16 }}>
        Receipt history and settings are stored only in this browser (localStorage) — nothing is
        saved on the server. Uploaded files live in memory for this page session only; after a
        reload, re-upload a receipt to run the Drive workflow again (the Sheet workflow still works
        from saved details).
      </div>

      <UploadDropzone onExtracted={handleExtracted} />

      <div
        className="section-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setSettingsOpen((v) => !v)}
      >
        <span>Workflow settings</span>
        <span>{settingsOpen ? '−' : '+'}</span>
      </div>
      {settingsOpen && <SettingsPanel settings={settings} onSaved={handleSettingsSaved} />}

      <div className="section-title">Receipts</div>
      {!loaded ? (
        <div className="empty-state">Loading…</div>
      ) : history.length === 0 ? (
        <div className="empty-state">No receipts uploaded yet. Drop one above to get started.</div>
      ) : (
        <div className="receipt-list">
          {history.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              settings={settings}
              file={filesRef.current.get(receipt.id) ?? null}
              onUpdate={handleUpdate}
              onRuns={handleRuns}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
