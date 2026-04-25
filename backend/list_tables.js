const sql = require('mssql');
require('dotenv').config({ path: './backend/.env' });

const config = {
  server: process.env.DB_SERVER || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "ExamsDB",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function check() {
  const pool = await sql.connect(config);
  const result = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES`);
  console.log('Tables in DB:', result.recordset.map(r => r.TABLE_NAME));
  process.exit(0);
}
check();
