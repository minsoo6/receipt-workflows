'use client';

import { useCallback, useEffect, useState } from 'react';

interface DriveItem {
  id: string;
  name: string;
  modifiedTime: string | null;
}

interface Crumb {
  id: string;
  name: string;
}

export default function DrivePicker({
  type,
  title,
  onSelect,
  onClose
}: {
  type: 'folder' | 'spreadsheet';
  title: string;
  onSelect: (item: DriveItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: 'root', name: 'My Drive' }]);
  const [highlighted, setHighlighted] = useState<DriveItem | null>(null);

  const currentParent = crumbs[crumbs.length - 1];
  const searching = search.trim().length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, parent: currentParent.id });
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/drive/browse?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read from Google Drive');
      setItems(data.items as DriveItem[]);
    } catch (err: any) {
      setError(err.message || 'Could not read from Google Drive');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, currentParent.id, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openFolder = (item: DriveItem) => {
    setSearch('');
    setHighlighted(null);
    setCrumbs((c) => [...c, { id: item.id, name: item.name }]);
  };

  const goToCrumb = (index: number) => {
    setSearch('');
    setHighlighted(null);
    setCrumbs((c) => c.slice(0, index + 1));
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <strong>{title}</strong>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 9px' }} onClick={onClose}>
            Cancel
          </button>
        </div>

        <input
          className="picker-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={type === 'folder' ? 'Search all folders…' : 'Search spreadsheets…'}
        />

        {type === 'folder' && !searching && (
          <div className="picker-crumbs">
            {crumbs.map((crumb, index) => (
              <span key={crumb.id}>
                {index > 0 && <span className="picker-crumb-sep">/</span>}
                <button
                  className="picker-crumb"
                  onClick={() => goToCrumb(index)}
                  disabled={index === crumbs.length - 1}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="picker-list">
          {loading && <div className="picker-empty">Loading…</div>}
          {error && <div className="error-banner">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="picker-empty">
              {searching ? 'No matches.' : type === 'folder' ? 'No subfolders here.' : 'No spreadsheets found.'}
            </div>
          )}
          {!loading &&
            !error &&
            items.map((item) => (
              <div
                key={item.id}
                className={`picker-item ${highlighted?.id === item.id ? 'picker-item-active' : ''}`}
                onClick={() => setHighlighted(item)}
                onDoubleClick={() => (type === 'folder' ? openFolder(item) : onSelect(item))}
              >
                <span className="picker-icon">{type === 'folder' ? '📁' : '📊'}</span>
                <span className="picker-name">{item.name}</span>
                {type === 'folder' && (
                  <button
                    className="btn-secondary picker-open"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFolder(item);
                    }}
                  >
                    Open
                  </button>
                )}
              </div>
            ))}
        </div>

        <div className="picker-footer">
          <div className="picker-selection">
            {highlighted
              ? `Selected: ${highlighted.name}`
              : type === 'folder' && !searching
                ? `Nothing selected — you can also use "${currentParent.name}" itself`
                : 'Nothing selected'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {type === 'folder' && !searching && currentParent.id !== 'root' && (
              <button
                className="btn-secondary"
                onClick={() => onSelect({ id: currentParent.id, name: currentParent.name, modifiedTime: null })}
              >
                Use this folder
              </button>
            )}
            <button className="btn" disabled={!highlighted} onClick={() => highlighted && onSelect(highlighted)}>
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
