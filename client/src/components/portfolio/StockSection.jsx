import { useState, useEffect, useRef } from 'react';
import { useFamily } from '../../context/FamilyContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatDate, getPnLClass } from '../../utils/formatters';
import {
  Plus, Upload, X, TrendingUp, TrendingDown, Trash2,
  CheckCircle, Loader, Calendar
} from 'lucide-react';

const EMPTY_FORM = { name: '', symbol: '', type: 'buy', quantity: '', price: '', date: '', notes: '' };
const ACCEPTED_EXT = ['.pdf', '.csv', '.xlsx', '.xls', '.txt'];

/**
 * Dedicated "Shares/Stocks" section for the Portfolio page. Aggregates all
 * stock holdings, lets the user add/delete transactions and upload a broker
 * report (AI extraction, review-then-import). No Edit Values, no API box.
 * `onChange` notifies the parent so it can refresh its own holdings list.
 */
export default function StockSection({ onChange }) {
  const { activeFamily } = useFamily();
  const { success, error: showError } = useToast();

  const [holdings, setHoldings] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add-transaction modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: pf }, { data: tx }] = await Promise.all([
        api.get('/portfolio'),
        api.get('/transactions', { params: { assetType: 'stock', limit: 1000 } }),
      ]);
      setHoldings((pf.holdings || []).filter(h => h.assetType === 'stock'));
      setTxns(tx.transactions || []);
    } catch {
      showError('Failed to load stocks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Debounced market search on the asset name.
  useEffect(() => {
    if (form.name && form.name.length >= 2 && showDropdown) {
      const timer = setTimeout(async () => {
        setSearching(true);
        try {
          const { data } = await api.get('/market/search', { params: { q: form.name } });
          setSearchResults(data.results || []);
        } catch { /* ignore */ }
        finally { setSearching(false); }
      }, 500);
      return () => clearTimeout(timer);
    }
    setSearchResults([]);
  }, [form.name, showDropdown]);

  // Pick a search result → autofill name/symbol and fetch the live price.
  const selectAsset = async (asset) => {
    setForm(f => ({ ...f, name: asset.name || '', symbol: asset.symbol || '' }));
    setShowDropdown(false);
    if (asset.symbol) {
      setPriceLoading(true);
      try {
        const { data } = await api.get(`/market/stock/${encodeURIComponent(asset.symbol)}`);
        if (data?.price) setForm(f => ({ ...f, price: String(data.price) }));
      } catch { /* keep manual entry */ }
      finally { setPriceLoading(false); }
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setShowAdd(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/transactions', { ...form, assetType: 'stock' });
      success('Transaction added & portfolio updated.');
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await fetchAll();
      onChange?.();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTxn = async (id) => {
    if (!window.confirm('Delete this transaction? Your portfolio will be recalculated.')) return;
    try {
      await api.delete(`/transactions/${id}`);
      success('Transaction deleted & portfolio recalculated.');
      await fetchAll();
      onChange?.();
    } catch {
      showError('Failed to delete transaction.');
    }
  };

  // ---- Upload handlers ----
  const handleFileSelect = (f) => {
    if (f && ACCEPTED_EXT.some(ext => f.name.toLowerCase().endsWith(ext))) {
      setUploadFile(f);
      setUploadResult(null);
    } else {
      showError('Please upload a PDF, CSV, Excel (.xlsx/.xls) or text file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUploadProcess = async () => {
    if (!uploadFile || !activeFamily) {
      if (!activeFamily) showError('Select or create a family first.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('report', uploadFile);
      fd.append('familyId', activeFamily._id);
      const { data } = await api.post('/upload/demat-report', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(data);
      success('Report processed! Review the extracted transactions below.');
    } catch (err) {
      showError(err.response?.data?.error || err.response?.data?.message || 'Upload failed.');
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
      closeUpload();
      await fetchAll();
      onChange?.();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to import data.');
    } finally {
      setConfirming(false);
    }
  };

  const closeUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadResult(null);
    setUploading(false);
    setConfirming(false);
    setDragOver(false);
  };

  // ---- Aggregates ----
  const invested = holdings.reduce((s, h) => s + (h.totalInvested || 0), 0);
  const currentValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
  const profitLoss = currentValue - invested;
  const plPercent = invested > 0 ? (profitLoss / invested) * 100 : 0;
  const totalQty = holdings.reduce((s, h) => s + (h.quantity || 0), 0);
  const positive = profitLoss >= 0;

  // Only stock rows from the extraction preview matter here, but show all found.
  const extracted = uploadResult?.extractedData?.transactions || [];

  return (
    <div className="stock-section">
      {/* Overview card */}
      <div className="card stock-overview">
        <div className="stock-overview-head">
          <h2 className="stock-overview-title">Shares/Stocks</h2>
          <div className="flex gap-3">
            <button className="btn btn-outline" onClick={() => setShowUpload(true)}>
              <Upload size={16} /> Upload Report
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Transaction
            </button>
          </div>
        </div>

        <div className="stock-stat-grid">
          <div className="stock-stat">
            <span className="stock-stat-label">Initial Investment</span>
            <span className="stock-stat-value">{formatCurrency(invested)}</span>
          </div>
          <div className="stock-stat">
            <span className="stock-stat-label">Current Value</span>
            <span className="stock-stat-value">{formatCurrency(currentValue)}</span>
          </div>
          <div className="stock-stat">
            <span className="stock-stat-label">Profit/Loss</span>
            <span className={`stock-stat-value ${getPnLClass(profitLoss)}`}>
              {positive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {' '}{formatCurrency(profitLoss)} ({plPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="stock-qty-line">Quantity: {totalQty} units</div>
      </div>

      {/* Transaction history */}
      <div className="card">
        <div className="stock-history-head">
          <h3 className="card-title">Transaction History</h3>
          <span className="text-sm text-secondary">
            {txns.length} transaction{txns.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 160 }}><div className="spinner spinner-lg" /></div>
        ) : txns.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 160 }}>
            <p className="text-secondary text-sm">No stock transactions yet. Add one or upload a report.</p>
          </div>
        ) : (
          <div className="stock-txn-list">
            {txns.map(t => (
              <div className="stock-txn-row" key={t._id}>
                <div className="stock-txn-main">
                  <span className={`badge ${t.type === 'buy' ? 'badge-success' : 'badge-danger'}`}>
                    {t.type.toUpperCase()}
                  </span>
                  <div>
                    <div className="stock-txn-name">{t.name}</div>
                    <div className="stock-txn-meta">
                      <Calendar size={12} /> {formatDate(t.date)}
                      {t.symbol ? <span className="stock-txn-symbol">{t.symbol}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="stock-txn-right">
                  <div className="stock-txn-amount">{formatCurrency(t.totalAmount)}</div>
                  <div className="stock-txn-sub">{t.quantity} × {formatCurrency(t.price)}</div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm stock-txn-del" onClick={() => deleteTxn(t._id)} title="Delete transaction">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Stock Transaction</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label className="input-label">Type</label>
                  <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
                <div className="input-group" style={{ position: 'relative' }}>
                  <label className="input-label">Stock Name (Search)</label>
                  <input
                    className="input"
                    required
                    placeholder="Type to search..."
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && form.name.length >= 2 && (
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
                          <div key={res.symbol} onClick={() => selectAsset(res)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>
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
                  <input className="input" placeholder="Autofilled if selected" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} />
                </div>
                <div className="auth-row">
                  <div className="input-group">
                    <label className="input-label">Quantity</label>
                    <input className="input" type="number" step="any" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Price {priceLoading && <span className="text-xs text-secondary">(fetching…)</span>}</label>
                    <input className="input" type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>
                <div className="auth-row">
                  <div className="input-group"><label className="input-label">Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                  <div className="input-group"><label className="input-label">Notes</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saving…</> : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Report modal */}
      {showUpload && (
        <div className="modal-backdrop" onClick={closeUpload}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Upload size={20} /> Upload Report</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={closeUpload}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {!uploadResult && !uploading && (
                <div
                  className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.txt" hidden onChange={e => handleFileSelect(e.target.files[0])} />
                  <div className="drop-zone-icon"><Upload size={28} /></div>
                  {uploadFile ? (
                    <>
                      <p className="font-semibold">{uploadFile.name}</p>
                      <p className="text-sm text-secondary">{(uploadFile.size / 1024).toFixed(1)} KB — Ready to upload</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Drag & drop your broker/Demat report here</p>
                      <p className="text-sm text-secondary">or click to browse — PDF, CSV, Excel (.xlsx/.xls)</p>
                    </>
                  )}
                </div>
              )}

              {uploading && (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                  <Loader size={40} style={{ color: 'var(--primary)', margin: '0 auto var(--space-4)', animation: 'spin 2s linear infinite' }} />
                  <h3 className="text-lg font-semibold mb-2">AI is analyzing your report…</h3>
                  <p className="text-secondary text-sm">Extracting buy & sell transactions using Gemini AI</p>
                </div>
              )}

              {extracted.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent)' }}>
                    <CheckCircle size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div>
                      <p className="font-semibold" style={{ fontSize: 'var(--font-size-sm)' }}>Extraction Complete</p>
                      <p className="text-xs text-secondary">Found {extracted.length} transactions</p>
                    </div>
                  </div>
                  <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table className="table">
                      <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                      <tbody>
                        {extracted.map((t, i) => (
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

              {uploadResult && extracted.length === 0 && (
                <div className="empty-state" style={{ minHeight: 120 }}>
                  <p className="text-secondary">No transactions could be extracted from this document.</p>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              {!uploadResult && !uploading && (
                <>
                  <button className="btn btn-ghost" onClick={closeUpload}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUploadProcess} disabled={!uploadFile}>
                    <Upload size={16} /> Upload & Process
                  </button>
                </>
              )}
              {extracted.length > 0 && (
                <>
                  <button className="btn btn-ghost" onClick={closeUpload}>Discard</button>
                  <button className="btn btn-accent" onClick={handleConfirmImport} disabled={confirming}>
                    {confirming ? <><span className="spinner" /> Importing…</> : <><CheckCircle size={16} /> Confirm & Import</>}
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
