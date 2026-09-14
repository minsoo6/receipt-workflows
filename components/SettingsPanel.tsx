'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/lib/types';
import { DATE_FORMAT_PRESETS, formatDate } from '@/lib/dateFormat';
import { buildFilename } from '@/lib/filename';
import type { ReceiptFields } from '@/lib/types';
import DrivePicker from './DrivePicker';
import HeaderRowPicker from './HeaderRowPicker';

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
  const [picker, setPicker] = useState<'folder' | 'spreadsheet' | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [tabsError, setTabsError] = useState<string | null>(null);

  const update = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const loadTabs = useCallback(async (sheetId: string) => {
    if (!sheetId) {
      setTabs([]);
      setTabsError(null);
      return;
    }
    try {
      const res = await fetch(`/api/drive/tabs?sheetId=${encodeURIComponent(sheetId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read the spreadsheet');
      const loaded = data.tabs as string[];
      setTabs(loaded);
      setTabsError(null);
      // Picking a new spreadsheet clears the tab, so land on a real one rather
      // than leaving the select showing a value the form doesn't hold.
      setForm((f) => (f.sheetTabName || loaded.length === 0 ? f : { ...f, sheetTabName: loaded[0] }));
    } catch (err: any) {
      setTabs([]);
      setTabsError(err.message || 'Could not read the spreadsheet');
    }
  }, []);

  useEffect(() => {
    loadTabs(form.sheetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sheetId]);

  const save = () => {
    onSaved(form);
    setSaved(true);
  };

  return (
    <div className="card">
      <div className="settings-grid">
        <div>
          <label>Destination folder in Google Drive</label>
          <div className="chooser">
            <div className="chooser-value">
              {form.driveFolderId ? (
                <>
                  <span className="chooser-icon">📁</span>
                  <span className="chooser-name">{form.driveFolderName || form.driveFolderId}</span>
                </>
              ) : (
                <span className="chooser-empty">No folder chosen</span>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary chooser-btn"
              onClick={() => setPicker('folder')}
            >
              {form.driveFolderId ? 'Change' : 'Choose'}
            </button>
          </div>
          <div className="hint">Receipts are uploaded here by the Drive workflow</div>
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
          <label>Google Sheet</label>
          <div className="chooser">
            <div className="chooser-value">
              {form.sheetId ? (
                <>
                  <span className="chooser-icon">📊</span>
                  <span className="chooser-name">{form.sheetName || form.sheetId}</span>
                </>
              ) : (
                <span className="chooser-empty">No spreadsheet chosen</span>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary chooser-btn"
              onClick={() => setPicker('spreadsheet')}
            >
              {form.sheetId ? 'Change' : 'Choose'}
            </button>
          </div>
          <div className="hint">Rows are added to this spreadsheet by the Sheet workflow</div>
        </div>
        <div>
          <label>Sheet tab</label>
          {tabs.length > 0 ? (
            <select
              value={form.sheetTabName}
              onChange={(e) => {
                setForm((f) => ({ ...f, sheetTabName: e.target.value }));
                setSaved(false);
              }}
            >
              {!tabs.includes(form.sheetTabName) && form.sheetTabName && (
                <option value={form.sheetTabName}>{form.sheetTabName} (not in this sheet)</option>
              )}
              {tabs.map((tab) => (
                <option key={tab} value={tab}>
                  {tab}
                </option>
              ))}
            </select>
          ) : (
            <input value={form.sheetTabName} onChange={update('sheetTabName')} placeholder="Receipts" />
          )}
          <div className="hint">
            {tabsError
              ? tabsError
              : tabs.length > 0
                ? 'Tabs read from the selected spreadsheet'
                : 'Choose a spreadsheet to list its tabs'}
          </div>
        </div>
        <div className="full">
          <label>Header row — which row holds your column names</label>
          <HeaderRowPicker
            sheetId={form.sheetId}
            tabName={form.sheetTabName}
            headerRow={form.headerRow}
            onChange={(row) => {
              setForm((f) => ({ ...f, headerRow: row }));
              setSaved(false);
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn" onClick={save}>
          Save settings
        </button>
        {saved && <span className="hint">Saved to this browser</span>}
      </div>

      {picker === 'folder' && (
        <DrivePicker
          type="folder"
          title="Choose a Drive folder for receipts"
          onClose={() => setPicker(null)}
          onSelect={(item) => {
            setForm((f) => ({ ...f, driveFolderId: item.id, driveFolderName: item.name }));
            setSaved(false);
            setPicker(null);
          }}
        />
      )}

      {picker === 'spreadsheet' && (
        <DrivePicker
          type="spreadsheet"
          title="Choose a spreadsheet to log receipts in"
          onClose={() => setPicker(null)}
          onSelect={(item) => {
            // Tab name and header row belong to the old sheet's layout — reset
            // so the reloaded tab list and row grid apply to the new one.
            setForm((f) => ({
              ...f,
              sheetId: item.id,
              sheetName: item.name,
              sheetTabName: '',
              headerRow: 1
            }));
            setSaved(false);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
