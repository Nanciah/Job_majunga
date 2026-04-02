const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  refresh, 
  logout, 
  forgotPassword,
  resetPassword,      
  changePassword      
} = require('../controllers/authController');
const limiter = require('../middlewares/rateLimitMiddleware');
const auth = require('../middlewares/jwtMiddleware'); 

router.post('/register', register);
router.post('/login', limiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);           
router.put('/change-password', auth, changePassword);   

module.exports = router;