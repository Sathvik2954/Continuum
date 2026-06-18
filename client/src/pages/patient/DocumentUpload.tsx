import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IconArrowLeft, IconFileText, IconCircleCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import syncEngine from '../../lib/syncEngine';

export const DocumentUpload = () => {
  const [fileName, setFileName] = useState('');
  const [documentType, setDocumentType] = useState<'LAB_REPORT' | 'PRESCRIPTION_SCAN' | 'IMAGING' | 'REFERRAL' | 'OTHER'>('LAB_REPORT');
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Size check: limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }

    setFileName(file.name);
    setFileBlob(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!fileBlob || !fileName) {
      setError('Please select a document scan to upload.');
      setLoading(false);
      return;
    }

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) throw new Error('User session expired');
      const user = JSON.parse(storedUser);

      const documentPayload = {
        patientId: user.id,
        documentType,
        fileName,
        fileSizeKb: Math.round(fileBlob.size / 1024),
        updatedAt: new Date().toISOString(),
      };

      // Queue in Sync Engine (Uploads blob then registers metadata)
      await syncEngine.queueItem(
        'document',
        documentPayload,
        'fileUrl',
        fileBlob
      );

      const isOffline = !navigator.onLine;
      if (isOffline) {
        setSuccess('Document saved offline. Upload will trigger when online.');
      } else {
        setSuccess('Document upload initiated successfully.');
      }

      setTimeout(() => {
        navigate('/patient/timeline');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to upload document:', err);
      setError('Failed to process document upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="bg-white rounded-xl border border-mist-100 p-6 md:p-8">

        <div className="flex items-center space-x-3 mb-6">
          <Link
            to="/patient/timeline"
            className="p-2 bg-mist-50 border border-mist-100 rounded-lg hover:bg-mist-100 text-mist-600 transition-colors flex items-center justify-center cursor-pointer"
          >
            <IconArrowLeft size={16} stroke={1.5} />
          </Link>
          <div>
            <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Upload Clinical Document</h2>
            <p className="text-[14px] text-mist-600 mt-1">Save lab results, prescriptions, or imaging reports securely.</p>
          </div>
        </div>

        {success && (
          <div className="mb-6 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconCircleCheck size={16} stroke={1.5} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconAlertTriangle size={16} stroke={1.5} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Picker */}
          <div>
            <label className="form-label">Select File (PDF, PNG, JPG - Max 10MB)</label>
            <div className="mt-2 flex items-center justify-center border border-dashed border-mist-200 hover:border-mist-400 rounded-xl p-6 transition-all bg-mist-50/50">
              <div className="text-center space-y-2">
                <IconFileText size={32} stroke={1.5} className="text-mist-200 mx-auto" />
                <div className="flex items-center text-xs text-mist-600 gap-1.5">
                  <label className="relative cursor-pointer bg-white border border-mist-200 hover:border-mist-400 text-mist-600 px-3 py-1.5 rounded-[4px] font-medium transition-all">
                    <span>Choose File</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      disabled={loading}
                    />
                  </label>
                  <span>or drag and drop</span>
                </div>
                {fileName && (
                  <p className="text-xs text-mist-800 font-medium truncate max-w-sm mt-2">
                    Selected: {fileName} ({fileBlob ? Math.round(fileBlob.size / 1024) : 0} KB)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Document Type */}
          <div>
            <label className="form-label">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as any)}
              className="form-input"
              disabled={loading}
            >
              <option value="LAB_REPORT">Lab Report</option>
              <option value="PRESCRIPTION_SCAN">Prescription Scan</option>
              <option value="IMAGING">Imaging (X-Ray, MRI, etc.)</option>
              <option value="REFERRAL">Referral Letter</option>
              <option value="OTHER">Other Documents</option>
            </select>
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2.5 px-6 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <IconLoader2 size={16} stroke={1.5} className="ti-spin" />
                  <span>Uploading Document...</span>
                </>
              ) : (
                <>
                  <IconFileText size={16} stroke={1.5} />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentUpload;
