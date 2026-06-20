const express = require('express');
const router = express.Router();
const { getMyTransactions, addTransaction, updateTransaction, deleteTransaction, deleteAllTransactions } = require('../controllers/transactionController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', getMyTransactions);
router.post('/', addTransaction);
router.delete('/all', deleteAllTransactions);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
