const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings — public: guest creates a booking
router.post('/', async (req, res) => {
  const {
    room_id, check_in, check_out, num_guests, special_request,
    full_name, email, phone, id_number
  } = req.body;

  if (!room_id || !check_in || !check_out || !full_name || !email || !phone) {
    return res.status(400).json({ error: 'room_id, check_in, check_out, full_name, email, and phone are required.' });
  }

  if (new Date(check_out) <= new Date(check_in)) {
    return res.status(400).json({ error: 'check_out must be after check_in.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock and verify the room is still free for these dates
    const [room] = await conn.query('SELECT * FROM rooms WHERE room_id = ? FOR UPDATE', [room_id]);
    if (room.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (room[0].status !== 'available') {
      await conn.rollback();
      return res.status(409).json({ error: 'This room is not currently available.' });
    }

    const [clash] = await conn.query(
      `SELECT booking_id FROM bookings
       WHERE room_id = ? AND status IN ('pending','confirmed','checked_in')
       AND check_in < ? AND check_out > ?`,
      [room_id, check_out, check_in]
    );
    if (clash.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'This room is already booked for those dates.' });
    }

    // Find or create the guest by email
    const [existingGuest] = await conn.query('SELECT guest_id FROM guests WHERE email = ?', [email]);
    let guestId;
    if (existingGuest.length > 0) {
      guestId = existingGuest[0].guest_id;
      await conn.query(
        'UPDATE guests SET full_name = ?, phone = ?, id_number = ? WHERE guest_id = ?',
        [full_name, phone, id_number || null, guestId]
      );
    } else {
      const [newGuest] = await conn.query(
        'INSERT INTO guests (full_name, email, phone, id_number) VALUES (?, ?, ?, ?) RETURNING guest_id',
        [full_name, email, phone, id_number || null]
      );
      guestId = newGuest.insertId;
    }

    // Calculate total
    const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
    const totalAmount = nights * parseFloat(room[0].price_per_night);

    const [booking] = await conn.query(
      `INSERT INTO bookings (room_id, guest_id, check_in, check_out, num_guests, total_amount, special_request, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed') RETURNING booking_id`,
      [room_id, guestId, check_in, check_out, num_guests || 1, totalAmount, special_request || null]
    );

    // Confirmed on arrival — take the room off the available list right away
    // rather than waiting for a staff member to action it.
    await conn.query(`UPDATE rooms SET status = 'unavailable' WHERE room_id = ?`, [room_id]);

    await conn.commit();
    res.status(201).json({
      booking_id: booking.insertId,
      nights,
      total_amount: totalAmount,
      status: 'confirmed',
      message: 'Booking confirmed! We look forward to hosting you.'
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not create booking.' });
  } finally {
    conn.release();
  }
});

// GET /api/bookings — admin only: list all bookings with guest/room info
router.get('/', requireAuth, async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT b.*, g.full_name, g.email, g.phone, r.room_number, r.room_type
      FROM bookings b
      JOIN guests g ON b.guest_id = g.guest_id
      JOIN rooms r ON b.room_id = r.room_id
    `;
    const params = [];
    if (status) {
      query += ' WHERE b.status = ?';
      params.push(status);
    }
    query += ' ORDER BY b.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch bookings.' });
  }
});

// PATCH /api/bookings/:id/status — admin only: confirm / check-in / check-out / cancel
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[booking]] = await conn.query('SELECT room_id FROM bookings WHERE booking_id = ?', [req.params.id]);
    if (!booking) {
      await conn.rollback();
      return res.status(404).json({ error: 'Booking not found.' });
    }

    await conn.query('UPDATE bookings SET status = ? WHERE booking_id = ?', [status, req.params.id]);

    // Once a stay ends (or the booking is called off), the room goes back
    // on the available list. For every other status it stays unavailable —
    // it was taken off the list the moment the booking was made.
    if (status === 'checked_out' || status === 'cancelled') {
      await conn.query(`UPDATE rooms SET status = 'available' WHERE room_id = ?`, [booking.room_id]);
    } else {
      await conn.query(`UPDATE rooms SET status = 'unavailable' WHERE room_id = ?`, [booking.room_id]);
    }

    await conn.commit();
    res.json({ message: `Booking marked as ${status}.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not update booking.' });
  } finally {
    conn.release();
  }
});

// GET /api/bookings/stats/summary — admin only: dashboard numbers
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const [[{ total_rooms }]] = await pool.query('SELECT COUNT(*) AS total_rooms FROM rooms');
    const [[{ occupied }]] = await pool.query(
      `SELECT COUNT(DISTINCT room_id) AS occupied FROM bookings
       WHERE status = 'checked_in'`
    );
    const [[{ pending }]] = await pool.query(`SELECT COUNT(*) AS pending FROM bookings WHERE status = 'pending'`);
    const [[{ revenue }]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM bookings
       WHERE status IN ('confirmed','checked_in','checked_out')
       AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`
    );

    res.json({
      total_rooms,
      occupied,
      available: total_rooms - occupied,
      pending_bookings: pending,
      monthly_revenue: revenue
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch stats.' });
  }
});

module.exports = router;
