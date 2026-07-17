const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/auth');

const router = express.Router();

let columnsMigrated = false;

async function ensureTables() {
  // 1. Hotel Settings Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hotel_settings (
      setting_key VARCHAR(80) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Restaurant Menu Items Table (Fixed for Postgres)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_menu_items (
      menu_item_id SERIAL PRIMARY KEY,            -- SERIAL means auto-increment in Postgres
      name VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      department VARCHAR(50) NOT NULL DEFAULT 'restaurant', -- Clean text column instead of ENUM
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      description TEXT,
      image_url VARCHAR(255) DEFAULT NULL,
      is_active SMALLINT NOT NULL DEFAULT 1,       -- SMALLINT replaces TINYINT
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_menu_items (
      menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      department ENUM('restaurant','bar') NOT NULL DEFAULT 'restaurant',
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      description TEXT,
      image_url VARCHAR(255) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_sales (
      sale_id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      quantity TINYINT UNSIGNED NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status ENUM('pending','delivered','paid','cancelled') NOT NULL DEFAULT 'pending',
      notes TEXT,
      sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bar_orders (
      order_id INT AUTO_INCREMENT PRIMARY KEY,
      guest_name VARCHAR(120) NOT NULL,
      item_name VARCHAR(120) NOT NULL,
      quantity TINYINT UNSIGNED NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status ENUM('pending','served','paid','cancelled') NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // One-time migration for databases created before the `department` column
  // existed — CREATE TABLE IF NOT EXISTS above won't add it to an existing table.
  if (!columnsMigrated) {
    columnsMigrated = true;
    const [cols] = await pool.query(`SHOW COLUMNS FROM restaurant_menu_items LIKE 'department'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE restaurant_menu_items ADD COLUMN department ENUM('restaurant','bar') NOT NULL DEFAULT 'restaurant' AFTER category`);
    }
  }
}

async function getSettingsMap() {
  await ensureTables();
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM hotel_settings');
  return Object.fromEntries(rows.map(({ setting_key, setting_value }) => [setting_key, setting_value]));
}

// GET /management/admins — manager only: list employee accounts and their sign-in status
router.get('/admins', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const [rows] = await pool.query(
      'SELECT admin_id, username, full_name, role, is_checked_in, last_login_at, last_logout_at, created_at FROM admins ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load employee accounts.' });
  }
});

// POST /management/admins — manager only: create a new employee (or manager) account
router.post('/admins', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: 'Username, password, and full name are required.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO admins (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, full_name, role || 'employee']
    );
    res.status(201).json({ admin_id: result.insertId, username, full_name, role: role || 'employee' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that username already exists.' });
    }
    res.status(500).json({ error: 'Could not create employee account.' });
  }
});

router.delete('/admins/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const targetId = Number(req.params.id);

    if (targetId === req.admin.admin_id) {
      return res.status(400).json({ error: 'You cannot delete your own account while signed in.' });
    }

    const [[target]] = await pool.query('SELECT admin_id, role FROM admins WHERE admin_id = ?', [targetId]);
    if (!target) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (target.role === 'manager') {
      const [[{ managerCount }]] = await pool.query(
        "SELECT COUNT(*) AS managerCount FROM admins WHERE role = 'manager'"
      );
      if (managerCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only remaining manager account.' });
      }
    }

    await pool.query('DELETE FROM admins WHERE admin_id = ?', [targetId]);
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete employee account.' });
  }
});

router.get('/settings', requireAuth, requireManager, async (req, res) => {
  try {
    const settings = await getSettingsMap();
    res.json({
      hotel_name: settings.hotel_name || 'Dekyiba Hotel',
      hotel_address: settings.hotel_address || 'Tarkwa, Ghana',
      currency: settings.currency || 'GH₵',
      tax_rate: settings.tax_rate || '0.00',
      report_window: settings.report_window || '7',
      restaurant_enabled: settings.restaurant_enabled !== '0',
      bar_enabled: settings.bar_enabled !== '0'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load settings.' });
  }
});

router.post('/settings', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const payload = req.body || {};
    const entries = Object.entries({
      hotel_name: payload.hotel_name || 'Dekyiba Hotel',
      hotel_address: payload.hotel_address || 'Tarkwa, Ghana',
      currency: payload.currency || 'GH₵',
      tax_rate: payload.tax_rate || '0.00',
      report_window: payload.report_window || '7',
      restaurant_enabled: payload.restaurant_enabled ? '1' : '0',
      bar_enabled: payload.bar_enabled ? '1' : '0'
    });

    await Promise.all(entries.map(([key, value]) => pool.query(
      'INSERT INTO hotel_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, String(value)]
    )));

    res.json({ message: 'Settings saved successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save settings.' });
  }
});

