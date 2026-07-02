const Holding = require('../models/Holding');
const FamilyMembership = require('../models/FamilyMembership');

// GET /api/portfolio — Own holdings
exports.getMyHoldings = async (req, res) => {
  try {
    const { assetType } = req.query;

    const filter = { userId: req.userId };
    if (assetType) filter.assetType = assetType;

    const holdings = await Holding.find(filter).sort({ assetType: 1, name: 1 });

    // Group by asset type
    const grouped = {};
    holdings.forEach(h => {
      if (!grouped[h.assetType]) grouped[h.assetType] = [];
      grouped[h.assetType].push(h);
    });

    res.json({ holdings, grouped });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching holdings.', error: error.message });
  }
};

// GET /api/portfolio/member/:userId?familyId=X — View member's holdings
exports.getMemberHoldings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { familyId } = req.query;

    // Verify both users are in the same family
    const reqMembership = await FamilyMembership.findOne({ userId: req.userId, familyId });
    const targetMembership = await FamilyMembership.findOne({ userId, familyId });

    if (!reqMembership || !targetMembership) {
      return res.status(404).json({ message: 'Member not found in your family.' });
    }

    const holdings = await Holding.find({ userId }).sort({ assetType: 1, name: 1 });

    const grouped = {};
    holdings.forEach(h => {
      if (!grouped[h.assetType]) grouped[h.assetType] = [];
      grouped[h.assetType].push(h);
    });

    res.json({ holdings, grouped });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member holdings.', error: error.message });
  }
};

