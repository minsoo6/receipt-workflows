'use client';

import { useState } from 'react';
import type { Settings } from '@/lib/types';
import { DATE_FORMAT_PRESETS, formatDate } from '@/lib/dateFormat';
import { buildFilename } from '@/lib/filename';
import type { ReceiptFields } from '@/lib/types';

const PREVIEW_DATE = '2026-08-31';
const PREVIEW_VENDOR = 'K&F Concept';

// Uses the same builder as the real upload, so the preview can't drift from it.
const PREVIEW_RECEIPT: ReceiptFields = {
  filename: 'IMG_4821.png',
  mimeType: 'image/png',
  vendor: PREVIEW_VENDOR,
  receiptDate: PREVIEW_DATE,
  amount: 24.99,
  currency: 'USD',
  category: 'Office Supplies',
  summary: 'Camera accessories'
};

export default function SettingsPanel({
  settings,
  onSaved
}: {
  settings: Settings;
  onSaved: (settings: Settings) => void;
}) {
  const [form, setForm] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const save = () => {
    onSaved(form);
    setSaved(true);
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
          <label>Date format</label>
          <input value={form.dateFormat} onChange={update('dateFormat')} placeholder="YYYYMMDD" />
          <div className="hint">
            Tokens: YYYY YY MMMM MMM MM M DD D — everything else is kept literally
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {DATE_FORMAT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="btn-secondary"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => {
                  setForm((f) => ({ ...f, dateFormat: preset }));
                  setSaved(false);
                }}
              >
                {formatDate(PREVIEW_DATE, preset)}
              </button>
            ))}
          </div>
        </div>
        <div className="full">
          <label>Preview</label>
          <div
            style={{
              fontSize: 13,
              padding: '8px 10px',
              background: '#f0f0ee',
              borderRadius: 6,
              wordBreak: 'break-all'
            }}
          >
            {buildFilename(form.filenameTemplate, PREVIEW_RECEIPT, form.dateFormat)}
          </div>
          <div className="hint">
            How a receipt dated {PREVIEW_DATE} from {PREVIEW_VENDOR} would be named
          </div>
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
        <button className="btn" onClick={save}>
          Save settings
        </button>
        {saved && <span className="hint">Saved to this browser</span>}
      </div>
    </div>
  );
}
