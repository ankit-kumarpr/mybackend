const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Missing auth header' });
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.id);
    if (!user || !user.active) return res.status(403).json({ message: 'Account disabled or not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token', error: err.message });
  }
}

module.exports = authMiddleware;
