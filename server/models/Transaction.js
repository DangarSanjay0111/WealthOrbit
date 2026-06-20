const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  holdingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Holding'
  },
  assetType: {
    type: String,
    required: true,
    enum: ['stock', 'mutual_fund', 'gold', 'silver', 'fixed_deposit', 'other_income']
  },
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
  type: {
    type: String,
    required: true,
    enum: ['buy', 'sell']
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  source: {
    type: String,
    enum: ['manual', 'ai_upload'],
    default: 'manual'
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ assetType: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