// GET /api/portfolio/family/:familyId — Combined family wealth
exports.getFamilyHoldings = async (req, res) => {
  try {
    const { familyId } = req.params;

    const memberships = await FamilyMembership.find({ familyId })
      .populate('userId', 'firstName lastName email avatar');

    const memberIds = memberships.map(m => m.userId._id);
    const holdings = await Holding.find({ userId: { $in: memberIds } });

    // Aggregate by member
    const memberWealth = {};
    memberships.forEach(m => {
      memberWealth[m.userId._id.toString()] = {
        user: m.userId,
        role: m.role,
        totalWealth: 0,
        totalInvested: 0,
        totalProfitLoss: 0,
        holdingsCount: 0
      };
    });

    // Aggregate totals
    let totalFamilyWealth = 0;
    let totalFamilyInvested = 0;
    let totalFamilyProfitLoss = 0;
    const assetAllocation = {};

    holdings.forEach(h => {
      const uid = h.userId.toString();
      if (memberWealth[uid]) {
        memberWealth[uid].totalWealth += h.currentValue || 0;
        memberWealth[uid].totalInvested += h.totalInvested || 0;
        memberWealth[uid].totalProfitLoss += h.profitLoss || 0;
        memberWealth[uid].holdingsCount += 1;
      }

      totalFamilyWealth += h.currentValue || 0;
      totalFamilyInvested += h.totalInvested || 0;
      totalFamilyProfitLoss += h.profitLoss || 0;

      if (!assetAllocation[h.assetType]) {
        assetAllocation[h.assetType] = 0;
      }
      assetAllocation[h.assetType] += h.currentValue || 0;
    });

    res.json({
      totalFamilyWealth,
      totalFamilyInvested,
      totalFamilyProfitLoss,
      profitLossPercent: totalFamilyInvested > 0
        ? ((totalFamilyProfitLoss / totalFamilyInvested) * 100).toFixed(2)
        : 0,
      assetAllocation,
      memberWealth: Object.values(memberWealth),
      totalMembers: memberships.length,
      totalHoldings: holdings.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching family holdings.', error: error.message });
  }
};

// GET /api/portfolio/summary — Wealth summary for current user
exports.getPortfolioSummary = async (req, res) => {
  try {
    const holdings = await Holding.find({ userId: req.userId });

    let totalWealth = 0;
    let totalInvested = 0;
    let totalProfitLoss = 0;
    const assetAllocation = {};
    const assetBreakdown = {};

    holdings.forEach(h => {
      totalWealth += h.currentValue || 0;
      totalInvested += h.totalInvested || 0;
      totalProfitLoss += h.profitLoss || 0;

      if (!assetAllocation[h.assetType]) {
        assetAllocation[h.assetType] = 0;
      }
      assetAllocation[h.assetType] += h.currentValue || 0;

      if (!assetBreakdown[h.assetType]) {
        assetBreakdown[h.assetType] = { invested: 0, currentValue: 0, profitLoss: 0, count: 0 };
      }
      assetBreakdown[h.assetType].invested += h.totalInvested || 0;
      assetBreakdown[h.assetType].currentValue += h.currentValue || 0;
      assetBreakdown[h.assetType].profitLoss += h.profitLoss || 0;
      assetBreakdown[h.assetType].count += 1;
    });

    res.json({
      totalWealth,
      totalInvested,
      totalProfitLoss,
      profitLossPercent: totalInvested > 0
        ? ((totalProfitLoss / totalInvested) * 100).toFixed(2)
        : 0,
      assetAllocation,
      assetBreakdown,
      holdingsCount: holdings.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching summary.', error: error.message });
  }
};

// POST /api/portfolio/holdings — Add a holding
exports.addHolding = async (req, res) => {
  try {
    const holdingData = {
      userId: req.userId,
      ...req.body
    };

    const holding = await Holding.create(holdingData);
    res.status(201).json({ message: 'Holding added.', holding });
  } catch (error) {
    res.status(500).json({ message: 'Error adding holding.', error: error.message });
  }
};

// PUT /api/portfolio/holdings/:id — Update a holding
exports.updateHolding = async (req, res) => {
  try {
    const holding = await Holding.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!holding) {
      return res.status(404).json({ message: 'Holding not found.' });
    }

    const allowedUpdates = ['name', 'symbol', 'isin', 'quantity', 'avgBuyPrice',
      'currentPrice', 'nav', 'units', 'principalAmount', 'interestRate',
      'maturityDate', 'maturityAmount', 'bankName', 'weightGrams',
      'purityKarat', 'description', 'amount', 'totalInvested'];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        holding[field] = req.body[field];
      }
    });

    holding.lastUpdated = new Date();
    await holding.save();

    res.json({ message: 'Holding updated.', holding });
  } catch (error) {
    res.status(500).json({ message: 'Error updating holding.', error: error.message });
  }
};

// DELETE /api/portfolio/holdings/:id — Delete a holding
exports.deleteHolding = async (req, res) => {
  try {
    const holding = await Holding.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!holding) {
      return res.status(404).json({ message: 'Holding not found.' });
    }

    res.json({ message: 'Holding deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting holding.', error: error.message });
  }
};

const PortfolioSnapshot = require('../models/PortfolioSnapshot');

