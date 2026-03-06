const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, forgotPassword } = require('../controllers/authController');
const limiter = require('../middlewares/rateLimitMiddleware');

router.post('/register', register);
router.post('/login', limiter, login); // Rate limit sur login
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);

module.exports = router;