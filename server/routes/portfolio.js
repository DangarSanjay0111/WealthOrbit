const express = require('express');
const router = express.Router();
const { 
  getMyHoldings, getMemberHoldings, getFamilyHoldings, 
  addHolding, updateHolding, deleteHolding, 
  getPortfolioSummary, getSnapshots, generateBackfill,
  getFamilySnapshots, generateFamilyBackfill, getTransactionTimeline,
  getTodaysGain, getFamilyTodaysGain
} = require('../controllers/portfolioController');
const auth = require('../middleware/auth');
const familyAccess = require('../middleware/familyAccess');

router.use(auth);

// Personal routes (no family needed)
router.get('/', getMyHoldings);
router.get('/summary', getPortfolioSummary);
router.get('/todays-gain', getTodaysGain);
router.get('/snapshots', getSnapshots);
router.get('/timeline', getTransactionTimeline);
router.post('/snapshots/backfill', generateBackfill);
router.post('/holdings', addHolding);
router.put('/holdings/:id', updateHolding);
router.delete('/holdings/:id', deleteHolding);

// Family specific routes
router.get('/member/:userId', getMemberHoldings);
router.get('/family/:familyId', familyAccess('member'), getFamilyHoldings);
router.get('/family/:familyId/todays-gain', familyAccess('member'), getFamilyTodaysGain);
router.get('/family/:familyId/snapshots', familyAccess('member'), getFamilySnapshots);
router.post('/family/:familyId/snapshots/backfill', familyAccess('member'), generateFamilyBackfill);

module.exports = router;