router.get('/restaurant/menu', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const department = req.query.department === 'bar' ? 'bar' : req.query.department === 'restaurant' ? 'restaurant' : null;
    const [rows] = department
      ? await pool.query('SELECT * FROM restaurant_menu_items WHERE department = ? ORDER BY category, name', [department])
      : await pool.query('SELECT * FROM restaurant_menu_items ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load menu.' });
  }
});

router.post('/restaurant/menu', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const { name, category, price, description, image_url, is_active } = req.body;
    const department = req.body.department === 'bar' ? 'bar' : 'restaurant';
    if (!name || !price) return res.status(400).json({ error: 'Name and price are required.' });

    const [result] = await pool.query(
      'INSERT INTO restaurant_menu_items (name, category, department, price, description, image_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, category || 'General', department, price, description || null, image_url || null, is_active === false ? 0 : 1]
    );
    res.status(201).json({ menu_item_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create menu item.' });
  }
});

router.patch('/restaurant/menu/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const fields = ['name', 'category', 'department', 'price', 'description', 'image_url', 'is_active'];
    const updates = [];
    const values = [];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields provided.' });

    values.push(req.params.id);
    await pool.query(`UPDATE restaurant_menu_items SET ${updates.join(', ')} WHERE menu_item_id = ?`, values);
    res.json({ message: 'Menu item updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update menu item.' });
  }
});

router.delete('/restaurant/menu/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    await pool.query('DELETE FROM restaurant_menu_items WHERE menu_item_id = ?', [req.params.id]);
    res.json({ message: 'Menu item removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete menu item.' });
  }
});

router.post('/restaurant/menu/upload', requireAuth, requireManager, async (req, res) => {
  try {
    const { file_name, mime_type, file_data } = req.body;
    if (!file_data) return res.status(400).json({ error: 'No menu file supplied.' });

    const base64Data = file_data.includes(',') ? file_data.split(',')[1] : file_data;
    const fileExt = mime_type && mime_type.includes('pdf') ? '.pdf' : '.png';
    // Strip any path separators / traversal segments and non-safe characters from the
    // user-supplied name before it becomes part of a filesystem path.
    const safeBase = path.basename(file_name || 'menu')
      .replace(/\.\./g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'menu';
    const fileName = `${Date.now()}-${safeBase}${fileExt}`;
    const buffer = Buffer.from(base64Data, 'base64');

    // On Vercel the filesystem is read-only/ephemeral (writes to /public don't
    // persist or even work in production), so uploads go to Vercel Blob
    // instead. Locally / in Docker, where a persistent volume is mounted at
    // public/uploads, we keep writing straight to disk as before.
    if (process.env.VERCEL) {
      const { put } = require('@vercel/blob');
      const blob = await put(`uploads/${fileName}`, buffer, {
        access: 'public',
        contentType: mime_type || (fileExt === '.pdf' ? 'application/pdf' : 'image/png')
      });
      return res.json({ success: true, file_url: blob.url, file_name: fileName });
    }

    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, fileName);
    // Belt-and-braces: confirm the resolved path still lives inside uploadsDir.
    if (!filePath.startsWith(uploadsDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid file name.' });
    }
    fs.writeFileSync(filePath, buffer);

    const relativePath = `/uploads/${fileName}`;
    res.json({ success: true, file_url: relativePath, file_name: fileName });
  } catch (err) {
    console.error(err);
    const hint = process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN
      ? 'No Blob store is connected to this project yet — add one from Vercel → Storage → Create Database → Blob.'
      : err.message;
    res.status(500).json({ error: `Could not upload menu file. ${hint}` });
  }
});

router.post('/restaurant/sales', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const { item_name, category, quantity, unit_price, status, notes } = req.body;
    const total = Number(quantity || 1) * Number(unit_price || 0);

    const [result] = await pool.query(
      'INSERT INTO restaurant_sales (item_name, category, quantity, unit_price, total_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item_name, category || 'General', quantity || 1, unit_price || 0, total, status || 'delivered', notes || null]
    );
    res.status(201).json({ sale_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not record restaurant sale.' });
  }
});

router.get('/restaurant/sales', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const { since } = resolveReportWindow(req.query);
    const [rows] = await pool.query('SELECT * FROM restaurant_sales WHERE sold_at >= ? ORDER BY sold_at DESC', [since]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load restaurant sales.' });
  }
});

