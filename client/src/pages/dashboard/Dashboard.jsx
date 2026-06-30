import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatPercent, formatCompact, getPnLClass, assetTypeLabels, assetTypeColors } from '../../utils/formatters';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, RefreshCw,
  Briefcase, CircleDollarSign, Gem, Sparkles
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './Dashboard.css';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

const assetIcons = {
  stock: Briefcase,
  mutual_fund: BarChart3,
  gold: CircleDollarSign,
  silver: Gem,
  fixed_deposit: Wallet,
  other_income: TrendingUp
};

export default function Dashboard() {
  const { user } = useAuth();
  const { error: showError, success } = useToast();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('Monthly');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchSnapshots();
  }, [activePeriod]);

  const fetchSnapshots = async () => {
    try {
      const { data } = await api.get(`/portfolio/snapshots?period=${activePeriod}`);
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
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/portfolio/summary');
      setSummary(data);
    } catch (err) {
      if (err.response?.status !== 403) {
        showError('Failed to load dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentData = summary || {};

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
          <h1 className="page-title">
            <Wallet size={28} /> Dashboard
          </h1>
          <p className="page-subtitle">
            Welcome back, {user?.firstName}
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
          <div className="wealth-card-label">Total Wealth</div>
          <div className="wealth-card-value">{formatCurrency(currentData.totalWealth)}</div>
          <div className="wealth-card-sub">{currentData.holdingsCount || 0} holdings</div>
        </div>

        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Total Invested</div>
          <div className="wealth-card-value">{formatCurrency(currentData.totalInvested)}</div>
        </div>

        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Total P&L</div>
          <div className={`wealth-card-value ${getPnLClass(currentData.totalProfitLoss)}`}>
            {currentData.totalProfitLoss >= 0 ? (
              <TrendingUp size={22} style={{ marginRight: 6 }} />
            ) : (
              <TrendingDown size={22} style={{ marginRight: 6 }} />
            )}
            {formatCurrency(currentData.totalProfitLoss)}
          </div>
        </div>

        <div className="card card-hoverable wealth-card">
          <div className="wealth-card-label">Returns</div>
          <div className={`wealth-card-value ${getPnLClass(parseFloat(currentData.profitLossPercent))}`}>
            {formatPercent(currentData.profitLossPercent)}
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
            <span className="card-title">Asset Allocation</span>
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

      {/* Asset Class Performance Bar Chart */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">Asset Class Distribution</span>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
              <XAxis
                dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={{ stroke: 'var(--border-secondary)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => formatCompact(v)}
              />
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
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset Class Cards */}
      <h2 className="text-lg font-semibold mb-4">Asset Classes</h2>
      <div className="grid-3 mb-6">
        {Object.entries(assetTypeLabels).map(([key, label]) => {
          const Icon = assetIcons[key] || Wallet;
          const value = currentData.assetAllocation?.[key] || 0;
          const pct = currentData.totalWealth > 0
            ? ((value / currentData.totalWealth) * 100).toFixed(1)
            : 0;

          return (
            <div className="card card-hoverable asset-class-card" key={key}>
              <div className="asset-class-icon" style={{ background: `${assetTypeColors[key]}22`, color: assetTypeColors[key] }}>
                <Icon size={22} />
              </div>
              <div className="asset-class-info">
                <span className="asset-class-label">{label}</span>
                <span className="asset-class-value">{formatCurrency(value)}</span>
                <span className="text-xs text-secondary">{pct}% of portfolio</span>
              </div>
            </div>
          );
        })}
      </div>



      {/* Yearly Summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Yearly Summary {new Date().getFullYear()}</span>
        </div>
        <div className="grid-3" style={{ gap: 'var(--space-4)' }}>
          <div className="summary-stat">
            <span className="summary-stat-label">Total Portfolio Value</span>
            <span className="summary-stat-value">{formatCurrency(currentData.totalWealth)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat-label">Total Invested</span>
            <span className="summary-stat-value">{formatCurrency(currentData.totalInvested)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat-label">Overall Returns</span>
            <span className={`summary-stat-value ${getPnLClass(parseFloat(currentData.profitLossPercent))}`}>
              {formatPercent(currentData.profitLossPercent)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
