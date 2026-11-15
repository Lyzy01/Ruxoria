const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { JWT_SECRET } = require('./middleware');

function setupSockets(io, app) {
  app.set('io', io);

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, username, role, banned FROM users WHERE id = ?').get(decoded.id);
        if (user && !user.banned) socket.user = user;
      } catch (_) {}
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user_${socket.user.id}`);
    }
  });
}

module.exports = { setupSockets };
