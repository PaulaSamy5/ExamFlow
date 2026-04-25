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

async function fix() {
  const pool = await sql.connect(config);
  const result = await pool.request().query(`
    SELECT name, definition, OBJECT_NAME(parent_object_id) AS TableName
    FROM sys.check_constraints
  `);
  console.log('ALL CHECK CONSTRAINTS:', result.recordset);
  
  for (const c of result.recordset) {
      if (c.name === 'CHK_Question_Type') {
          console.log(`FOUND! Dropping it from ${c.TableName}...`);
          await pool.request().query(`ALTER TABLE ${c.TableName} DROP CONSTRAINT CHK_Question_Type`);
          console.log('DROPPED.');
      }
  }
  process.exit(0);
}
fix();
