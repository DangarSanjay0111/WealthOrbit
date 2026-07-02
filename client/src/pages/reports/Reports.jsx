import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFamily } from '../../context/FamilyContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatCurrency, formatPercent, assetTypeLabels, getPnLClass } from '../../utils/formatters';
import { FileText, Download, Users, Wallet, PiggyBank, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { assetTypeColors } from '../../utils/formatters';
import AnimatedNumber from '../../components/common/AnimatedNumber';

export default function Reports() {
  const { activeFamily, switchFamily, families } = useFamily();
  const { error: showError, success } = useToast();
  const [reportType, setReportType] = useState('individual');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

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
  const breakdown = reportData?.assetBreakdown || {};
  const allocationData = Object.entries(breakdown).map(([key, val]) => ({
    name: assetTypeLabels[key] || key,
    value: val.value || val,
    color: assetTypeColors[key]
  }));

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
                <span className="stat-card-value">{formatCurrency(summary.totalWealth)}</span>
              </div>
              <div className="stat-card-icon icon-purple-solid"><Wallet size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Total Invested</span>
                <span className="stat-card-value">{formatCurrency(summary.totalInvested)}</span>
              </div>
              <div className="stat-card-icon icon-purple-soft"><PiggyBank size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Total P&L</span>
                <span className={`stat-card-value ${getPnLClass(summary.totalProfitLoss)}`}>{formatCurrency(summary.totalProfitLoss)}</span>
              </div>
              <div className={`stat-card-icon ${summary.totalProfitLoss >= 0 ? 'icon-green-solid' : 'icon-red-solid'}`}>
                {summary.totalProfitLoss >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-body">
                <span className="stat-card-label">Holdings</span>
                <span className="stat-card-value">{summary.holdingsCount || summary.totalHoldings || 0}</span>
              </div>
              <div className="stat-card-icon icon-purple-soft"><Layers size={22} /></div>
            </div>
          </div>

          {/* Asset Breakdown Chart */}
          {allocationData.length > 0 && (
            <div className="grid-2 mb-6">
              <div className="card">
                <h3 className="card-title mb-4">Asset Allocation</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {allocationData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-primary)' }} formatter={v => formatCurrency(v)} />
                    <Legend formatter={val => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3 className="card-title mb-4">Asset Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {Object.entries(breakdown).map(([key, val]) => {
                    const data = typeof val === 'object' ? val : { value: val, count: 0, pnl: 0 };
                    return (
                      <div key={key} className="flex items-center justify-between" style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: assetTypeColors[key] }} />
                          <span className="font-medium text-sm">{assetTypeLabels[key]}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(data.value || data)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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

          {/* Holdings Table */}
          {reportData.holdings?.length > 0 && (
            <div className="card">
              <h3 className="card-title mb-4">Holdings Detail</h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Qty</th><th>Invested</th><th>Current Value</th><th>P&L</th><th>P&L %</th></tr></thead>
                  <tbody>
                    {reportData.holdings.map(h => (
                      <tr key={h._id}>
                        <td className="font-medium">{h.name}</td>
                        <td><span className="badge badge-neutral">{assetTypeLabels[h.assetType]}</span></td>
                        <td>{h.quantity || h.weightGrams || '-'}</td>
                        <td>{formatCurrency(h.totalInvested)}</td>
                        <td className="font-semibold">{formatCurrency(h.currentValue)}</td>
                        <td className={getPnLClass(h.profitLoss)}>{formatCurrency(h.profitLoss)}</td>
                        <td className={getPnLClass(h.profitLossPercent)}>{formatPercent(h.profitLossPercent)}</td>
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
