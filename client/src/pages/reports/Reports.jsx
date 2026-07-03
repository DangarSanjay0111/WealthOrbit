import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFamily } from '../../context/FamilyContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatPercent, assetTypeLabels, getPnLClass } from '../../utils/formatters';
import { FileText, Download, Users, Wallet, PiggyBank, TrendingUp, TrendingDown, Layers, Calendar, BarChart3, ChevronDown } from 'lucide-react';
import AnimatedNumber from '../../components/common/AnimatedNumber';

export default function Reports() {
  const { activeFamily, switchFamily, families } = useFamily();
  const { error: showError, success } = useToast();
  const [reportType, setReportType] = useState('individual');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyTxns, setMonthlyTxns] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Build a list of the last 12 months for the selector
  const monthOptions = (() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  })();

  const selectedMonthLabel = monthOptions.find(o => o.value === selectedMonth)?.label || selectedMonth;

  const fetchMonthly = async () => {
    setMonthlyLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month
      const { data } = await api.get('/transactions', {
        params: { startDate, endDate, limit: 1000 }
      });
      setMonthlyTxns(data.transactions || []);
    } catch { setMonthlyTxns([]); }
    finally { setMonthlyLoading(false); }
  };

  useEffect(() => { fetchMonthly(); }, [selectedMonth]);

  // Aggregate the monthly transactions into summary buckets
  const monthlySummary = monthlyTxns.reduce((acc, t) => {
    const amount = t.totalAmount || 0;
    if (t.type === 'buy') {
      acc.purchases += amount;
      const pnl = t.profitLoss ?? t.realizedPnl ?? 0;
      if (pnl > 0) acc.profit += pnl; else if (pnl < 0) acc.loss += Math.abs(pnl);
    } else if (t.type === 'sell') {
      acc.sales += amount;
      const pnl = t.profitLoss ?? t.realizedPnl ?? 0;
      if (pnl > 0) acc.profit += pnl; else if (pnl < 0) acc.loss += Math.abs(pnl);
    }
    acc.transactions += 1;
    return acc;
  }, { purchases: 0, sales: 0, profit: 0, loss: 0, transactions: 0 });

  const downloadMonthlyReport = () => {
    const doc = new jsPDF();
    const formatCurrencyPDF = (val) => {
      if (val === null || val === undefined) return 'Rs. 0';
      const numStr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.abs(val));
      return (val < 0 ? '-' : '') + 'Rs. ' + numStr;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    doc.text('Monthly Investment Report', 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(108, 117, 125);
    doc.text(selectedMonthLabel, 14, 30);

    doc.setDrawColor(233, 236, 239);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    autoTable(doc, {
      startY: 42,
      head: [['Purchases', 'Sales', 'Profit', 'Loss', 'Transactions']],
      body: [[
        formatCurrencyPDF(monthlySummary.purchases),
        formatCurrencyPDF(monthlySummary.sales),
        formatCurrencyPDF(monthlySummary.profit),
        formatCurrencyPDF(monthlySummary.loss),
        String(monthlySummary.transactions)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [43, 90, 238], textColor: 255, fontSize: 11, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 12, fontStyle: 'bold', halign: 'center', textColor: [33, 37, 41] }
    });

    if (monthlyTxns.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text('Transactions', 14, doc.lastAutoTable.finalY + 15);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Date', 'Name', 'Type', 'Qty', 'Price', 'Amount']],
        body: monthlyTxns.map(t => [
          new Date(t.date).toLocaleDateString('en-IN'),
          t.name,
          (t.type || '').toUpperCase(),
          t.quantity ?? '-',
          formatCurrencyPDF(t.price),
          formatCurrencyPDF(t.totalAmount)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 }
      });
    }

    doc.save(`WealthOrbit_Monthly_${selectedMonth}.pdf`);
    success('Monthly report downloaded!');
  };

  const fetchReport = async () => {
    if (!activeFamily) return;
    setLoading(true);
    try {
      if (reportType === 'family' && !activeFamily) return;
      
      const endpoint = reportType === 'family'
        ? `/reports/family/${activeFamily._id}`
        : `/reports/individual`;
      const { data } = await api.get(endpoint);
      setReportData(data);
    } catch (err) { showError('Failed to load report.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [activeFamily, reportType]);

  const exportCSV = () => {
    if (!reportData) return;
    const source = reportData.holdings || [];
    const headers = ['Name', 'Type', 'Quantity', 'Avg Buy Price', 'Current Value', 'P&L', 'P&L %'];
    const rows = source.map(h => [h.name, assetTypeLabels[h.assetType], h.quantity, h.avgBuyPrice, h.currentValue, h.profitLoss, h.profitLossPercent?.toFixed(2)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WealthOrbit_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success('Report exported as CSV!');
  };

  const exportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    
    // Helper to avoid Unicode bugs/spacing issues in jsPDF default fonts
    const formatCurrencyPDF = (val) => {
      if (val === null || val === undefined) return 'Rs. 0';
      const numStr = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(Math.abs(val));
      return (val < 0 ? '-' : '') + 'Rs. ' + numStr;
    };
    
    // Document styling
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    const title = reportType === 'family' ? `${activeFamily?.name || 'Family'} Portfolio Report` : 'My Portfolio Report';
    doc.text(title, 14, 22);
    
    // Subtitle / Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(108, 117, 125);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);

    // Decorative Line
    doc.setDrawColor(233, 236, 239);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    // Summary Section
    const summaryData = reportData?.summary || reportData?.familySummary || {};
    autoTable(doc, {
      startY: 42,
      head: [['Total Wealth', 'Total Invested', 'Total P&L', 'P&L %']],
      body: [[
        formatCurrencyPDF(summaryData.totalWealth),
        formatCurrencyPDF(summaryData.totalInvested),
        formatCurrencyPDF(summaryData.totalProfitLoss),
        formatPercent(summaryData.profitLossPercent)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [43, 90, 238], textColor: 255, fontSize: 11, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 12, fontStyle: 'bold', halign: 'center', textColor: [33, 37, 41] },
      alternateRowStyles: { fillColor: [255, 255, 255] }
    });

    // Holdings Table
    const source = reportData.holdings || [];
    if (source.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text('Detailed Holdings', 14, doc.lastAutoTable.finalY + 15);

      const headers = [['Name', 'Type', 'Qty', 'Invested', 'Current Value', 'P&L', 'P&L %']];
      const rows = source.map(h => [
        h.name,
        assetTypeLabels[h.assetType] || h.assetType,
        h.quantity || h.weightGrams || '-',
        formatCurrencyPDF(h.totalInvested),
        formatCurrencyPDF(h.currentValue),
        formatCurrencyPDF(h.profitLoss),
        formatPercent(h.profitLossPercent)
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: headers,
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 'auto', fontStyle: 'bold' },
          5: { textColor: [43, 90, 238] } // highlight P&L slightly
        }
      });
    }

    doc.save(`WealthOrbit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    success('Report exported as PDF!');
  };

  const summary = reportData?.summary || reportData?.familySummary || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileText size={28} /> Reports</h1>
          <p className="page-subtitle">Generate and export portfolio reports</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="view-toggle">
            <button className={`view-toggle-btn ${reportType === 'individual' ? 'active' : ''}`} onClick={() => setReportType('individual')}>My Portfolio</button>
            {families.length > 0 && (
              <button className={`view-toggle-btn ${reportType === 'family' ? 'active' : ''}`} onClick={() => setReportType('family')}><Users size={14} /> Family Portfolio</button>
            )}
          </div>
          
          {reportType === 'family' && families.length > 1 && (
            <select 
              className="input input-sm" 
              style={{ width: 'auto', padding: '4px 8px' }}
              value={activeFamily?._id || ''} 
              onChange={(e) => {
                const f = families.find(fam => fam._id === e.target.value);
                if (f) switchFamily(f);
              }}
            >
              {families.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
          )}

          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={exportCSV} disabled={!reportData}><Download size={16} /> CSV</button>
            <button className="btn btn-primary" onClick={exportPDF} disabled={!reportData}><FileText size={16} /> Export PDF</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /></div>
      ) : !reportData ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={36} /></div>
          <h3 className="empty-state-title">No Data</h3>
          <p className="empty-state-desc">Add holdings to generate reports.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid-4 mb-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Total Wealth</span>
                <AnimatedNumber className="stat-card-value" value={summary.totalWealth} format={formatCurrency} />
              </div>
              <div className="stat-card-icon icon-purple-solid"><Wallet size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Total Invested</span>
                <AnimatedNumber className="stat-card-value" value={summary.totalInvested} format={formatCurrency} />
              </div>
              <div className="stat-card-icon icon-purple-soft"><PiggyBank size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Total P&L</span>
                <AnimatedNumber className={`stat-card-value ${getPnLClass(summary.totalProfitLoss)}`} value={summary.totalProfitLoss} format={formatCurrency} />
              </div>
              <div className={`stat-card-icon ${summary.totalProfitLoss >= 0 ? 'icon-green-solid' : 'icon-red-solid'}`}>
                {summary.totalProfitLoss >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Holdings</span>
                <AnimatedNumber className="stat-card-value" value={summary.holdingsCount || summary.totalHoldings || 0} format={(v) => Math.round(v)} />
              </div>
              <div className="stat-card-icon icon-purple-soft"><Layers size={22} /></div>
            </div>
          </div>

          {/* Monthly Report + Summary side by side */}
          <div className="grid-2 mb-6" style={{ alignItems: 'stretch' }}>
            {/* Monthly Investment Report */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="stat-card-icon icon-purple-soft" style={{ color: 'var(--accent)' }}><Calendar size={22} /></div>
                <div>
                  <h3 className="card-title" style={{ marginBottom: 2 }}>Monthly Investment Report</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Detailed breakdown of monthly transactions</p>
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                <select
                  className="input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ width: '100%', appearance: 'none', paddingRight: 40 }}
                >
                  {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={downloadMonthlyReport} disabled={monthlyLoading}>
                <Download size={16} /> Download Report
              </button>
            </div>

            {/* Monthly Summary — Purchases/Sales on top, Profit/Loss below */}
            <div className="card">
              <h3 className="card-title mb-4 flex items-center gap-2">
                <BarChart3 size={20} style={{ color: 'var(--primary)' }} /> Monthly Summary - {selectedMonthLabel}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
                {[
                  { label: 'Purchases', value: formatCurrency(monthlySummary.purchases), color: 'var(--accent)' },
                  { label: 'Sales', value: formatCurrency(monthlySummary.sales), color: 'var(--danger)' },
                  { label: 'Profit', value: formatCurrency(monthlySummary.profit), color: 'var(--accent)' },
                  { label: 'Loss', value: formatCurrency(monthlySummary.loss), color: 'var(--danger)' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.value}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Family Members (family report) */}
          {reportType === 'family' && reportData.memberSummary && (
            <div className="card mb-6">
              <h3 className="card-title mb-4">Member-wise Wealth</h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Member</th><th>Role</th><th>Wealth</th><th>Invested</th><th>P&L</th></tr></thead>
                  <tbody>
                    {reportData.memberSummary.map((m, i) => (
                      <tr key={i}>
                        <td className="font-medium">{m.name}</td>
                        <td><span className={`badge ${m.role === 'head' ? 'badge-primary' : 'badge-neutral'}`}>{m.role}</span></td>
                        <td className="font-semibold">{formatCurrency(m.totalWealth)}</td>
                        <td>{formatCurrency(m.totalInvested)}</td>
                        <td className={getPnLClass(m.profitLoss)}>{formatCurrency(m.profitLoss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}
