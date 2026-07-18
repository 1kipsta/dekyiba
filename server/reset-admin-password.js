// Resets the password on an EXISTING admin account. Unlike seed.js (which
// only creates the account if it's missing), this always overwrites the
// password — use it when you're locked out or forgot the password.
//
// Run with:
//   node reset-admin-password.js <username> <new-password>
//
// Example:
//   node reset-admin-password.js kipsta MyNewPassword123
//
// Make sure DATABASE_URL (and DB_SSL=true, if your host needs it) are set
// in this terminal session first, same as when you ran seed.js.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function resetPassword() {
  const [, , username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.log('Usage: node reset-admin-password.js <username> <new-password>');
    await pool.end();
    return;
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const [result] = await pool.query(
      'UPDATE admins SET password_hash = ? WHERE username = ?',
      [hash, username]
    );

    if (result.affectedRows === 0) {
      console.log(`No account found with username "${username}". Nothing was changed.`);
    } else {
      console.log(`Password updated for "${username}".`);
      console.log(`  username: ${username}`);
      console.log(`  new password: ${newPassword}`);
    }
  } catch (err) {
    console.error('Could not reset password:', err.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
