require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { initDatabase, db } = require('./db');
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const tradeRoutes = require('./routes/trade');
const adminRoutes = require('./routes/admin');
const { setupSockets } = require('./socket');

initDatabase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] } });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

setupSockets(io, app);

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', platform: 'Rokori Economy' }));

// Automated 10-Minute Ruxbux Stipend Interval Timer
const RUXBUX_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  try {
    db.prepare('UPDATE users SET korbux = korbux + 1 WHERE banned = 0').run();
    console.log('💎 [Ruxbux Timer] Deposited +1 Ruxbux to all active accounts.');
    io.emit('ruxbux_stipend', { amount: 1 });
    io.emit('global_announcement', {
      author: 'System Treasury',
      message: '⏱️ 10-Minute Ruxbux Stipend distributed! +1 Ruxbux added to your balance.'
    });
  } catch (err) {
    console.error('Ruxbux stipend timer error:', err);
  }
}, RUXBUX_INTERVAL_MS);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Rokori Marketplace & Trade Hub running on http://localhost:${PORT}`);
});
