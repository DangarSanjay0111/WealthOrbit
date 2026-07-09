import { useState, useRef } from 'react';
import { useFamily } from '../../context/FamilyContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDate, assetTypeLabels } from '../../utils/formatters';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';

export default function UploadPage() {
  const { activeFamily } = useFamily();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [confirming, setConfirming] = useState(false);

  const ACCEPTED_EXT = ['.pdf', '.csv', '.xlsx', '.xls', '.txt'];

  const handleFile = (f) => {
    if (f && ACCEPTED_EXT.some(ext => f.name.toLowerCase().endsWith(ext))) {
      setFile(f);
      setResult(null);
    } else {
      showError('Please upload a PDF, CSV, Excel (.xlsx/.xls) or text file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const handleUpload = async () => {
    if (!file || !activeFamily) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('report', file);
      formData.append('familyId', activeFamily._id);
      const { data } = await api.post('/upload/demat-report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(data);
      success('Report processed! Review the extracted data below.');
    } catch (err) {
      showError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!result?.uploadId) return;
    setConfirming(true);
    try {
      const { data } = await api.post(`/upload/${result.uploadId}/confirm`);
      success(`Imported ${data.transactionsCreated} transactions. Your portfolio now holds ${data.holdingsCreated} position${data.holdingsCreated === 1 ? '' : 's'}.`);
      setResult(null);
      setFile(null);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to import data.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><UploadIcon size={28} /> Upload Report</h1>
          <p className="page-subtitle">Upload your Demat account statement and let AI extract your holdings</p>
        </div>
      </div>

      {/* Upload Zone */}
      {!result && (
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.txt" hidden onChange={e => handleFile(e.target.files[0])} />
          <div className="drop-zone-icon"><UploadIcon size={28} /></div>
          {file ? (
            <>
              <p className="font-semibold">{file.name}</p>
              <p className="text-sm text-secondary">{(file.size / 1024).toFixed(1)} KB — Ready to upload</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Drag & drop your Demat report here</p>
              <p className="text-sm text-secondary">or click to browse — Supports PDF, CSV, Excel (.xlsx/.xls)</p>
            </>
          )}
        </div>
      )}

      {file && !result && (
        <div className="flex justify-center mt-6 gap-3">
          <button className="btn btn-ghost" onClick={() => { setFile(null); setResult(null); }}>Cancel</button>
          <button className="btn btn-primary btn-lg" onClick={handleUpload} disabled={uploading}>
            {uploading ? <><span className="spinner" /> Processing with AI...</> : <><UploadIcon size={16} /> Upload & Process</>}
          </button>
        </div>
      )}

      {/* Processing Animation */}
      {uploading && (
        <div className="card mt-6" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <Loader size={40} className="animate-pulse" style={{ color: 'var(--primary)', margin: '0 auto var(--space-4)', animation: 'spin 2s linear infinite' }} />
          <h3 className="text-lg font-semibold mb-2">AI is analyzing your report...</h3>
          <p className="text-secondary text-sm">Extracting holdings, transactions, and portfolio data using Gemini AI</p>
        </div>
      )}

      {/* Results Preview */}
      {result?.extractedData && (
        <div className="mt-6">
          <div className="card mb-4" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle size={24} style={{ color: 'var(--accent)' }} />
              <div>
                <h3 className="font-semibold">Extraction Complete</h3>
                <p className="text-sm text-secondary">
                  Found {result.extractedData.transactions?.length || 0} transactions
                  {' '}({result.extractedData.transactions?.filter(t => t.type === 'buy').length || 0} buy,
                  {' '}{result.extractedData.transactions?.filter(t => t.type === 'sell').length || 0} sell).
                  Sells will be netted against buys when you import.
                </p>
              </div>
            </div>
          </div>

          {/* Holdings Preview */}
          {result.extractedData.holdings?.length > 0 && (
            <div className="card mb-4">
              <h3 className="card-title mb-4">Extracted Holdings</h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Qty</th><th>Avg Price</th><th>Value</th></tr></thead>
                  <tbody>
                    {result.extractedData.holdings.map((h, i) => (
                      <tr key={i}>
                        <td className="font-medium">{h.name}<br /><span className="text-xs text-secondary">{h.symbol}</span></td>
                        <td><span className="badge badge-neutral">{assetTypeLabels[h.assetType] || h.assetType}</span></td>
                        <td>{h.quantity}</td>
                        <td>{formatCurrency(h.avgBuyPrice)}</td>
                        <td className="font-semibold">{formatCurrency(h.currentValue || h.quantity * h.avgBuyPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions Preview */}
          {result.extractedData.transactions?.length > 0 && (
            <div className="card mb-4">
              <h3 className="card-title mb-4">Extracted Transactions</h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {result.extractedData.transactions.map((t, i) => (
                      <tr key={i}>
                        <td>{t.date}</td>
                        <td className="font-medium">{t.name}</td>
                        <td><span className={`badge ${t.type === 'buy' ? 'badge-success' : 'badge-danger'}`}>{t.type?.toUpperCase()}</span></td>
                        <td>{t.quantity}</td>
                        <td>{formatCurrency(t.price)}</td>
                        <td className="font-semibold">{formatCurrency(t.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 mt-6">
            <button className="btn btn-ghost" onClick={() => { setResult(null); setFile(null); }}>Discard</button>
            <button className="btn btn-accent btn-lg" onClick={handleConfirm} disabled={confirming}>
              {confirming ? <><span className="spinner" /> Importing...</> : <><CheckCircle size={16} /> Confirm & Import</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
