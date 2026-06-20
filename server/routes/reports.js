const express = require('express');
const router = express.Router();
const { getIndividualReport, getFamilyReport } = require('../controllers/reportController');
const auth = require('../middleware/auth');
const familyAccess = require('../middleware/familyAccess');

router.use(auth);

// Individual report gets all personal holdings, no familyAccess needed.
router.get('/individual', getIndividualReport);

// Family report gets all holdings for the given family
router.get('/family/:familyId', getFamilyReport); // We handle family access inside the controller directly

module.exports = router;
