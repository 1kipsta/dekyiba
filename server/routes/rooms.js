const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// True if the request carries a valid staff token. Used only to decide which
// rooms to return below — GET /api/rooms is public (the booking page hits it
// with no token), but the admin dashboard hits this same endpoint with a
// token and needs to see every room, including ones marked unavailable, so
// staff can manage them.
function isStaffRequest(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  try {
    jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
}

// GET /api/rooms  — public: list all rooms, optionally filtered by availability dates
// Query params: check_in, check_out (both optional, both required together)
router.get('/', async (req, res) => {
  const { check_in, check_out } = req.query;

  try {
    if (check_in && check_out) {
      const [rooms] = await pool.query(
        `SELECT * FROM rooms
         WHERE status = 'available'
         AND room_id NOT IN (
           SELECT room_id FROM bookings
           WHERE status IN ('pending', 'confirmed', 'checked_in')
           AND check_in < ? AND check_out > ?
         )
         ORDER BY price_per_night ASC`,
        [check_out, check_in]
      );
      return res.json(rooms);
    }

    const [rooms] = isStaffRequest(req)
      ? await pool.query(`SELECT * FROM rooms ORDER BY room_type, room_number`)
      : await pool.query(`SELECT * FROM rooms WHERE status = 'available' ORDER BY room_type, room_number`);
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch rooms.' });
  }
});

// GET /api/rooms/:id — public: single room detail
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Room not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch room.' });
  }
});

// POST /api/rooms — admin only: add a new room
router.post('/', requireAuth, async (req, res) => {
  const { room_number, room_type, description, price_per_night, capacity, image_url } = req.body;

  if (!room_number || !room_type || !price_per_night) {
    return res.status(400).json({ error: 'room_number, room_type, and price_per_night are required.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO rooms (room_number, room_type, description, price_per_night, capacity, image_url)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING room_id`,
      [room_number, room_type, description || null, price_per_night, capacity || 2, image_url || null]
    );
    res.status(201).json({ room_id: result.insertId });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A room with that number already exists.' });
    }
    res.status(500).json({ error: 'Could not create room.' });
  }
});

// PATCH /api/rooms/:id — admin only: update room details or status
router.patch('/:id', requireAuth, async (req, res) => {
  const fields = ['room_number', 'room_type', 'description', 'price_per_night', 'capacity', 'image_url', 'status'];
  const updates = [];
  const values = [];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  values.push(req.params.id);

  try {
    await pool.query(`UPDATE rooms SET ${updates.join(', ')} WHERE room_id = ?`, values);
    res.json({ message: 'Room updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update room.' });
  }
});

// DELETE /api/rooms/:id — admin only
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM rooms WHERE room_id = ?', [req.params.id]);
    res.json({ message: 'Room deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete room. It may have existing bookings.' });
  }
});

module.exports = router;
