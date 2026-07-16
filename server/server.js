const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const roomsRouter = require('./routes/rooms');
const bookingsRouter = require('./routes/bookings');
const authRouter = require('./routes/auth');
const managementRouter = require('./routes/management');
const pageGate = require('./middleware/pageGate');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// 8mb covers the base64 menu-image/PDF upload payload with headroom, while still
// capping request size against abuse.
app.use(express.json({ limit: '8mb' }));

// Every page load (home, rooms, restaurant/bar order pages, and everything
// under /admin/) requires a signed-in session cookie. Only /admin/login.html
// is reachable without one. This must run BEFORE express.static, otherwise
// static would hand out the HTML files before the gate ever sees the request.
app.use(pageGate);

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/rooms', roomsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/management', managementRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', hotel: 'Dekyiba Hotel' }));

// Fallback 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// On Vercel this file is required by api/index.js as a module — we export the
// app and never call listen() there. Locally / in Docker it's still run
// directly with `node server.js`, so we only listen in that case.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Dekyiba Hotel server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
