const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');
const FamilyMembership = require('../models/FamilyMembership');

// GET /api/reports/individual
exports.getIndividualReport = async (req, res) => {
  try {
    const holdings = await Holding.find({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 });

    let totalWealth = 0, totalInvested = 0, totalProfitLoss = 0;
    const assetBreakdown = {};

    holdings.forEach(h => {
      totalWealth += h.currentValue || 0;
      totalInvested += h.totalInvested || 0;
      totalProfitLoss += h.profitLoss || 0;

      if (!assetBreakdown[h.assetType]) {
        assetBreakdown[h.assetType] = { count: 0, value: 0, invested: 0, pnl: 0 };
      }
      assetBreakdown[h.assetType].count++;
      assetBreakdown[h.assetType].value += h.currentValue || 0;
      assetBreakdown[h.assetType].invested += h.totalInvested || 0;
      assetBreakdown[h.assetType].pnl += h.profitLoss || 0;
    });

    res.json({
      summary: {
        totalWealth,
        totalInvested,
        totalProfitLoss,
        profitLossPercent: totalInvested > 0 ? ((totalProfitLoss / totalInvested) * 100).toFixed(2) : 0,
        holdingsCount: holdings.length,
        transactionsCount: transactions.length
      },
      assetBreakdown,
      holdings,
      transactions: transactions.slice(0, 50)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report.', error: error.message });
  }
};

// GET /api/reports/family/:familyId — Head only: family-wide report
exports.getFamilyReport = async (req, res) => {
  try {
    const { familyId } = req.params;

    // Verify requesting user is in this family
    const reqMembership = await FamilyMembership.findOne({ userId: req.userId, familyId });
    if (!reqMembership) {
      return res.status(403).json({ message: 'You are not a member of this family.' });
    }

    const memberships = await FamilyMembership.find({ familyId }).populate('userId', 'firstName lastName email');
    const userIds = memberships.map(m => m.userId._id);

    const holdings = await Holding.find({ userId: { $in: userIds } });
    const transactions = await Transaction.find({ userId: { $in: userIds } }).sort({ date: -1 });

    let totalWealth = 0, totalInvested = 0, totalProfitLoss = 0;
    const assetBreakdown = {};
    const memberSummary = {};

    memberships.forEach(m => {
      memberSummary[m.userId._id.toString()] = {
        name: `${m.userId.firstName} ${m.userId.lastName}`,
        email: m.userId.email,
        role: m.role,
        totalWealth: 0,
        totalInvested: 0,
        profitLoss: 0
      };
    });

    holdings.forEach(h => {
      totalWealth += h.currentValue || 0;
      totalInvested += h.totalInvested || 0;
      totalProfitLoss += h.profitLoss || 0;

      if (!assetBreakdown[h.assetType]) {
        assetBreakdown[h.assetType] = { count: 0, value: 0, invested: 0, pnl: 0 };
      }
      assetBreakdown[h.assetType].count++;
      assetBreakdown[h.assetType].value += h.currentValue || 0;
      assetBreakdown[h.assetType].invested += h.totalInvested || 0;
      assetBreakdown[h.assetType].pnl += h.profitLoss || 0;

      const uid = h.userId.toString();
      if (memberSummary[uid]) {
        memberSummary[uid].totalWealth += h.currentValue || 0;
        memberSummary[uid].totalInvested += h.totalInvested || 0;
        memberSummary[uid].profitLoss += h.profitLoss || 0;
      }
    });

    res.json({
      familySummary: {
        totalWealth,
        totalInvested,
        totalProfitLoss,
        profitLossPercent: totalInvested > 0 ? ((totalProfitLoss / totalInvested) * 100).toFixed(2) : 0,
        totalMembers: memberships.length,
        totalHoldings: holdings.length
      },
      assetBreakdown,
      memberSummary: Object.values(memberSummary),
      recentTransactions: transactions.slice(0, 100),
      holdings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating family report.', error: error.message });
  }
};
