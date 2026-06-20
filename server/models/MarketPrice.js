const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  date: Date,
  price: Number
}, { _id: false });

const marketPriceSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  assetType: {
    type: String,
    required: true,
    enum: ['stock', 'mutual_fund', 'gold', 'silver']
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  price: {
    type: Number,
    default: 0
  },
  previousClose: {
    type: Number,
    default: 0
  },
  dayChange: {
    type: Number,
    default: 0
  },
  dayChangePercent: {
    type: Number,
    default: 0
  },
  high52w: {
    type: Number,
    default: 0
  },
  low52w: {
    type: Number,
    default: 0
  },
  lastFetched: {
    type: Date,
    default: Date.now
  },
  history: [priceHistorySchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('MarketPrice', marketPriceSchema);
