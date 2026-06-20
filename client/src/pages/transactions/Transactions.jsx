import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useFamily } from '../../context/FamilyContext';
import api from '../../services/api';
import { formatCurrency, formatDate, assetTypeLabels } from '../../utils/formatters';
import { ArrowLeftRight, Search, Filter, Plus, X, Upload, FileText, CheckCircle, Loader } from 'lucide-react';

export default function Transactions() {
  const { success, error: showError } = useToast();
  const { activeFamily } = useFamily();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ search: '', assetType: '', type: '', startDate: '', endDate: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [addForm, setAddForm] = useState({ assetType: 'stock', name: '', symbol: '', type: 'buy', quantity: '', price: '', date: '', notes: '' });

  // Search state
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (addForm.name && addForm.name.length >= 2 && showDropdown && (addForm.assetType === 'stock' || addForm.assetType === 'mutual_fund')) {
      const timer = setTimeout(async () => {
        setSearching(true);
        try {
          const { data } = await api.get('/market/search', { params: { q: addForm.name } });
          setSearchResults(data.results || []);
        } catch {
          // ignore
        } finally {
          setSearching(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [addForm.name, addForm.assetType, showDropdown]);

  const selectAsset = (asset) => {
    setAddForm({ ...addForm, name: asset.name || '', symbol: asset.symbol || '' });
    setShowDropdown(false);
  };

  useEffect(() => { fetchTransactions(); }, [pagination.page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 20, ...filters };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const { data } = await api.get('/transactions', { params });
      setTransactions(data.transactions || []);
      setPagination(data.pagination || { total: 0, page: 1, pages: 1 });
    } catch { showError('Failed to load transactions.'); }
    finally { setLoading(false); }
  };

  const handleFilter = () => { setPagination(p => ({ ...p, page: 1 })); fetchTransactions(); };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = { ...addForm };
    if (payload.assetType === 'gold') {
      payload.name = 'Gold';
      payload.symbol = 'GOLD';
    } else if (payload.assetType === 'silver') {
      payload.name = 'Silver';
      payload.symbol = 'SILVER';
    }

    try {
      if (editId) {
        await api.put(`/transactions/${editId}`, payload);
        success('Transaction updated & portfolio recalculated.');
      } else {
        await api.post('/transactions', payload);
        success('Transaction added & portfolio updated.');
      }
      setShowAdd(false);
      setEditId(null);
      setAddForm({ assetType: 'stock', name: '', symbol: '', type: 'buy', quantity: '', price: '', date: '', notes: '' });
      fetchTransactions();
    } catch (err) { showError(err.response?.data?.message || 'Failed to save transaction.'); }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${editId}`);
      success('Transaction deleted & portfolio recalculated.');
      setShowAdd(false);
      setEditId(null);
      fetchTransactions();
    } catch (err) { showError('Failed to delete transaction.'); }
  };

  const openEdit = (t) => {
    setEditId(t._id);
    setAddForm({
      assetType: t.assetType,
      name: t.name,
      symbol: t.symbol || '',
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      date: t.date ? t.date.split('T')[0] : '',
      notes: t.notes || ''
    });
    setShowAdd(true);
  };

  const handleDeleteAll = async () => {
    const confirmMessage = "WARNING: This will permanently delete ALL your transactions and reset your entire portfolio. Are you absolutely sure you want to proceed?";
    if (!window.confirm(confirmMessage)) return;
    
    if (!window.confirm("FINAL WARNING: This action cannot be undone. Click OK to delete everything.")) return;

    try {
      setLoading(true);
      await api.delete('/transactions/all');
      success('All transactions and portfolio data have been deleted.');
      fetchTransactions();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete all transactions.');
      setLoading(false);
    }
  };

  // Upload handlers
  const handleFileSelect = (f) => {
    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.csv'))) {
      setUploadFile(f);
      setUploadResult(null);
    } else {
      showError('Please upload a PDF or CSV file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUploadProcess = async () => {
    if (!uploadFile || !activeFamily) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('report', uploadFile);
      formData.append('familyId', activeFamily._id);
      const { data } = await api.post('/upload/demat-report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(data);
      success('Report processed! Review the extracted transactions below.');
    } catch (err) {
      const serverMsg = err.response?.data?.message || '';
      const serverErr = err.response?.data?.error || '';
      showError(serverErr || serverMsg || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadResult?.uploadId) return;
    setConfirming(true);
    try {
      const { data } = await api.post(`/upload/${uploadResult.uploadId}/confirm`);
      success(`Imported ${data.transactionsCreated} transactions & portfolio recalculated!`);
      setUploadResult(null);
      setUploadFile(null);
      setShowUpload(false);
      fetchTransactions();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to import data.');
    } finally {
      setConfirming(false);
    }
  };

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadResult(null);
    setUploading(false);
    setConfirming(false);
    setDragOver(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><ArrowLeftRight size={28} /> Transactions</h1>
          <p className="page-subtitle">{pagination.total} total transactions</p>
        </div>
        <div className="flex gap-3">
          {transactions.length > 0 && (
            <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDeleteAll}>
              Delete All
            </button>
          )}
          <button className="btn btn-outline" onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Upload Report
          </button>
          <button className="btn btn-primary" onClick={() => { setEditId(null); setAddForm({ assetType: 'stock', name: '', symbol: '', type: 'buy', quantity: '', price: '', date: '', notes: '' }); setShowAdd(true); }}>
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6" style={{ padding: 'var(--space-4)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="search-bar" style={{ maxWidth: 280, flex: '1 1 240px' }}>
            <Search size={16} className="search-bar-icon" />
            <input className="search-bar-input" placeholder="Search by asset name..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <select className="input" style={{ width: 160, height: 38 }} value={filters.assetType} onChange={e => setFilters({ ...filters, assetType: e.target.value })}>
            <option value="">All Types</option>
            {Object.entries(assetTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" style={{ width: 120, height: 38 }} value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
            <option value="">Buy & Sell</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <input className="input" type="date" style={{ width: 150, height: 38 }} value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
          <input className="input" type="date" style={{ width: 150, height: 38 }} value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
          <button className="btn btn-primary btn-sm" onClick={handleFilter}><Filter size={14} /> Apply</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ArrowLeftRight size={36} /></div>
          <h3 className="empty-state-title">No Transactions</h3>
          <p className="empty-state-desc">Add transactions manually or upload a Demat report.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Name</th><th>Type</th><th>Asset</th><th>Qty</th><th>Price</th><th>Total</th><th>Source</th><th></th></tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t._id}>
                    <td>{formatDate(t.date)}</td>
                    <td className="font-medium">{t.name}<br /><span className="text-xs text-secondary">{t.symbol}</span></td>
                    <td><span className={`badge ${t.type === 'buy' ? 'badge-success' : 'badge-danger'}`}>{t.type.toUpperCase()}</span></td>
                    <td><span className="badge badge-neutral">{assetTypeLabels[t.assetType]}</span></td>
                    <td>{t.quantity}</td>
                    <td>{formatCurrency(t.price)}</td>
                    <td className="font-semibold">{formatCurrency(t.totalAmount)}</td>
                    <td><span className="badge badge-neutral">{t.source}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm text-primary" onClick={() => openEdit(t)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>Previous</button>
              <span className="text-sm text-secondary">Page {pagination.page} of {pagination.pages}</span>
              <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Transaction Modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Transaction' : 'Add Transaction'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="auth-row">
                  <div className="input-group">
                    <label className="input-label">Asset Type</label>
                    <select className="input" value={addForm.assetType} onChange={e => setAddForm({ ...addForm, assetType: e.target.value })}>
                      {Object.entries(assetTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Type</label>
                    <select className="input" value={addForm.type} onChange={e => setAddForm({ ...addForm, type: e.target.value })}>
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>
                </div>
                {addForm.assetType !== 'gold' && addForm.assetType !== 'silver' && (
                  <>
                    <div className="input-group" style={{ position: 'relative' }}>
                      <label className="input-label">Asset Name (Search)</label>
                      <input
                        className="input"
                        required
                        placeholder="Type to search..."
                        value={addForm.name}
                        onChange={e => {
                          setAddForm({ ...addForm, name: e.target.value });
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                      />
                      {showDropdown && (addForm.assetType === 'stock' || addForm.assetType === 'mutual_fund') && addForm.name.length >= 2 && (
                        <div className="search-dropdown" style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: '200px',
                          overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>
                          {searching ? (
                            <div style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>Searching...</div>
                          ) : searchResults.length > 0 ? (
                            searchResults.map(res => (
                              <div
                                key={res.symbol}
                                onClick={() => selectAsset(res)}
                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                              >
                                <div style={{ fontWeight: 500, fontSize: '14px' }}>{res.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{res.symbol} • {res.exchange}</div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>No matches found</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="input-group">
                      <label className="input-label">Symbol</label>
                      <input className="input" placeholder="Autofilled if selected" value={addForm.symbol} onChange={e => setAddForm({ ...addForm, symbol: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="auth-row">
                  <div className="input-group"><label className="input-label">Quantity</label><input className="input" type="number" required value={addForm.quantity} onChange={e => setAddForm({ ...addForm, quantity: e.target.value })} /></div>
                  <div className="input-group"><label className="input-label">Price</label><input className="input" type="number" step="0.01" required value={addForm.price} onChange={e => setAddForm({ ...addForm, price: e.target.value })} /></div>
                </div>
                <div className="auth-row">
                  <div className="input-group"><label className="input-label">Date</label><input className="input" type="date" value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} /></div>
                  <div className="input-group"><label className="input-label">Notes</label><input className="input" value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} /></div>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: editId ? 'space-between' : 'flex-end' }}>
                {editId && (
                  <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleDelete}>Delete Transaction</button>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editId ? 'Save Changes' : 'Add Transaction'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Report Modal */}
      {showUpload && (
        <div className="modal-backdrop" onClick={closeUploadModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Upload size={20} /> Upload Demat Report</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={closeUploadModal}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* Step 1: File Selection */}
              {!uploadResult && !uploading && (
                <>
                  <div
                    className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".pdf,.csv" hidden onChange={e => handleFileSelect(e.target.files[0])} />
                    <div className="drop-zone-icon"><Upload size={28} /></div>
                    {uploadFile ? (
                      <>
                        <p className="font-semibold">{uploadFile.name}</p>
                        <p className="text-sm text-secondary">{(uploadFile.size / 1024).toFixed(1)} KB — Ready to upload</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">Drag & drop your Demat report here</p>
                        <p className="text-sm text-secondary">or click to browse — Supports PDF, CSV</p>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Step 2: Processing */}
              {uploading && (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                  <Loader size={40} style={{ color: 'var(--primary)', margin: '0 auto var(--space-4)', animation: 'spin 2s linear infinite' }} />
                  <h3 className="text-lg font-semibold mb-2">AI is analyzing your report...</h3>
                  <p className="text-secondary text-sm">Extracting transactions using Gemini AI</p>
                </div>
              )}

              {/* Step 3: Results Preview */}
              {uploadResult?.extractedData?.transactions?.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent)' }}>
                    <CheckCircle size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div>
                      <p className="font-semibold" style={{ fontSize: 'var(--font-size-sm)' }}>Extraction Complete</p>
                      <p className="text-xs text-secondary">Found {uploadResult.extractedData.transactions.length} transactions</p>
                    </div>
                  </div>

                  <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table className="table">
                      <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                      <tbody>
                        {uploadResult.extractedData.transactions.map((t, i) => (
                          <tr key={i}>
                            <td>{t.date || '—'}</td>
                            <td className="font-medium">{t.name}<br /><span className="text-xs text-secondary">{t.symbol}</span></td>
                            <td><span className={`badge ${t.type === 'buy' ? 'badge-success' : 'badge-danger'}`}>{t.type?.toUpperCase()}</span></td>
                            <td>{t.quantity}</td>
                            <td>{formatCurrency(t.price)}</td>
                            <td className="font-semibold">{formatCurrency(t.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {uploadResult && (!uploadResult.extractedData?.transactions || uploadResult.extractedData.transactions.length === 0) && (
                <div className="empty-state" style={{ minHeight: 120 }}>
                  <p className="text-secondary">No transactions could be extracted from this document.</p>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              {!uploadResult && !uploading && (
                <>
                  <button className="btn btn-ghost" onClick={closeUploadModal}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUploadProcess} disabled={!uploadFile}>
                    <Upload size={16} /> Upload & Process
                  </button>
                </>
              )}
              {uploadResult?.extractedData?.transactions?.length > 0 && (
                <>
                  <button className="btn btn-ghost" onClick={closeUploadModal}>Discard</button>
                  <button className="btn btn-accent" onClick={handleConfirmImport} disabled={confirming}>
                    {confirming ? <><span className="spinner" /> Importing...</> : <><CheckCircle size={16} /> Confirm & Import</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
