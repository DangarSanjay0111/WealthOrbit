import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import AnimatedNumber from './AnimatedNumber';

/**
 * "Today's Gain" — shows the combined 1-day gain/loss across the user's
 * (or family's) stock + mutual fund holdings, fetched live from market prices.
 * Loads independently so it never blocks the page. Pass the endpoint to hit,
 * e.g. "/portfolio/todays-gain" or `/portfolio/family/${id}/todays-gain`.
 *
 * variant="pill" (default) renders the compact toolbar pill.
 * variant="card" renders a stat-card that drops into a grid of stat cards.
 */
export default function TodaysGain({ endpoint, variant = 'pill' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(endpoint)
      .then(({ data }) => { if (active) setData(data); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);

  // ---- Card variant: matches the surrounding stat-card box/UI ----
  if (variant === 'card') {
    if (loading) {
      return (
        <div className="stat-card">
          <div className="stat-card-body" style={{ flex: 1 }}>
            <span className="stat-card-label">Today's Gain</span>
            <div className="skeleton skeleton-heading" style={{ width: '75%', marginTop: 8 }} />
            <div className="skeleton skeleton-text" style={{ width: '45%', marginTop: 10 }} />
          </div>
          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 'var(--radius-lg)' }} />
        </div>
      );
    }

    const hasData = !!(data && data.priced);
    const gain = data?.todaysGain || 0;
    const pct = data?.todaysGainPercent || 0;
    const positive = gain >= 0;

    return (
      <div className="stat-card">
        <div className="stat-card-body">
          <span className="stat-card-label">Today's Gain</span>
          <AnimatedNumber
            className={`stat-card-value ${hasData ? (positive ? 'text-gain' : 'text-loss') : ''}`}
            value={gain}
            format={(v) => `${v >= 0 ? '+' : ''}${formatCurrency(v)}`}
          />
          <span className={`stat-card-meta ${positive ? 'gain' : 'loss'}`}>
            <span className="stat-dot" />
            {hasData ? `${positive ? '+' : ''}${pct.toFixed(2)}% today` : 'No priced holdings'}
          </span>
        </div>
        <div className={`stat-card-icon ${positive ? 'icon-green-solid' : 'icon-red-solid'}`}>
          {positive ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
        </div>
      </div>
    );
  }

  // ---- Pill variant (default) ----
  if (loading) {
    return (
      <div className="todays-gain-pill loading">
        <span className="todays-gain-label">Today's Gain</span>
        <span className="todays-gain-value muted">…</span>
      </div>
    );
  }

  // No priced holdings (e.g. only gold/FD, or markets unreachable) → hide.
  if (!data || !data.priced) return null;

  const gain = data.todaysGain || 0;
  const pct = data.todaysGainPercent || 0;
  const positive = gain >= 0;

  return (
    <div className={`todays-gain-pill ${positive ? 'gain' : 'loss'}`}>
      <span className="todays-gain-icon">
        {positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
      </span>
      <div className="todays-gain-body">
        <span className="todays-gain-label">Today's Gain</span>
        <span className="todays-gain-value">
          {positive ? '+' : ''}
          <AnimatedNumber value={gain} format={formatCurrency} />
          <span className="todays-gain-pct">
            ({positive ? '+' : ''}{pct.toFixed(2)}%)
          </span>
        </span>
      </div>
    </div>
  );
}
