const express = require('express');
const router = express.Router();
const { uploadReport, confirmUpload, getUploadHistory } = require('../controllers/uploadController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(auth);

router.post('/demat-report', upload.single('report'), uploadReport);
router.post('/:id/confirm', confirmUpload);
router.get('/history', getUploadHistory);

module.exports = router;
