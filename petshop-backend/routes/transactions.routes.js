const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { checkout, getTransactions } = require('../controllers/transactionController');

router.use(verifyToken);

router.get('/', getTransactions);
router.post('/checkout', checkout);

module.exports = router;