router.get('/bar/orders', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const [rows] = await pool.query('SELECT * FROM bar_orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load bar orders.' });
  }
});

router.post('/bar/orders', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const { guest_name, item_name, quantity, unit_price, status, notes } = req.body;
    if (!guest_name || !item_name || !unit_price) return res.status(400).json({ error: 'Guest name, item name, and unit price are required.' });

    const total = Number(quantity || 1) * Number(unit_price || 0);
    const [result] = await pool.query(
      'INSERT INTO bar_orders (guest_name, item_name, quantity, unit_price, total_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [guest_name, item_name, quantity || 1, unit_price, total, status || 'pending', notes || null]
    );
    res.status(201).json({ order_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create bar order.' });
  }
});

router.patch('/bar/orders/:id/status', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const { status } = req.body;
    const validStatuses = ['pending', 'served', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    await pool.query('UPDATE bar_orders SET status = ? WHERE order_id = ?', [status, req.params.id]);
    res.json({ message: 'Order updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update bar order.' });
  }
});

router.get('/bar/summary', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const { since } = resolveReportWindow(req.query);
    const [rows] = await pool.query('SELECT SUM(total_amount) AS total_sales, COUNT(*) AS order_count FROM bar_orders WHERE created_at >= ?', [since]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load bar summary.' });
  }
});

router.get('/reports/today', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const { since } = resolveReportWindow({ range: 'today' });
    const [restaurantRows] = await pool.query(
      'SELECT COALESCE(SUM(total_amount),0) AS sales, COUNT(*) AS items, SUM(CASE WHEN status = \'delivered\' THEN 1 ELSE 0 END) AS delivered FROM restaurant_sales WHERE sold_at >= ?',
      [since]
    );
    const [barRows] = await pool.query(
      'SELECT COALESCE(SUM(total_amount),0) AS sales, COUNT(*) AS items, SUM(CASE WHEN status = \'served\' OR status = \'paid\' THEN 1 ELSE 0 END) AS delivered FROM bar_orders WHERE created_at >= ?',
      [since]
    );

    const restaurant = restaurantRows[0] || {};
    const bar = barRows[0] || {};

    res.json({
      restaurant_sales_today: Number(restaurant.sales || 0),
      restaurant_delivered_today: Number(restaurant.delivered || 0),
      bar_sales_today: Number(bar.sales || 0),
      bar_delivered_today: Number(bar.delivered || 0),
      today_sales: Number(restaurant.sales || 0) + Number(bar.sales || 0),
      delivered_orders_today: Number(restaurant.delivered || 0) + Number(bar.delivered || 0)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load today\'s totals.' });
  }
});

router.get('/reports/summary', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const { since, until, label } = resolveReportWindow(req.query);
    const [restaurantRows] = await pool.query('SELECT SUM(total_amount) AS total_sales, COUNT(*) AS total_items, SUM(CASE WHEN status = \'delivered\' THEN 1 ELSE 0 END) AS delivered_items FROM restaurant_sales WHERE sold_at >= ? AND sold_at < ?', [since, until]);
    const [barRows] = await pool.query('SELECT SUM(total_amount) AS total_sales, COUNT(*) AS total_items, SUM(CASE WHEN status = \'served\' OR status = \'paid\' THEN 1 ELSE 0 END) AS delivered_items FROM bar_orders WHERE created_at >= ? AND created_at < ?', [since, until]);
    const [bookingRows] = await pool.query('SELECT SUM(total_amount) AS room_revenue, COUNT(*) AS room_bookings FROM bookings WHERE created_at >= ? AND created_at < ? AND status IN (\'confirmed\', \'checked_in\', \'checked_out\')', [since, until]);

    const restaurant = restaurantRows[0] || {};
    const bar = barRows[0] || {};
    const bookings = bookingRows[0] || {};

    res.json({
      label,
      restaurant_sales: Number(restaurant.total_sales || 0),
      restaurant_items: Number(restaurant.total_items || 0),
      delivered_items: Number(restaurant.delivered_items || 0) + Number(bar.delivered_items || 0),
      bar_sales: Number(bar.total_sales || 0),
      bar_items: Number(bar.total_items || 0),
      room_revenue: Number(bookings.room_revenue || 0),
      room_bookings: Number(bookings.room_bookings || 0),
      total_revenue: Number(restaurant.total_sales || 0) + Number(bar.total_sales || 0) + Number(bookings.room_revenue || 0) 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate report.' });
  }
});

