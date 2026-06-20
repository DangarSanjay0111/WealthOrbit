const mongoose = require('mongoose');

const portfolioSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for family snapshots
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: false // Optional for individual snapshots
  },
  date: {
    type: Date,
    required: true
  },
  totalWealth: {
    type: Number,
    required: true,
    default: 0
  },
  totalInvested: {
    type: Number,
    required: true,
    default: 0
  },
  totalProfitLoss: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

// Ensure we only have one snapshot per user/family per day
// If it's a family snapshot, userId is null. If it's an individual snapshot, familyId is null.
// By indexing both, we guarantee uniqueness for the combination.
portfolioSnapshotSchema.index({ userId: 1, familyId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PortfolioSnapshot', portfolioSnapshotSchema);
