const cron = require('node-cron');
const User = require('../models/User');
const Holding = require('../models/Holding');
const PortfolioSnapshot = require('../models/PortfolioSnapshot');

// Function to take a snapshot for a specific date
const takeSnapshots = async (date = new Date()) => {
  try {
    console.log(`[CRON] Starting portfolio snapshots for date: ${date.toISOString()}`);
    
    // Normalize date to start of day in UTC to prevent duplicates
    const snapshotDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const users = await User.find({});
    let successCount = 0;

    for (const user of users) {
      const holdings = await Holding.find({ userId: user._id });
      
      let totalWealth = 0;
      let totalInvested = 0;
      let totalProfitLoss = 0;

      holdings.forEach(h => {
        totalWealth += h.currentValue || 0;
        totalInvested += h.totalInvested || 0;
        totalProfitLoss += h.profitLoss || 0;
      });

      // Update or create the snapshot for this user and date
      await PortfolioSnapshot.findOneAndUpdate(
        { userId: user._id, date: snapshotDate },
        {
          totalWealth,
          totalInvested,
          totalProfitLoss
        },
        { upsert: true, new: true }
      );
      
      successCount++;
    }

    const Family = require('../models/Family');
    const FamilyMembership = require('../models/FamilyMembership');
    
    // 2. Family Snapshots
    const families = await Family.find({});
    let familySuccessCount = 0;

    for (const family of families) {
      const memberships = await FamilyMembership.find({ familyId: family._id });
      const memberIds = memberships.map(m => m.userId);

      const familyHoldings = await Holding.find({ userId: { $in: memberIds } });

      let fTotalWealth = 0;
      let fTotalInvested = 0;
      let fTotalProfitLoss = 0;

      familyHoldings.forEach(h => {
        fTotalWealth += h.currentValue || 0;
        fTotalInvested += h.totalInvested || 0;
        fTotalProfitLoss += h.profitLoss || 0;
      });

      await PortfolioSnapshot.findOneAndUpdate(
        { familyId: family._id, date: snapshotDate },
        {
          totalWealth: fTotalWealth,
          totalInvested: fTotalInvested,
          totalProfitLoss: fTotalProfitLoss
        },
        { upsert: true, new: true }
      );
      
      familySuccessCount++;
    }

    console.log(`[CRON] Finished portfolio snapshots. Processed ${successCount} users and ${familySuccessCount} families.`);
  } catch (error) {
    console.error('[CRON] Error taking portfolio snapshots:', error);
  }
};

// Schedule the cron job to run every day at 23:59
const initCronJobs = () => {
  cron.schedule('59 23 * * *', () => {
    takeSnapshots();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // Running in Indian Standard Time (as it's wealth tracking for India typically)
  });
  
  console.log('[CRON] Scheduled daily portfolio snapshot job.');
};

module.exports = {
  initCronJobs,
  takeSnapshots
};
