const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assetType: {
    type: String,
    required: true,
    enum: ['stock', 'mutual_fund', 'gold', 'silver', 'fixed_deposit', 'other_income']
  },

  // Common fields
  name: {
    type: String,
    required: true,
    trim: true
  },
  symbol: {
    type: String,
    trim: true,
    default: ''
  },
  isin: {
    type: String,
    trim: true,
    default: ''
  },

  // Stock / MF
  quantity: { type: Number, default: 0 },
  avgBuyPrice: { type: Number, default: 0 },
  currentPrice: { type: Number, default: 0 },
  currentValue: { type: Number, default: 0 },
  totalInvested: { type: Number, default: 0 },
  profitLoss: { type: Number, default: 0 },
  profitLossPercent: { type: Number, default: 0 },

  // MF specific
  nav: { type: Number, default: 0 },
  units: { type: Number, default: 0 },

  // FD specific
  principalAmount: { type: Number, default: 0 },
  interestRate: { type: Number, default: 0 },
  maturityDate: { type: Date },
  maturityAmount: { type: Number, default: 0 },
  bankName: { type: String, trim: true, default: '' },

  // Gold / Silver
  weightGrams: { type: Number, default: 0 },
  purityKarat: { type: Number, default: 0 },

  // Other income (profit only)
  description: { type: String, trim: true, default: '' },
  amount: { type: Number, default: 0 },

  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for efficient queries
holdingSchema.index({ userId: 1, assetType: 1 });

// Pre-save: calculate derived fields
holdingSchema.pre('save', function(next) {
  if (['stock', 'mutual_fund', 'gold', 'silver'].includes(this.assetType)) {
    this.currentValue = this.quantity * this.currentPrice;
    this.totalInvested = this.quantity * this.avgBuyPrice;
    this.profitLoss = this.currentValue - this.totalInvested;
    this.profitLossPercent = this.totalInvested > 0
      ? ((this.profitLoss / this.totalInvested) * 100)
      : 0;
  } else if (this.assetType === 'fixed_deposit') {
    this.currentValue = this.principalAmount;
    this.totalInvested = this.principalAmount;
  } else if (this.assetType === 'other_income') {
    this.currentValue = this.amount;
    this.profitLoss = this.amount;
  }
  next();
});

module.exports = mongoose.model('Holding', holdingSchema);
