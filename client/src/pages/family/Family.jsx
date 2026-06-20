import { useState, useEffect, useRef } from 'react';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatPercent, formatCompact, getPnLClass, assetTypeLabels, assetTypeColors } from '../../utils/formatters';
import {
  TrendingUp, TrendingDown, Wallet, Users, BarChart3, RefreshCw,
  Briefcase, CircleDollarSign, Gem, ChevronDown
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Link } from 'react-router-dom';
import '../dashboard/Dashboard.css';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

const assetIcons = {
  stock: Briefcase,
  mutual_fund: BarChart3,
  gold: CircleDollarSign,
  silver: Gem,
  fixed_deposit: Wallet,
  other_income: TrendingUp
};

export default function Family() {
  const { activeFamily, switchFamily, families } = useFamily();
  const { error: showError, success } = useToast();

  const [familySummary, setFamilySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('Monthly');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [chartData, setChartData] = useState([]);

  const [showFamilyMenu, setShowFamilyMenu] = useState(false);
  const familyMenuRef = useRef(null);

  useEffect(() => {
    if (activeFamily) {
      fetchSnapshots();
    }
  }, [activePeriod, activeFamily]);

  const fetchSnapshots = async () => {
    if (!activeFamily) return;
    try {
      const { data } = await api.get(`/portfolio/family/${activeFamily._id}/snapshots?period=${activePeriod}`);
      const formattedData = data.snapshots.map(s => ({
        date: new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        value: s.totalWealth
      }));
      setChartData(formattedData);
    } catch (err) {
      // Intentionally suppressed for prod
    }
  };


  useEffect(() => {
    const handler = (e) => {
      if (familyMenuRef.current && !familyMenuRef.current.contains(e.target)) setShowFamilyMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (activeFamily) {
      fetchData();
    }
  }, [activeFamily]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeFamily) {
        const { data: familyData } = await api.get(`/portfolio/family/${activeFamily._id}`);
        setFamilySummary(familyData);
        setFamilyMembers(familyData.memberWealth || []);
      }
    } catch (err) {
      if (err.response?.status !== 403) {
        showError('Failed to load family data.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!activeFamily) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={36} /></div>
          <h3 className="empty-state-title">No Family Selected</h3>
          <p className="empty-state-desc">Create or join a family from your Profile to start tracking collective wealth.</p>
        </div>
      </div>
    );
  }

  const currentData = familySummary ? {
    totalWealth: familySummary.totalFamilyWealth,
    totalInvested: familySummary.totalFamilyInvested,
    totalProfitLoss: familySummary.totalFamilyProfitLoss,
    profitLossPercent: familySummary.profitLossPercent,
    assetAllocation: familySummary.assetAllocation,
    holdingsCount: familySummary.totalHoldings,
  } : {};

  const allocationData = currentData.assetAllocation
    ? Object.entries(currentData.assetAllocation).map(([key, value]) => ({
        name: assetTypeLabels[key] || key,
        value: value,
        color: assetTypeColors[key],
      }))
    : [];

  const barData = allocationData.map(item => ({
    name: item.name,
    value: item.value,
    fill: item.color
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-4">
            {families.length > 1 ? (
              <div className="dropdown" ref={familyMenuRef} style={{ position: 'relative' }}>
                <h1 
                  className="page-title flex items-center gap-3 mb-0" 
                  style={{ marginBottom: 0, cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onClick={() => setShowFamilyMenu(!showFamilyMenu)}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <Users size={28} />
                  {activeFamily.name} Overview
                  <ChevronDown size={20} className="text-secondary" />
                </h1>

                {showFamilyMenu && (
                  <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '220px', overflow: 'hidden' }}>
                    {families.map(f => (
                      <button
                        key={f._id}
                        className={`dropdown-item flex items-center justify-between w-full p-3 text-left transition-colors ${f._id === activeFamily._id ? 'bg-primary-light font-medium' : 'hover:bg-gray-50'}`}
                        onClick={() => { switchFamily(f); setShowFamilyMenu(false); }}
                        style={{ borderBottom: '1px solid var(--border-color)', background: f._id === activeFamily._id ? 'var(--primary-light)' : 'transparent', border: 'none', padding: '12px 16px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                      >
                        <span style={{ color: f._id === activeFamily._id ? 'var(--primary)' : 'inherit' }}>{f.name}</span>
                        <span className={`badge ${f._id === activeFamily._id ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '11px' }}>{f.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <h1 className="page-title flex items-center gap-3 mb-0" style={{ marginBottom: 0 }}>
                <Users size={28} />
                {activeFamily.name} Overview
              </h1>
            )}
          </div>
          <p className="page-subtitle mt-1" style={{ marginTop: '4px' }}>
            Combined wealth of all family members
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-outline btn-sm" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="tab-bar" style={{ maxWidth: 360 }}>
        {PERIODS.map(p => (
          <button
            key={p}
            className={`tab-item ${activePeriod === p ? 'active' : ''}`}
            onClick={() => setActivePeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Wealth Overview Cards */}
      <div className="grid-4 mb-6">
        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Total Family Wealth</div>
          <div className="wealth-card-value">{formatCurrency(currentData.totalWealth || 0)}</div>
          <div className="wealth-card-sub">{currentData.holdingsCount || 0} combined holdings</div>
        </div>

        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Total Invested</div>
          <div className="wealth-card-value">{formatCurrency(currentData.totalInvested || 0)}</div>
        </div>

        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Total P&L</div>
          <div className={`wealth-card-value ${getPnLClass(currentData.totalProfitLoss || 0)}`}>
            {(currentData.totalProfitLoss || 0) >= 0 ? (
              <TrendingUp size={22} style={{ marginRight: 6 }} />
            ) : (
              <TrendingDown size={22} style={{ marginRight: 6 }} />
            )}
            {formatCurrency(currentData.totalProfitLoss || 0)}
          </div>
        </div>

        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Returns</div>
          <div className={`wealth-card-value ${getPnLClass(parseFloat(currentData.profitLossPercent || 0))}`}>
            {formatPercent(currentData.profitLossPercent || 0)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-6">
        {/* Wealth Growth Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Wealth Growth</span>
          </div>
          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(250, 75%, 62%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(250, 75%, 62%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis
                    dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    axisLine={{ stroke: 'var(--border-secondary)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => formatCompact(v)}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(v) => [formatCurrency(v), 'Value']}
                  />
                  <Area
                    type="monotone" dataKey="value"
                    stroke="hsl(250, 75%, 62%)" strokeWidth={2}
                    fill="url(#wealthGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ minHeight: 280 }}>
                <TrendingUp size={36} className="text-secondary mb-3 opacity-50" />
                <p className="text-secondary text-sm">No historical data available yet.<br/>Check back tomorrow.</p>
              </div>
            )}
          </div>
        </div>

        {/* Asset Allocation Pie */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Family Asset Allocation</span>
          </div>
          <div className="chart-container">
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {allocationData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(v) => formatCurrency(v)}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ minHeight: 280 }}>
                <p className="text-secondary text-sm">No holdings yet. Add investments to see allocation.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Family Members Wealth */}
      {familyMembers.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <span className="card-title">Family Members</span>
            <span className="badge badge-primary">{familyMembers.length} members</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Total Wealth</th>
                  <th>Invested</th>
                  <th>P&L</th>
                  <th>Holdings</th>
                </tr>
              </thead>
              <tbody>
                {familyMembers.map((m, i) => (
                  <tr key={i}>
                    <td className="font-medium">
                      <Link to={`/portfolio?memberId=${m.user?._id}&memberName=${encodeURIComponent(m.user?.firstName)}`} className="text-primary hover:underline flex items-center gap-2">
                        {m.user?.firstName} {m.user?.lastName} <Briefcase size={14} />
                      </Link>
                    </td>
                    <td><span className={`badge ${m.role === 'head' ? 'badge-primary' : 'badge-neutral'}`}>{m.role}</span></td>
                    <td className="font-semibold">{formatCurrency(m.totalWealth)}</td>
                    <td>{formatCurrency(m.totalInvested)}</td>
                    <td className={getPnLClass(m.totalProfitLoss)}>{formatCurrency(m.totalProfitLoss)}</td>
                    <td>{m.holdingsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
