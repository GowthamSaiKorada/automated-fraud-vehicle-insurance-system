const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_in_production_32chars';
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. Missing Bearer token.' });
    }

    const token = authHeader.slice(7).trim();
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, getJwtSecret };