// GET /api/portfolio/snapshots — Get historical snapshots for charting
exports.getSnapshots = async (req, res) => {
  try {
    const { period = 'Monthly' } = req.query;

    let daysToFetch = 30;
    if (period === 'Weekly') daysToFetch = 7;
    if (period === 'Yearly') daysToFetch = 365;
    // Daily could mean last 24 hours, but since we take daily snapshots, maybe last 7 or 14 days is better for 'Daily' view? Let's use 14.
    if (period === 'Daily') daysToFetch = 14;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);

    const snapshots = await PortfolioSnapshot.find({
      userId: req.userId,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    res.json({ snapshots });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching snapshots.', error: error.message });
  }
};

// GET /api/portfolio/timeline — Build wealth timeline from actual transactions
exports.getTransactionTimeline = async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const { period = 'Monthly' } = req.query;

    let daysToFetch = 30;
    if (period === 'Weekly') daysToFetch = 7;
    if (period === 'Yearly') daysToFetch = 365;
    if (period === 'Daily') daysToFetch = 14;

    const transactions = await Transaction.find({ userId: req.userId }).sort({ date: 1 });

    if (!transactions.length) {
      return res.json({ snapshots: [] });
    }

    // Build a cumulative "money invested" series across full history.
    // A buy adds its amount on its date; a sell subtracts its amount on its date.
    let cumulative = 0;
    const dailyMap = new Map(); // dayKey (UTC midnight ISO) -> cumulative value at end of that day
    transactions.forEach(t => {
      const delta = t.type === 'sell' ? -(t.totalAmount || 0) : (t.totalAmount || 0);
      cumulative += delta;
      const d = new Date(t.date);
      const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
      dailyMap.set(key, cumulative); // last write per day wins → end-of-day balance
    });

    const fullSeries = Array.from(dailyMap.entries())
      .map(([date, value]) => ({ date, totalWealth: value }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Window the series to the requested period.
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    startDate.setHours(0, 0, 0, 0);

    const before = fullSeries.filter(p => new Date(p.date) < startDate);
    const within = fullSeries.filter(p => new Date(p.date) >= startDate);

    const series = [];
    // Baseline: carry the last value from before the window so the line starts correctly.
    if (before.length) {
      series.push({ date: startDate.toISOString(), totalWealth: before[before.length - 1].totalWealth });
    }
    series.push(...within);

    // Extend the line to today with the latest cumulative value.
    const finalVal = fullSeries[fullSeries.length - 1].totalWealth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPointDate = series.length ? new Date(series[series.length - 1].date) : null;
    if (!lastPointDate || lastPointDate.getTime() !== today.getTime()) {
      series.push({ date: today.toISOString(), totalWealth: finalVal });
    }

    res.json({ snapshots: series });
  } catch (error) {
    res.status(500).json({ message: 'Error building timeline.', error: error.message });
  }
};

// POST /api/portfolio/snapshots/backfill — Generate demo history
exports.generateBackfill = async (req, res) => {
  try {
    // 1. Get current wealth
    const holdings = await Holding.find({ userId: req.userId });
    let currentWealth = 0;
    let currentInvested = 0;

    holdings.forEach(h => {
      currentWealth += h.currentValue || 0;
      currentInvested += h.totalInvested || 0;
    });

    if (currentWealth === 0 && currentInvested === 0) {
      return res.status(400).json({ message: 'Add some holdings first to generate a meaningful history.' });
    }

    // 2. Generate past 365 days of data backwards from today
    const snapshots = [];
    const now = new Date();
    // Normalize to UTC midnight
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let simulatedWealth = currentWealth;
    let simulatedInvested = currentInvested;

    for (let i = 0; i <= 365; i++) {
      const snapDate = new Date(today);
      snapDate.setDate(snapDate.getDate() - i);

      snapshots.push({
        userId: req.userId,
        date: snapDate,
        totalWealth: simulatedWealth,
        totalInvested: simulatedInvested,
        totalProfitLoss: simulatedWealth - simulatedInvested
      });

      // Reverse engineer past values (simulate a random daily market move between -1.5% and +1.5%)
      // Because we are going backwards, if the market went UP yesterday, the wealth yesterday was LOWER.
      // So we divide by the random factor.
      const dailyChange = 1 + (Math.random() * 0.03 - 0.014);
      simulatedWealth = simulatedWealth / dailyChange;

      // Assume invested capital grew slightly over the year
      if (Math.random() < 0.05) { // 5% chance of a capital injection day in the past
        simulatedInvested = simulatedInvested * 0.95;
      }
    }

    // 3. Clear old ones and insert new
    await PortfolioSnapshot.deleteMany({ userId: req.userId });
    await PortfolioSnapshot.insertMany(snapshots.reverse()); // Insert chronologically

    res.json({ message: 'Demo history generated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error generating demo history.', error: error.message });
  }
};

// GET /api/portfolio/family/:familyId/snapshots — Build family wealth timeline from members' transactions
exports.getFamilySnapshots = async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const { familyId } = req.params;
    const { period = 'Monthly' } = req.query;

    let daysToFetch = 30;
    if (period === 'Weekly') daysToFetch = 7;
    if (period === 'Yearly') daysToFetch = 365;
    if (period === 'Daily') daysToFetch = 14;

    // Gather all members of the family, then all their transactions.
    const memberships = await require('../models/FamilyMembership').find({ familyId });
    const memberIds = memberships.map(m => m.userId);

    const transactions = await Transaction.find({ userId: { $in: memberIds } }).sort({ date: 1 });

    if (!transactions.length) {
      return res.json({ snapshots: [] });
    }

    // Build a cumulative "money invested" series across the family's full history.
    // A buy adds its amount on its date; a sell subtracts its amount on its date.
    let cumulative = 0;
    const dailyMap = new Map(); // dayKey (UTC midnight ISO) -> cumulative value at end of that day
    transactions.forEach(t => {
      const delta = t.type === 'sell' ? -(t.totalAmount || 0) : (t.totalAmount || 0);
      cumulative += delta;
      const d = new Date(t.date);
      const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
      dailyMap.set(key, cumulative); // last write per day wins → end-of-day balance
    });

    const fullSeries = Array.from(dailyMap.entries())
      .map(([date, value]) => ({ date, totalWealth: value }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Window the series to the requested period.
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    startDate.setHours(0, 0, 0, 0);

    const before = fullSeries.filter(p => new Date(p.date) < startDate);
    const within = fullSeries.filter(p => new Date(p.date) >= startDate);

    const series = [];
    // Baseline: carry the last value from before the window so the line starts correctly.
    if (before.length) {
      series.push({ date: startDate.toISOString(), totalWealth: before[before.length - 1].totalWealth });
    }
    series.push(...within);

    // Extend the line to today with the latest cumulative value.
    const finalVal = fullSeries[fullSeries.length - 1].totalWealth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPointDate = series.length ? new Date(series[series.length - 1].date) : null;
    if (!lastPointDate || lastPointDate.getTime() !== today.getTime()) {
      series.push({ date: today.toISOString(), totalWealth: finalVal });
    }

    res.json({ snapshots: series });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching family snapshots.', error: error.message });
  }
};

// POST /api/portfolio/family/:familyId/snapshots/backfill — Generate demo history for family
exports.generateFamilyBackfill = async (req, res) => {
  try {
    const { familyId } = req.params;

    const memberships = await require('../models/FamilyMembership').find({ familyId });
    const memberIds = memberships.map(m => m.userId);

    const holdings = await Holding.find({ userId: { $in: memberIds } });

    let currentWealth = 0;
    let currentInvested = 0;

    holdings.forEach(h => {
      currentWealth += h.currentValue || 0;
      currentInvested += h.totalInvested || 0;
    });

    if (currentWealth === 0 && currentInvested === 0) {
      return res.status(400).json({ message: 'Family needs holdings first to generate a meaningful history.' });
    }

    const snapshots = [];
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let simulatedWealth = currentWealth;
    let simulatedInvested = currentInvested;

    for (let i = 0; i <= 365; i++) {
      const snapDate = new Date(today);
      snapDate.setDate(snapDate.getDate() - i);

      snapshots.push({
        familyId,
        date: snapDate,
        totalWealth: simulatedWealth,
        totalInvested: simulatedInvested,
        totalProfitLoss: simulatedWealth - simulatedInvested
      });

      const dailyChange = 1 + (Math.random() * 0.03 - 0.014);
      simulatedWealth = simulatedWealth / dailyChange;

      if (Math.random() < 0.05) {
        simulatedInvested = simulatedInvested * 0.95;
      }
    }

    await PortfolioSnapshot.deleteMany({ familyId });
    await PortfolioSnapshot.insertMany(snapshots.reverse());

    res.json({ message: 'Family demo history generated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error generating family demo history.', error: error.message });
  }
};
