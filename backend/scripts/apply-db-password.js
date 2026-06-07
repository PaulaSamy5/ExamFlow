/**
 * BLOCK-2 Migration: Update SQL Server login password to match .env
 *
 * Run this ONCE before restarting the server after changing DB_PASSWORD in .env.
 * Usage: node backend/scripts/apply-db-password.js <old-password>
 *
 * Example:
 *   node backend/scripts/apply-db-password.js 123456
 */
const sql = require('mssql');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const OLD_PASSWORD = process.argv[2];
const NEW_PASSWORD = process.env.DB_PASSWORD;
const DB_USER = process.env.DB_USER || 'exam_user';
const DB_SERVER = process.env.DB_SERVER || 'localhost';

if (!OLD_PASSWORD) {
  console.error('Usage: node apply-db-password.js <old-password>');
  process.exit(1);
}

if (!NEW_PASSWORD) {
  console.error('DB_PASSWORD not set in .env');
  process.exit(1);
}

(async () => {
  const pool = await new sql.ConnectionPool({
    server: DB_SERVER,
    user: DB_USER,
    password: OLD_PASSWORD,
    port: 1433,
    options: { database: 'master', encrypt: false, trustServerCertificate: true }
  }).connect();

  try {
    await pool.request().query(
      `ALTER LOGIN [${DB_USER}] WITH PASSWORD = '${NEW_PASSWORD}' OLD_PASSWORD = '${OLD_PASSWORD}'`
    );
    console.log(`✅ SQL Server login [${DB_USER}] password updated successfully.`);
    console.log('   You can now restart the backend server.');
  } finally {
    await pool.close();
  }
})().catch(err => {
  console.error('❌ Failed to update password:', err.message);
  process.exit(1);
});
