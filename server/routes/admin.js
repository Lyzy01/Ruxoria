const express = require('express');
const { db } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/overview', (req, res) => {
  const stats = {
    userCount: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    itemCount: db.prepare('SELECT COUNT(*) as c FROM catalog_items').get().c,
    tradeCount: db.prepare("SELECT COUNT(*) as c FROM trade_offers WHERE status = 'accepted'").get().c,
    totalEconomy: db.prepare('SELECT COALESCE(SUM(korbux), 0) as s FROM users').get().s
  };
  const users = db.prepare('SELECT id, username, email, role, korbux, verified, banned FROM users ORDER BY id ASC LIMIT 50').all();
  res.json({ stats, users });
});

router.post('/users/:id/korbux', (req, res) => {
  const amount = parseInt(req.body.amount, 10) || 0;
  db.prepare('UPDATE users SET korbux = MAX(0, korbux + ?) WHERE id = ?').run(amount, req.params.id);
  res.json({ message: 'Balance updated.' });
});

router.post('/announce', (req, res) => {
  const { message } = req.body;
  db.prepare('UPDATE announcements SET active = 0').run();
  const info = db.prepare('INSERT INTO announcements (message, author, active) VALUES (?, ?, 1)').run(message.trim(), req.user.username);
  const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid);
  const io = req.app.get('io');
  if (io) io.emit('global_announcement', ann);
  res.json({ message: 'Announcement broadcasted!' });
});

module.exports = router;
