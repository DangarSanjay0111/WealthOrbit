const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword, updateTheme } = require('../controllers/userController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.put('/theme', updateTheme);

module.exports = router;
