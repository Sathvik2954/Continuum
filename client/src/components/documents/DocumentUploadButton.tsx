import React, { useState, useRef } from 'react';
import { compressImage } from '../../lib/compressImage';
import api from '../../lib/apiClient';
import { queueItem } from '../../lib/syncEngine';

const DOC_TYPES = [
  { value: 'LAB_REPORT', label: 'Lab report' },
  { value: 'PRESCRIPTION_SCAN', label: 'Prescription scan' },
  { value: 'IMAGING', label: 'Imaging (X-ray, MRI, etc.)' },
  { value: 'REFERRAL', label: 'Referral letter' },
  { value: 'OTHER', label: 'Other' },
] as const;

interface Props {
  onUploaded: () => void;
}

export const DocumentUploadButton: React.FC<Props> = ({ onUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('LAB_REPORT');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setError('');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setError('');

    try {
      let uploadBlob: Blob = pendingFile;
      let fileName = pendingFile.name;

      // Compress images client-side; leave PDFs as-is
      if (pendingFile.type.startsWith('image/')) {
        uploadBlob = await compressImage(pendingFile, 300);
        fileName = pendingFile.name.replace(/\.[^.]+$/, '.jpg');
      }

      if (!navigator.onLine) {
        const fileBase64 = await blobToBase64(uploadBlob);
        await queueItem('document', {
          fileBase64,
          fileName,
          documentType: docType,
        });
        alert('You are offline. Your document has been saved locally and will sync when you reconnect.');
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onUploaded();
        return;
      }

      const formData = new FormData();
      formData.append('file', uploadBlob, fileName);
      formData.append('documentType', docType);

      await api.post('/documents/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploaded();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-subtle rounded-md p-4">
      {error && (
        <div className="text-[12px] text-[#991B1B] mb-2">{error}</div>
      )}

      {!pendingFile ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-[13px] font-medium text-sky-600 py-2"
        >
          📎 Tap to upload a document or photo
        </button>
      ) : (
        <div className="space-y-3">
          <div className="text-[13px] text-sky-900 truncate">
            {pendingFile.name} · {Math.round(pendingFile.size / 1024)}KB
          </div>

          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="glass-input w-full h-9 px-2.5 text-[13px] text-sky-900"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="flex-1 h-9 rounded-sm text-[12px] glass text-[#78716C]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 h-9 rounded-sm text-[12px] font-medium text-cream-50 disabled:opacity-50"
              style={{ background: 'rgba(14,165,233,0.75)', border: '0.5px solid rgba(255,255,255,0.45)' }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
