const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'rokori.db'));
db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'USER',
      korbux INTEGER DEFAULT 500,
      verified INTEGER DEFAULT 0,
      banned INTEGER DEFAULT 0,
      ban_reason TEXT DEFAULT '',
      last_stipend TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      icon TEXT DEFAULT 'fedora',
      price INTEGER DEFAULT 0,
      rap INTEGER DEFAULT 0,
      creator_id INTEGER,
      creator_name TEXT DEFAULT 'Rokori Official',
      is_limited INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      sales_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      resale_price INTEGER DEFAULT NULL,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES catalog_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      sender_ruxbux INTEGER DEFAULT 0,
      receiver_ruxbux INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      FOREIGN KEY(trade_id) REFERENCES trade_offers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      author TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as c FROM catalog_items').get().c;
  if (count === 0) seedCatalog();
}

function seedCatalog() {
  const items = [
    { name: 'Dominus Empyreus', description: 'Legendary celestial hood coveted by top traders.', category: 'Hats', icon: 'dominus', price: 50000, rap: 54000, is_limited: 1, is_featured: 1 },
    { name: 'Valkyrie Helm', description: 'Winged silver helm forged for elite collectors.', category: 'Hats', icon: 'valkyrie', price: 25000, rap: 26500, is_limited: 1, is_featured: 1 },
    { name: 'Clockwork Headphones', description: 'Precision brass gears and ticking audio.', category: 'Accessories', icon: 'headphones', price: 4500, rap: 4800, is_limited: 1, is_featured: 1 },
    { name: 'Black Iron Branches', description: 'Dark enchanted horns forged in shadow.', category: 'Hats', icon: 'horns', price: 1800, rap: 1950, is_limited: 1, is_featured: 1 },
    { name: 'Sparkle Time Fedora', description: 'Shimmering limited-edition classic fedora.', category: 'Hats', icon: 'fedora', price: 12000, rap: 13200, is_limited: 1, is_featured: 1 },
    { name: 'Epic Face', description: 'The unmistakable grin of trading dominance.', category: 'Faces', icon: 'face_epic', price: 350, rap: 350, is_limited: 0, is_featured: 1 },
    { name: 'Stitchface', description: 'Rare stitched expression for spooky avatars.', category: 'Faces', icon: 'face_stitch', price: 1200, rap: 1200, is_limited: 0, is_featured: 0 },
    { name: 'Gravity Coil', description: 'Classic blue energy coil accessory.', category: 'Gears', icon: 'coil', price: 600, rap: 600, is_limited: 0, is_featured: 0 },
    { name: 'Linked Sword', description: 'Iconic steel blade from the classic era.', category: 'Gears', icon: 'sword', price: 450, rap: 450, is_limited: 0, is_featured: 0 },
    { name: 'Starter Visor', description: 'Clean everyday visor for new traders.', category: 'Hats', icon: 'visor', price: 50, rap: 50, is_limited: 0, is_featured: 0 }
  ];

  const insert = db.prepare(`
    INSERT INTO catalog_items (name, description, category, icon, price, rap, creator_name, is_limited, is_featured)
    VALUES (@name, @description, @category, @icon, @price, @rap, 'Rokori Official', @is_limited, @is_featured)
  `);
  for (const item of items) insert.run(item);
}

module.exports = { db, initDatabase };
