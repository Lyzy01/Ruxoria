const express = require('express');
const { db } = require('../db');
const { authenticateToken } = require('../middleware');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const trades = db.prepare(`
    SELECT t.*, u.username as sender_name, r.username as receiver_name
    FROM trade_offers t
    JOIN users u ON u.id = t.sender_id
    JOIN users r ON r.id = t.receiver_id
    WHERE (t.sender_id = ? OR t.receiver_id = ?) AND t.status = 'pending'
    ORDER BY t.id DESC
  `).all(req.user.id, req.user.id);

  const itemsStmt = db.prepare(`
    SELECT ti.user_id, ti.inventory_id, c.id as item_id, c.name, c.icon, c.rap
    FROM trade_items ti
    JOIN catalog_items c ON c.id = ti.item_id
    WHERE ti.trade_id = ?
  `);

  const hydrated = trades.map(t => {
    const allItems = itemsStmt.all(t.id);
    return {
      ...t,
      sender_items: allItems.filter(i => i.user_id === t.sender_id),
      receiver_items: allItems.filter(i => i.user_id === t.receiver_id)
    };
  });

  res.json({ trades: hydrated });
});

router.post('/propose', authenticateToken, (req, res) => {
  const { receiverUsername, senderInventoryIds, receiverInventoryIds, senderRuxbux, receiverRuxbux } = req.body;
  if (!receiverUsername) return res.status(400).json({ error: 'Recipient username required.' });

  const target = db.prepare('SELECT id, username, korbux FROM users WHERE username = ? AND banned = 0').get(receiverUsername.trim());
  if (!target) return res.status(404).json({ error: 'Player not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot trade with yourself.' });

  const sRux = Math.max(0, Math.floor(Number(senderRuxbux) || 0));
  const rRux = Math.max(0, Math.floor(Number(receiverRuxbux) || 0));

  if (req.user.korbux < sRux) return res.status(400).json({ error: 'You do not have enough Ruxbux for this offer.' });
  if (target.korbux < rRux) return res.status(400).json({ error: `${target.username} does not have enough Ruxbux.` });

  const sIds = Array.isArray(senderInventoryIds) ? senderInventoryIds.map(Number) : [];
  const rIds = Array.isArray(receiverInventoryIds) ? receiverInventoryIds.map(Number) : [];

  if (sIds.length === 0 && rIds.length === 0 && sRux === 0 && rRux === 0) {
    return res.status(400).json({ error: 'Trade cannot be completely empty.' });
  }

  try {
    const tradeId = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO trade_offers (sender_id, receiver_id, sender_ruxbux, receiver_ruxbux)
        VALUES (?, ?, ?, ?)
      `).run(req.user.id, target.id, sRux, rRux);

      const tid = info.lastInsertRowid;
      const insertItem = db.prepare('INSERT INTO trade_items (trade_id, user_id, inventory_id, item_id) VALUES (?, ?, ?, ?)');

      for (const invId of sIds) {
        const inv = db.prepare('SELECT id, item_id FROM user_inventory WHERE id = ? AND user_id = ?').get(invId, req.user.id);
        if (!inv) throw new Error('One of your offered items is no longer available.');
        insertItem.run(tid, req.user.id, inv.id, inv.item_id);
      }

      for (const invId of rIds) {
        const inv = db.prepare('SELECT id, item_id FROM user_inventory WHERE id = ? AND user_id = ?').get(invId, target.id);
        if (!inv) throw new Error(`One of ${target.username}'s items is no longer available.`);
        insertItem.run(tid, target.id, inv.id, inv.item_id);
      }

      return tid;
    })();

    const io = req.app.get('io');
    if (io) io.to(`user_${target.id}`).emit('new_trade_offer', { from: req.user.username });

    res.status(201).json({ message: `Trade offer sent to ${target.username}!`, tradeId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/accept', authenticateToken, (req, res) => {
  const tradeId = Number(req.params.id);
  const trade = db.prepare("SELECT * FROM trade_offers WHERE id = ? AND receiver_id = ? AND status = 'pending'").get(tradeId, req.user.id);
  if (!trade) return res.status(404).json({ error: 'Pending trade offer not found.' });

  const sender = db.prepare('SELECT id, korbux FROM users WHERE id = ?').get(trade.sender_id);
  const receiver = db.prepare('SELECT id, korbux FROM users WHERE id = ?').get(trade.receiver_id);

  if (sender.korbux < trade.sender_ruxbux) return res.status(400).json({ error: 'Sender no longer has enough Ruxbux.' });
  if (receiver.korbux < trade.receiver_ruxbux) return res.status(400).json({ error: 'You do not have enough Ruxbux.' });

  const tradeItems = db.prepare('SELECT * FROM trade_items WHERE trade_id = ?').all(tradeId);

  try {
    db.transaction(() => {
      for (const ti of tradeItems) {
        const check = db.prepare('SELECT id FROM user_inventory WHERE id = ? AND user_id = ?').get(ti.inventory_id, ti.user_id);
        if (!check) throw new Error('One or more items in this trade were already traded or sold.');
      }

      for (const ti of tradeItems) {
        const newOwnerId = ti.user_id === trade.sender_id ? trade.receiver_id : trade.sender_id;
        db.prepare('UPDATE user_inventory SET user_id = ?, resale_price = NULL WHERE id = ?').run(newOwnerId, ti.inventory_id);
      }

      if (trade.sender_ruxbux > 0) {
        db.prepare('UPDATE users SET korbux = korbux - ? WHERE id = ?').run(trade.sender_ruxbux, trade.sender_id);
        db.prepare('UPDATE users SET korbux = korbux + ? WHERE id = ?').run(trade.sender_ruxbux, trade.receiver_id);
      }
      if (trade.receiver_ruxbux > 0) {
        db.prepare('UPDATE users SET korbux = korbux - ? WHERE id = ?').run(trade.receiver_ruxbux, trade.receiver_id);
        db.prepare('UPDATE users SET korbux = korbux + ? WHERE id = ?').run(trade.receiver_ruxbux, trade.sender_id);
      }

      db.prepare("UPDATE trade_offers SET status = 'accepted' WHERE id = ?").run(tradeId);
    })();

    const updatedUser = db.prepare('SELECT korbux FROM users WHERE id = ?').get(req.user.id);
    res.json({ message: 'Trade completed successfully!', korbux: updatedUser.korbux });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancel', authenticateToken, (req, res) => {
  const tradeId = Number(req.params.id);
  db.prepare("UPDATE trade_offers SET status = 'cancelled' WHERE id = ? AND (sender_id = ? OR receiver_id = ?)").run(tradeId, req.user.id, req.user.id);
  res.json({ message: 'Trade declined/cancelled.' });
});

module.exports = router;
