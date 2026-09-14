'use client';

import { useEffect, useState } from 'react';
import { columnLetter } from '@/lib/sheetMapping';

export default function HeaderRowPicker({
  sheetId,
  tabName,
  headerRow,
  onChange
}: {
  sheetId: string;
  tabName: string;
  headerRow: number;
  onChange: (row: number) => void;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sheetId || !tabName) {
      setRows([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const params = new URLSearchParams({ sheetId, tab: tabName });
        const res = await fetch(`/api/drive/sheet-rows?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Could not read the sheet');
        setRows(data.rows as string[][]);
      } catch (err: any) {
        if (cancelled) return;
        setRows([]);
        setError(err.message || 'Could not read the sheet');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sheetId, tabName]);

  if (!sheetId || !tabName) {
    return <div className="hint">Choose a spreadsheet and tab to pick the header row.</div>;
  }

  if (loading) return <div className="hint">Reading the first rows…</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (rows.length === 0) return <div className="hint">This tab looks empty.</div>;

  const width = rows[0]?.length ?? 0;

  return (
    <div>
      <div className="preview-table-wrap">
        <table className="preview-table headerrow-table">
          <thead>
            <tr>
              <th />
              {Array.from({ length: width }, (_, i) => (
                <th key={i} className="preview-col-letter">
                  {columnLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowNumber = index + 1;
              const isHeader = rowNumber === headerRow;
              const blank = row.every((cell) => cell.trim() === '');
              return (
                <tr
                  key={rowNumber}
                  className={`headerrow-row ${isHeader ? 'headerrow-selected' : ''}`}
                  onClick={() => onChange(rowNumber)}
                  title={`Use row ${rowNumber} as the column headers`}
                >
                  <td className="headerrow-num">
                    <input type="radio" checked={isHeader} onChange={() => onChange(rowNumber)} />
                    {rowNumber}
                  </td>
                  {Array.from({ length: width }, (_, i) => (
                    <td key={i} className={blank ? 'preview-untouched' : ''}>
                      {row[i] || ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint" style={{ marginTop: 6 }}>
        Click the row holding your column names. Receipts are added below the last row with
        content, never on or above row {headerRow}.
      </div>
    </div>
  );
}
