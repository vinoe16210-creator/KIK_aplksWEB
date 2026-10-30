const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

router.post('/register', register); // dipakai untuk setup awal akun owner
router.post('/login', login);

module.exports = router;
