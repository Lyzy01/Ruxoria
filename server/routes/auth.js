const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware');

const router = express.Router();

router.post('/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required.' });

    const cleanUser = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
      return res.status(400).json({ error: 'Username must be 3-20 alphanumeric characters or underscores.' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUser, cleanEmail);
    if (existing) return res.status(409).json({ error: 'Username or email already taken.' });

    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const isFirst = userCount === 0;
    const role = isFirst ? 'OWNER' : 'USER';
    const verified = isFirst ? 1 : 0;
    const korbux = isFirst ? 25000 : 500;

    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (username, email, password_hash, role, korbux, verified) VALUES (?, ?, ?, ?, ?, ?)').run(cleanUser, cleanEmail, hash, role, korbux, verified);
    const userId = info.lastInsertRowid;

    // Give starter item
    const starter = db.prepare("SELECT id FROM catalog_items WHERE name = 'Starter Visor'").get();
    if (starter) db.prepare('INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)').run(userId, starter.id);

    const user = db.prepare('SELECT id, username, email, role, korbux, verified FROM users WHERE id = ?').get(userId);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user,
      message: isFirst ? 'Founder registered with OWNER privileges!' : 'Account created with +500 Ruxbux!'
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Credentials required.' });

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(identifier.trim(), identifier.trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    if (user.banned) return res.status(403).json({ error: `Account suspended: ${user.ban_reason}` });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const announcement = db.prepare('SELECT * FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 1').get();
  res.json({ user: req.user, announcement: announcement || null });
});

router.post('/stipend', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  if (req.user.last_stipend === today) {
    return res.status(400).json({ error: 'Daily stipend already claimed today.' });
  }
  db.prepare('UPDATE users SET korbux = korbux + 50, last_stipend = ? WHERE id = ?').run(today, req.user.id);
  const updated = db.prepare('SELECT korbux FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '+50 Ruxbux Daily Stipend claimed!', korbux: updated.korbux });
});

// Lookup another player's public inventory for trading
router.get('/users/:username/inventory', authenticateToken, (req, res) => {
  const target = db.prepare('SELECT id, username, korbux, verified FROM users WHERE username = ? AND banned = 0').get(req.params.username.trim());
  if (!target) return res.status(404).json({ error: 'Player not found.' });

  const items = db.prepare(`
    SELECT ui.id as inventory_id, ui.resale_price, c.*
    FROM user_inventory ui
    JOIN catalog_items c ON c.id = ui.item_id
    WHERE ui.user_id = ?
    ORDER BY c.rap DESC
  `).all(target.id);

  res.json({ user: target, items });
});

module.exports = router;
