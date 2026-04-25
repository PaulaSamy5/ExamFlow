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
  try {
    const pool = await sql.connect(config);
    console.log('--- DB Fix START ---');
    
    // Check if it exists
    const check = await pool.request().query(`SELECT * FROM sys.check_constraints WHERE name = 'CHK_Question_Type'`);
    if (check.recordset.length > 0) {
        console.log('Constraint CHK_Question_Type found. Dropping it...');
        await pool.request().query('ALTER TABLE Questions DROP CONSTRAINT CHK_Question_Type');
        console.log('Drop successful.');
    } else {
        console.log('Constraint CHK_Question_Type was not found (maybe already dropped).');
    }

    console.log('--- DB Fix DONE ---');
    process.exit(0);
  } catch (err) {
    console.error('Failure:', err.message);
    process.exit(1);
  }
}

fix();
