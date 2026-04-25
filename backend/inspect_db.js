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

async function inspect() {
  const pool = await sql.connect(config);
  
  console.log('--- Inspecting Questions Table ---');
  
  // 1. Check all objects related to Questions table
  const results = await pool.request().query(`
    SELECT obj.name, obj.type_desc
    FROM sys.objects obj
    WHERE obj.parent_object_id = OBJECT_ID('Questions')
  `);
  console.log('Objects on Questions:', JSON.stringify(results.recordset, null, 2));

  // 2. Check for ANY constraint with name like CHK%
  const allConstraints = await pool.request().query(`
    SELECT name, type_desc, OBJECT_NAME(parent_object_id) as TableName
    FROM sys.objects
    WHERE type_desc LIKE '%CONSTRAINT%'
  `);
  console.log('All Constraints in DB:', JSON.stringify(allConstraints.recordset, null, 2));

  process.exit(0);
}
inspect();
