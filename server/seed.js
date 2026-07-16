// Creates the default manager account. Run with: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  try {
    const username = 'kipsta';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'Dekyiba@2026';
    const hash = await bcrypt.hash(password, 10);

    const [existing] = await pool.query('SELECT admin_id FROM admins WHERE username = ?', [username]);

    if (existing.length > 0) {
      console.log('Default manager account already exists — skipping.');
    } else {
      await pool.query(
        'INSERT INTO admins (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [username, hash, 'Hotel Manager', 'manager']
      );
      console.log('Default manager account created.');
      console.log(`  username: ${username}`);
      console.log(`  password: ${password}`);
      console.log('Sign in through the Admin tab on the staff login page, then change this password.');
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
