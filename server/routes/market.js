const express = require('express');
const router = express.Router();
const {
  getStockPrice, getMutualFundNAV, getGoldPrice,
  getSilverPrice, refreshPrices, searchMarket
} = require('../controllers/marketController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/search', searchMarket);
router.get('/stock/:symbol', getStockPrice);
router.get('/mf/:schemeCode', getMutualFundNAV);
router.get('/gold', getGoldPrice);
router.get('/silver', getSilverPrice);
router.post('/refresh', refreshPrices);

module.exports = router;