router.get('/reports/export', requireAuth, requireManager, async (req, res) => {
  try {
    await ensureTables();
    const { since, until, label } = resolveReportWindow(req.query);
    const [restaurantRows] = await pool.query('SELECT item_name AS item, category, quantity, total_amount AS amount, status, sold_at AS date FROM restaurant_sales WHERE sold_at >= ? AND sold_at < ? ORDER BY sold_at DESC', [since, until]);
    const [barRows] = await pool.query('SELECT item_name AS item, guest_name AS category, quantity, total_amount AS amount, status, created_at AS date FROM bar_orders WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC', [since, until]);
    const [bookingRows] = await pool.query(
      `SELECT CONCAT('Room ', r.room_number, ' (', r.room_type, ')') AS item,
              g.full_name AS category,
              DATEDIFF(b.check_out, b.check_in) AS quantity,
              b.total_amount AS amount,
              b.status AS status,
              b.created_at AS date
       FROM bookings b
       JOIN guests g ON b.guest_id = g.guest_id
       JOIN rooms r ON b.room_id = r.room_id
       WHERE b.created_at >= ? AND b.created_at < ?
       ORDER BY b.created_at DESC`,
      [since, until]
    );

    const rows = [
      ['type', 'item', 'category', 'quantity', 'amount', 'status', 'date'],
      ...restaurantRows.map((row) => ['restaurant', row.item, row.category, row.quantity, row.amount, row.status, row.date]),
      ...barRows.map((row) => ['bar', row.item, row.category, row.quantity, row.amount, row.status, row.date]),
      ...bookingRows.map((row) => ['room_booking', row.item, row.category, row.quantity, row.amount, row.status, row.date])
    ];

    // Quote every field and defuse spreadsheet formula injection (values starting
    // with =, +, -, or @ get a leading apostrophe so Excel/Sheets treats them as text).
    const csvField = (value) => {
      let str = String(value ?? '');
      if (/^[=+\-@]/.test(str)) str = `'${str}`;
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csv = rows.map((row) => row.map(csvField).join(',')).join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment(`dekyiba-report-${label.toLowerCase().replace(/\s+/g, '-')}.csv`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not export report.' });
  }
});

// Resolves a report window from query params. Supports:
//  - range=today | 7 | 14 | 30 (with or without a trailing 'd', e.g. '7d')
//  - start_date=YYYY-MM-DD & end_date=YYYY-MM-DD for a fully custom range
// Always returns a half-open [since, until) window plus a human label.
function resolveReportWindow(query) {
  if (query.start_date && query.end_date) {
    const since = `${query.start_date} 00:00:00`;
    const untilDate = new Date(`${query.end_date}T00:00:00`);
    untilDate.setDate(untilDate.getDate() + 1);
    const until = untilDate.toISOString().slice(0, 19).replace('T', ' ');
    return { since, until, label: `${query.start_date} to ${query.end_date}` };
  }

  const now = new Date();
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const range = String(query.range || '7').replace(/d$/, ''); // '7d' and '7' both mean 7 days

  if (range === 'today') {
    return { since: now.toISOString().slice(0, 10), until, label: 'Today' };
  }

  const days = ['7', '14', '30'].includes(range) ? Number(range) : 7;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return { since: start.toISOString().slice(0, 19).replace('T', ' '), until, label: `Last ${days} days` };
}

module.exports = router;
