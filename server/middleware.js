const jwt = require('jsonwebtoken');
const { db } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'rokori_economy_secret_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, email, role, korbux, verified, banned, ban_reason FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    if (user.banned) return res.status(403).json({ error: `Account suspended: ${user.ban_reason}` });
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, korbux, verified, banned FROM users WHERE id = ?').get(decoded.id);
    if (user && !user.banned) req.user = user;
  } catch (_) {}
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !['MODERATOR', 'ADMIN', 'OWNER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Staff privileges required.' });
  }
  next();
}

module.exports = { JWT_SECRET, authenticateToken, optionalAuth, requireAdmin };
