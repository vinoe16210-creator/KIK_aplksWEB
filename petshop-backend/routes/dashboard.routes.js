const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getSummary } = require('../controllers/dashboardController');

router.use(verifyToken);
router.get('/summary', getSummary);

module.exports = router;
