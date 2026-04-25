const sql = require('mssql');
require('dotenv').config({ path: './backend/.env' });

const config = {
  server: process.env.DB_SERVER || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    database: 'master'
  }
};

async function findGhost() {
  try {
    const pool = await sql.connect(config);
    console.log('--- Searching ALL DBs for CHK_Question_Type ---');
    
    const dbsResult = await pool.request().query("SELECT name FROM sys.databases WHERE database_id > 4");
    const dbs = dbsResult.recordset.map(r => r.name);
    
    for (const dbName of dbs) {
        try {
            console.log(`Checking DB: ${dbName}...`);
            await pool.request().query(`USE [${dbName}]`);
            const constraints = await pool.request().query(`
                SELECT name, OBJECT_NAME(parent_object_id) as TableName
                FROM sys.check_constraints
                WHERE name = 'CHK_Question_Type'
            `);
            if (constraints.recordset.length > 0) {
                console.log(`🎯 FOUND in DB [${dbName}] on Table [${constraints.recordset[0].TableName}]`);
                console.log(`Dropping it now...`);
                await pool.request().query(`ALTER TABLE ${constraints.recordset[0].TableName} DROP CONSTRAINT CHK_Question_Type`);
                console.log('Dropped successfully.');
            }
        } catch (e) {
            console.log(`Skipping DB ${dbName}: ${e.message}`);
        }
    }
    console.log('--- Search Done ---');
    process.exit(0);
  } catch (err) {
    console.error('Master Failure:', err.message);
    process.exit(1);
  }
}

findGhost();
