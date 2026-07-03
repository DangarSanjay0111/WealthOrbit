import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatPercent, formatCompact, getPnLClass, assetTypeLabels, assetTypeColors } from '../../utils/formatters';
import { Link } from 'react-router-dom';
import AnimatedNumber from '../../components/common/AnimatedNumber';
import TodaysGain from '../../components/common/TodaysGain';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, RefreshCw,
  Briefcase, CircleDollarSign, Gem, Sparkles, PiggyBank, ArrowUpRight
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './Dashboard.css';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const assetIcons = {
  stock: Briefcase,
  mutual_fund: BarChart3,
  gold: CircleDollarSign,
  silver: Gem,
  fixed_deposit: Wallet,
  other_income: TrendingUp
};

const assetVisuals = {
  stock:         { emoji: '📈', gradient: 'linear-gradient(90deg, #6366f1, #3b82f6)', tint: 'hsla(221, 83%, 60%, 0.12)' },
  mutual_fund:   { emoji: '📊', gradient: 'linear-gradient(90deg, #a855f7, #ec4899)', tint: 'hsla(322, 84%, 60%, 0.12)' },
  gold:          { emoji: '🥇', gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)', tint: 'hsla(43, 96%, 56%, 0.16)' },
  silver:        { emoji: '🥈', gradient: 'linear-gradient(90deg, #94a3b8, #cbd5e1)', tint: 'hsla(215, 20%, 65%, 0.18)' },
  fixed_deposit: { emoji: '🏦', gradient: 'linear-gradient(90deg, #06b6d4, #6366f1)', tint: 'hsla(189, 94%, 43%, 0.14)' },
  other_income:  { emoji: '💰', gradient: 'linear-gradient(90deg, #f97316, #f59e0b)', tint: 'hsla(25, 95%, 53%, 0.14)' },
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
      const { data } = await api.get(`/portfolio/timeline?period=${activePeriod}`);
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

  const growthComparisonData = Object.entries(assetTypeLabels).map(([key, label]) => {
    const b = currentData.assetBreakdown?.[key] || { invested: 0, currentValue: 0 };
    return {
      name: label,
      invested: b.invested,
      currentValue: b.currentValue,
      color: assetTypeColors[key],
    };
  });

  const assetClassCount = Object.keys(assetTypeLabels).length;
  const growth = parseFloat(currentData.profitLossPercent) || 0;

  return (
    <div className="page-container">
      {/* Hero Welcome Banner */}
      <div className="hero-banner mb-6">
        <div className="hero-content">
          <div className="hero-greeting-badge">
            <Sparkles size={14} />
            <span>{getGreeting()}</span>
          </div>
          <h1 className="hero-title">
            Welcome back, <span className="hero-name">{user?.firstName}</span> <span className="hero-wave">👋</span>
          </h1>
          <p className="hero-subtitle">Here's your financial portfolio at a glance</p>
        </div>
      </div>

      {/* Stat Cards */}
      {!summary ? (
        <div className="grid-4 mb-8" key="stats-loading">
          {[0, 1, 2, 3].map(i => (
            <div className="stat-card" key={i}>
              <div className="stat-card-body" style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '55%' }} />
                <div className="skeleton skeleton-heading" style={{ width: '75%', marginTop: 8 }} />
                <div className="skeleton skeleton-text" style={{ width: '45%', marginTop: 10 }} />
              </div>
              <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 'var(--radius-lg)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid-4 mb-8" key="stats-loaded">
          <div className="stat-card">
            <div className="stat-card-body">
              <span className="stat-card-label">Total Wealth</span>
              <AnimatedNumber className="stat-card-value" value={currentData.totalWealth} format={formatCurrency} />
              <span className={`stat-card-meta ${currentData.totalProfitLoss >= 0 ? 'gain' : 'loss'}`}>
                <span className="stat-dot" />
                {currentData.totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(currentData.totalProfitLoss)} this year
              </span>
            </div>
            <div className="stat-card-icon icon-purple-solid">
              <Wallet size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-body">
              <span className="stat-card-label">Growth Rate</span>
              <AnimatedNumber className="stat-card-value" value={growth} format={formatPercent} />
              <span className={`stat-card-meta ${growth >= 0 ? 'gain' : 'loss'}`}>
                <span className="stat-dot" />
                Year-to-date
              </span>
            </div>
            <div className={`stat-card-icon ${growth >= 0 ? 'icon-green-solid' : 'icon-red-solid'}`}>
              {growth >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-body">
              <span className="stat-card-label">Total Invested</span>
              <AnimatedNumber className="stat-card-value" value={currentData.totalInvested} format={formatCurrency} />
              <span className="stat-card-meta">Across {assetClassCount} assets</span>
            </div>
            <div className="stat-card-icon icon-purple-soft">
              <PiggyBank size={22} />
            </div>
          </div>

          <TodaysGain endpoint="/portfolio/todays-gain" variant="card" />
        </div>
      )}

      {/* Period Toggle */}
      <div className="toolbar-row">
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
                    formatter={(v) => [formatCurrency(v), 'Invested']}
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
                <p className="text-secondary text-sm">No transactions yet.<br/>Add a buy or sell to see your growth.</p>
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

      {/* Asset-wise Growth Comparison Bar Chart */}
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <span className="card-title">Asset-wise Growth Comparison</span>
            <p className="card-subtitle">Initial Investment vs Current Value</p>
          </div>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={growthComparisonData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" vertical={false} />
              <XAxis
                dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                axisLine={{ stroke: 'var(--border-secondary)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => formatCompact(v)}
              />
              <Tooltip
                cursor={{ fill: 'var(--bg-hover, rgba(0,0,0,0.04))' }}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-primary)'
                }}
                formatter={(v, name) => [formatCurrency(v), name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{val}</span>}
              />
              <Bar dataKey="invested" name="Initial Investment" fill="#d1d5db" radius={[6, 6, 0, 0]} maxBarSize={44} />
              <Bar dataKey="currentValue" name="Current Value" fill="var(--color-mf)" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {growthComparisonData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Your Assets */}
      <div className="section-header">
        <div className="section-header-icon"><BarChart3 size={20} /></div>
        <h2 className="section-header-title">Your Assets</h2>
      </div>
      <div className="grid-3 mb-6">
        {Object.entries(assetTypeLabels).map(([key, label]) => {
          const v = assetVisuals[key] || {};
          const b = currentData.assetBreakdown?.[key] || { invested: 0, currentValue: 0, profitLoss: 0, count: 0 };
          const pct = b.invested > 0 ? ((b.profitLoss / b.invested) * 100).toFixed(2) : '0.00';
          const positive = b.profitLoss >= 0;

          return (
            <div className="asset-tile" key={key} style={{ '--tile-tint': v.tint }}>
              <div className="asset-tile-bar" style={{ background: v.gradient }} />
              <div className="asset-tile-top">
                <div className="asset-tile-head">
                  <span className="asset-tile-emoji">{v.emoji}</span>
                  <div>
                    <div className="asset-tile-name">{label}</div>
                    <div className="asset-tile-count">{b.count} transaction{b.count === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <span className={`asset-tile-badge ${positive ? 'up' : 'down'}`}>
                  <TrendingUp size={12} /> {positive ? '+' : ''}{pct}%
                </span>
              </div>
              <div className="asset-tile-row">
                <span className="asset-tile-key">Invested</span>
                <span className="asset-tile-val">{formatCurrency(b.invested)}</span>
              </div>
              <div className="asset-tile-row">
                <span className="asset-tile-key">Current Value</span>
                <span className="asset-tile-val strong">{formatCurrency(b.currentValue)}</span>
              </div>
              <div className="asset-tile-divider" />
              <div className="asset-tile-row">
                <span className="asset-tile-key">Profit/Loss</span>
                <span className={positive ? 'text-gain' : 'text-loss'} style={{ fontWeight: 700 }}>
                  {positive ? '+' : ''}{formatCurrency(b.profitLoss)}
                </span>
              </div>
              <Link to="/portfolio" className="asset-tile-details">
                View details <ArrowUpRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>

    </div>
  );
}
