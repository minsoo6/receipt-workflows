'use client';

import { useCallback, useRef, useState } from 'react';

export default function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/receipts/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
        onUploaded();
      } catch (err: any) {
        setError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  return (
    <div>
      <div
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: 'pointer' }}
      >
        {uploading ? (
          <span>
            <span className="spinner" style={{ borderTopColor: '#2f6f4f', borderColor: 'rgba(47,111,79,0.3)' }} />{' '}
            Uploading &amp; extracting details…
          </span>
        ) : (
          <span>
            Drop a receipt image or PDF here, or click to choose a file
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
