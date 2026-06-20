// Currency formatter
export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

// Compact number (e.g., 1.2L, 3.5Cr)
export const formatCompact = (num) => {
  if (num === null || num === undefined) return '0';
  const abs = Math.abs(num);
  if (abs >= 1e7) return `${(num / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(num / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(2);
};

// Percentage formatter
export const formatPercent = (value) => {
  if (value === null || value === undefined) return '0%';
  const num = parseFloat(value);
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

// Date formatter
export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// DateTime formatter
export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Asset type display labels
export const assetTypeLabels = {
  stock: 'Stocks',
  mutual_fund: 'Mutual Funds',
  gold: 'Gold',
  silver: 'Silver',
  fixed_deposit: 'Fixed Deposits',
  other_income: 'Other Income'
};

// Asset type colors
export const assetTypeColors = {
  stock: 'var(--color-stock)',
  mutual_fund: 'var(--color-mf)',
  gold: 'var(--color-gold)',
  silver: 'var(--color-silver)',
  fixed_deposit: 'var(--color-fd)',
  other_income: 'var(--color-other)'
};

// P&L class
export const getPnLClass = (value) => {
  if (value > 0) return 'text-gain';
  if (value < 0) return 'text-loss';
  return 'text-neutral';
};

// Get initials
export const getInitials = (firstName, lastName) => {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
};
