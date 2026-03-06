const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10min
  max: 5, // 5 tentatives
  message: 'Trop de tentatives, réessayez dans 10min'
});
module.exports = limiter;