const jwt = require('jsonwebtoken');
require('dotenv').config();

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireManager(req, res, next) {
  if (!req.admin || req.admin.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can access this section.' });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireManager = requireManager;
