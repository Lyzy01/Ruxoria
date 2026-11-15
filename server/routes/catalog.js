const express = require('express');
const { db } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware');

const router = express.Router();

// Browse Official & Community UGC Catalog + Active P2P Resales
router.get('/', optionalAuth, (req, res) => {
  const { category, search, limitedOnly } = req.query;
  let query = 'SELECT * FROM catalog_items WHERE 1=1';
  const params = [];

  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (limitedOnly === '1') {
    query += ' AND is_limited = 1';
  }
  if (search && search.trim()) {
    query += ' AND (name LIKE ? OR description LIKE ? OR creator_name LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  query += ' ORDER BY is_featured DESC, is_limited DESC, id DESC';

  const items = db.prepare(query).all(...params);

  // Attach lowest P2P resale listing if available
  const resaleStmt = db.prepare(`
    SELECT ui.id as inventory_id, ui.resale_price, ui.user_id as seller_id, u.username as seller_name
    FROM user_inventory ui
    JOIN users u ON u.id = ui.user_id
    WHERE ui.item_id = ? AND ui.resale_price IS NOT NULL AND u.banned = 0
    ORDER BY ui.resale_price ASC LIMIT 1
  `);

  const enriched = items.map(item => ({
    ...item,
    lowest_resale: resaleStmt.get(item.id) || null
  }));

  res.json({ items: enriched });
});

// Get authenticated user's inventory & RAP total
router.get('/inventory/me', authenticateToken, (req, res) => {
  const items = db.prepare(`
    SELECT ui.id as inventory_id, ui.resale_price, ui.acquired_at, c.*
    FROM user_inventory ui
    JOIN catalog_items c ON c.id = ui.item_id
    WHERE ui.user_id = ?
    ORDER BY c.rap DESC, ui.id DESC
  `).all(req.user.id);

  const totalRap = items.reduce((sum, item) => sum + (item.rap || item.price || 0), 0);
  res.json({ items, totalRap });
});

// Buy directly from Catalog (Primary Sale)
router.post('/:id/buy', authenticateToken, (req, res) => {
  const itemId = Number(req.params.id);
  const item = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (req.user.korbux < item.price) return res.status(400).json({ error: 'Insufficient Ruxbux balance.' });

  const buyTx = db.transaction(() => {
    db.prepare('UPDATE users SET korbux = korbux - ? WHERE id = ?').run(item.price, req.user.id);
    db.prepare('INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)').run(req.user.id, itemId);
    db.prepare('UPDATE catalog_items SET sales_count = sales_count + 1 WHERE id = ?').run(itemId);

    // 70% creator royalty
    if (item.creator_id && item.creator_id !== req.user.id && item.price > 0) {
      const royalty = Math.floor(item.price * 0.7);
      db.prepare('UPDATE users SET korbux = korbux + ? WHERE id = ?').run(royalty, item.creator_id);
    }
  });
  buyTx();

  const updated = db.prepare('SELECT korbux FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: `Purchased ${item.name}!`, korbux: updated.korbux });
});

// Buy from another player on the P2P Resale Market
router.post('/resale/:inventoryId/buy', authenticateToken, (req, res) => {
  const invId = Number(req.params.inventoryId);
  const listing = db.prepare(`
    SELECT ui.*, c.name, c.rap, u.username as seller_name
    FROM user_inventory ui
    JOIN catalog_items c ON c.id = ui.item_id
    JOIN users u ON u.id = ui.user_id
    WHERE ui.id = ? AND ui.resale_price IS NOT NULL
  `).get(invId);

  if (!listing) return res.status(404).json({ error: 'Resale listing no longer available.' });
  if (listing.user_id === req.user.id) return res.status(400).json({ error: 'Cannot buy your own listing.' });
  if (req.user.korbux < listing.resale_price) return res.status(400).json({ error: 'Insufficient Ruxbux.' });

  const resaleTx = db.transaction(() => {
    const sellerProceeds = Math.floor(listing.resale_price * 0.7); // 30% marketplace fee
    db.prepare('UPDATE users SET korbux = korbux - ? WHERE id = ?').run(listing.resale_price, req.user.id);
    db.prepare('UPDATE users SET korbux = korbux + ? WHERE id = ?').run(sellerProceeds, listing.user_id);
    db.prepare('UPDATE user_inventory SET user_id = ?, resale_price = NULL WHERE id = ?').run(req.user.id, invId);

    // Update item RAP (Recent Average Price)
    const newRap = Math.round(((listing.rap || listing.resale_price) + listing.resale_price) / 2);
    db.prepare('UPDATE catalog_items SET rap = ? WHERE id = ?').run(newRap, listing.item_id);
  });
  resaleTx();

  const updated = db.prepare('SELECT korbux FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: `Bought ${listing.name} from ${listing.seller_name}!`, korbux: updated.korbux });
});

// List or unlist an owned item for P2P Resale
router.post('/inventory/:inventoryId/sell', authenticateToken, (req, res) => {
  const invId = Number(req.params.inventoryId);
  const { price } = req.body;
  const inv = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND user_id = ?').get(invId, req.user.id);
  if (!inv) return res.status(404).json({ error: 'Item not found in your inventory.' });

  if (price === null || price === '' || Number(price) <= 0) {
    db.prepare('UPDATE user_inventory SET resale_price = NULL WHERE id = ?').run(invId);
    return res.json({ message: 'Removed item from resale market.' });
  }

  const cleanPrice = Math.floor(Number(price));
  db.prepare('UPDATE user_inventory SET resale_price = ? WHERE id = ?').run(cleanPrice, invId);
  res.json({ message: `Listed item for ${cleanPrice.toLocaleString()} Ruxbux!` });
});

// Create and publish a new UGC item
router.post('/create', authenticateToken, (req, res) => {
  try {
    const { name, description, category, icon, price, is_limited } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'Name and category are required.' });

    const cleanPrice = Math.max(0, Math.floor(Number(price) || 0));
    const limitedFlag = is_limited ? 1 : 0;

    const info = db.prepare(`
      INSERT INTO catalog_items (name, description, category, icon, price, rap, creator_id, creator_name, is_limited)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), (description || '').trim(), category, icon || '🎩', cleanPrice, cleanPrice, req.user.id, req.user.username, limitedFlag);

    const newItemId = info.lastInsertRowid;
    // Creator automatically receives copy #1
    db.prepare('INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)').run(req.user.id, newItemId);

    res.status(201).json({ message: `Published "${name}" to the UGC Marketplace!`, itemId: newItemId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create UGC item.' });
  }
});

module.exports = router;
