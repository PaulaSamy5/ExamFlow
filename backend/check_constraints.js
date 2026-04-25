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
  try {
    const pool = await sql.connect(config);
    console.log('Listing constraints for Questions tab:');
    
    // Find all check constraints on Questions table
    const result = await pool.request().query(`
      SELECT 
          cc.name AS ConstraintName,
          cc.definition AS Definition,
          t.name AS TableName
      FROM sys.check_constraints cc
      JOIN sys.tables t ON cc.parent_object_id = t.object_id
      WHERE t.name = 'Questions'
    `);
    
    console.log(JSON.stringify(result.recordset, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Failure:', err.message);
    process.exit(1);
  }
}

check();
