const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000), // e.g., 1 minute
  max: Number(process.env.RATE_LIMIT_MAX || 10000), // limit each IP
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = limiter;
