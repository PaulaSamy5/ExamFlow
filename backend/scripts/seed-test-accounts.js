/**
 * Seed test accounts for E2E Playwright tests.
 * Creates instructor_test@examflow.com and student_test@examflow.com if they don't exist.
 * Usage: node backend/scripts/seed-test-accounts.js
 */
const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 1433,
  options: {
    database: process.env.DB_NAME || 'ExamsDB',
    encrypt: false,
    trustServerCertificate: true,
  }
};

const TEST_ACCOUNTS = [
  { email: 'instructor_test@examflow.com', password: 'Test1234!', name: 'Test Instructor', role: 'INSTRUCTOR', username: 'testinstructor' },
  { email: 'student_test@examflow.com',    password: 'Test1234!', name: 'Test Student',    role: 'STUDENT',    username: 'teststudent'    },
];

(async () => {
  const pool = await new sql.ConnectionPool(config).connect();
  try {
    for (const acct of TEST_ACCOUNTS) {
      const existing = await pool.request()
        .input('email', acct.email)
        .query('SELECT id FROM Users WHERE email = @email');

      if (existing.recordset.length > 0) {
        console.log(`✓ Already exists: ${acct.email}`);
        continue;
      }

      const hash = await bcrypt.hash(acct.password, 12);
      await pool.request()
        .input('email',    acct.email)
        .input('password', hash)
        .input('name',     acct.name)
        .input('role',     acct.role)
        .input('username', acct.username)
        .query(`INSERT INTO Users (email, password, name, role, isVerified, username)
                VALUES (@email, @password, @name, @role, 1, @username)`);

      console.log(`✅ Created: ${acct.email} (${acct.role})`);
    }
    console.log('Done.');
  } finally {
    await pool.close();
  }
})().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
