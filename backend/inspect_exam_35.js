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
  
  console.log('--- Inspecting Exam 35 Questions & Test Cases ---');
  const questions = await pool.request().query('SELECT id, type, options FROM Questions WHERE examId = 35');
  
  questions.recordset.forEach(q => {
    console.log(`Question ID: ${q.id}, Type: ${q.type}`);
    try {
      const opts = JSON.parse(q.options);
      console.log('Options/TestCases:', JSON.stringify(opts, null, 2));
    } catch(e) {
      console.log('Raw Options:', q.options);
    }
  });

  process.exit(0);
}
inspect();
