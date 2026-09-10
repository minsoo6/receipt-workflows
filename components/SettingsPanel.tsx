'use client';

import { useState } from 'react';
import type { Settings } from '@/lib/types';

export default function SettingsPanel({
  settings,
  onSaved
}: {
  settings: Settings;
  onSaved: (settings: Settings) => void;
}) {
  const [form, setForm] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      onSaved(data.settings);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="settings-grid">
        <div>
          <label>Google Drive folder ID</label>
          <input
            value={form.driveFolderId}
            onChange={update('driveFolderId')}
            placeholder="1AbCdEfGhIjKlmNoPqRsTuVwXyZ"
          />
          <div className="hint">From the folder&apos;s URL: drive.google.com/drive/folders/&lt;ID&gt;</div>
        </div>
        <div>
          <label>Filename template</label>
          <input value={form.filenameTemplate} onChange={update('filenameTemplate')} />
          <div className="hint">Tokens: {'{date} {vendor} {amount} {currency} {original}'}</div>
        </div>
        <div>
          <label>Google Sheet ID</label>
          <input
            value={form.sheetId}
            onChange={update('sheetId')}
            placeholder="1AbCdEfGhIjKlmNoPqRsTuVwXyZ"
          />
          <div className="hint">From the sheet&apos;s URL: docs.google.com/spreadsheets/d/&lt;ID&gt;</div>
        </div>
        <div>
          <label>Sheet tab name</label>
          <input value={form.sheetTabName} onChange={update('sheetTabName')} placeholder="Receipts" />
          <div className="hint">A header row is added automatically if the tab is empty</div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="hint">Saved</span>}
      </div>
    </div>
  );
}
