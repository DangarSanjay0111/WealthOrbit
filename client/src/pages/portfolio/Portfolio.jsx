import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFamily } from '../../context/FamilyContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatPercent, getPnLClass, assetTypeLabels, assetTypeColors } from '../../utils/formatters';
import { Briefcase, Plus, X, Search } from 'lucide-react';
import './Portfolio.css';

const ASSET_TABS = ['all', 'stock', 'mutual_fund', 'gold', 'silver', 'fixed_deposit', 'other_income'];
const TAB_LABELS = { all: 'All', ...assetTypeLabels };

export default function Portfolio() {
  const [searchParams] = useSearchParams();
  const memberId = searchParams.get('memberId');
  const memberName = searchParams.get('memberName');
  
  const { activeFamily } = useFamily();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHoldings();
  }, [memberId, activeFamily]);

  const fetchHoldings = async () => {
    if (memberId && !activeFamily) return; // Wait for activeFamily if viewing a member
    
    setLoading(true);
    try {
      if (memberId) {
        const { data } = await api.get(`/portfolio/member/${memberId}`, { params: { familyId: activeFamily._id } });
        setHoldings(data.holdings || []);
      } else {
        const { data } = await api.get('/portfolio');
        setHoldings(data.holdings || []);
      }
    } catch { showError('Failed to load portfolio.'); }
    finally { setLoading(false); }
  };

  const filteredHoldings = holdings.filter(h => {
    const matchesTab = activeTab === 'all' || h.assetType === activeTab;
    const matchesSearch = !searchTerm || h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleRefresh = async () => {
    if (memberId) return; // Only refresh own prices
    try {
      setLoading(true);
      const { data } = await api.post('/market/refresh');
      success(data.message || 'Prices refreshed successfully');
      fetchHoldings();
    } catch (err) {
      showError('Failed to refresh prices.');
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Briefcase size={28} /> {memberId ? `${memberName}'s Portfolio` : 'Portfolio'}</h1>
          <p className="page-subtitle">{holdings.length} holdings across all asset classes</p>
        </div>
        {!memberId && (
          <div className="flex gap-3">
            <button className="btn btn-outline" onClick={handleRefresh} disabled={loading}>
              Refresh Prices
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {ASSET_TABS.map(tab => (
          <button key={tab} className={`tab-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-bar mb-6" style={{ maxWidth: 360 }}>
        <Search size={16} className="search-bar-icon" />
        <input className="search-bar-input" placeholder="Search by asset name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* Holdings Table */}
      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : filteredHoldings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Briefcase size={36} /></div>
          <h3 className="empty-state-title">No Holdings Found</h3>
          <p className="empty-state-desc">Go to the Transactions page to add your investments.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Qty / Units</th>
                <th>Avg Buy</th>
                <th>Current</th>
                <th>Value</th>
                <th>P&L</th>
                <th>P&L %</th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map(h => (
                <tr key={h._id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="holding-dot" style={{ background: assetTypeColors[h.assetType] }} />
                      <div>
                        <span className="font-medium">{h.name}</span>
                        {h.symbol && <span className="text-xs text-secondary" style={{ display: 'block' }}>{h.symbol}</span>}
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{assetTypeLabels[h.assetType]}</span></td>
                  <td>{h.assetType === 'gold' || h.assetType === 'silver' ? `${h.quantity || 0}g` : h.quantity || h.units || '-'}</td>
                  <td>{formatCurrency(h.avgBuyPrice)}</td>
                  <td>{formatCurrency(h.currentPrice)}</td>
                  <td className="font-semibold">{formatCurrency(h.currentValue)}</td>
                  <td className={getPnLClass(h.profitLoss)}>{formatCurrency(h.profitLoss)}</td>
                  <td className={getPnLClass(h.profitLossPercent)}>{formatPercent(h.profitLossPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
