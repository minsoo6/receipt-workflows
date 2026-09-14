'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReceiptRecord } from '@/lib/types';

export default function UploadDropzone({
  onExtracted
}: {
  onExtracted: (file: File, record: Omit<ReceiptRecord, 'id' | 'runs'>) => void;
}) {
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
        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        if (data.status === 'extraction_failed') {
          onExtracted(file, {
            filename: data.filename,
            mimeType: data.mimeType,
            size: data.size,
            uploadedAt: new Date().toISOString(),
            vendor: null,
            receiptDate: null,
            amount: null,
            currency: null,
            category: null,
            summary: `Extraction failed: ${data.error}`,
            status: 'extraction_failed'
          });
        } else {
          onExtracted(file, {
            filename: data.filename,
            mimeType: data.mimeType,
            size: data.size,
            uploadedAt: new Date().toISOString(),
            vendor: data.vendor,
            receiptDate: data.date,
            amount: data.amount,
            currency: data.currency,
            category: data.category,
            summary: data.summary,
            status: 'extracted'
          });
        }
      } catch (err: any) {
        setError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onExtracted]
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
          <span>Drop a receipt image or PDF here, or click to choose a file (max 4MB)</span>
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
