const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { COOKIE_NAME } = require('../middleware/pageGate');
require('dotenv').config();

const router = express.Router();

// 8 hours, matching the JWT's own expiresIn below.
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

// Cookies only get the Secure flag when the app is actually served over
// HTTPS. Force it on with SECURE_COOKIES=true once you put this behind TLS
// (e.g. a reverse proxy) — until then, forcing Secure would silently break
// login over plain http on a local network/tablet.
const SECURE_COOKIES = process.env.SECURE_COOKIES === 'true';

// Slow down brute-force login attempts: 10 tries per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' }
});

// POST /api/auth/login
// body: { username, password, portal }
// portal is 'admin' (manager-only) or 'employee' (employee-only).
// Defaults to 'admin' for backwards compatibility.
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const portal = req.body.portal === 'employee' ? 'employee' : 'admin';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    if (portal === 'admin' && admin.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can sign in through the Admin portal. Use the Employee tab instead.' });
    }

    if (portal === 'employee' && admin.role !== 'employee') {
      return res.status(403).json({ error: 'This account is a manager account. Use the Admin tab instead.' });
    }

    await pool.query(
      'UPDATE admins SET is_checked_in = true, last_login_at = CURRENT_TIMESTAMP WHERE admin_id = ?',
      [admin.admin_id]
    );

    const token = jwt.sign(
      { admin_id: admin.admin_id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // This cookie is what pageGate reads to decide whether a browser is
    // allowed to load any page at all. The token in the JSON body below is
    // what the frontend JS uses for API calls (Authorization: Bearer ...).
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: SECURE_COOKIES,
      maxAge: SESSION_MAX_AGE_MS
    });

    res.json({
      token,
      admin: { admin_id: admin.admin_id, username: admin.username, full_name: admin.full_name, role: admin.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// POST /api/auth/logout — marks the signed-in staff member as checked out.
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE admins SET is_checked_in = false, last_logout_at = CURRENT_TIMESTAMP WHERE admin_id = ?',
      [req.admin.admin_id]
    );
    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Signed out.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during logout.' });
  }
});

module.exports = router;
