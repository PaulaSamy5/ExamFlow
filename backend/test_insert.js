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

async function testInsert() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected. Testing INSERT with type="CODING"...');
    
    // We need a valid examId. Let's find one or create a dummy exam.
    const exam = await pool.request().query("SELECT TOP 1 id FROM Exams");
    let examId;
    if (exam.recordset.length > 0) {
        examId = exam.recordset[0].id;
    } else {
        // Create a dummy instructor first if needed? For now let's hope one exists.
        const instructor = await pool.request().query("SELECT TOP 1 id FROM Users WHERE role='INSTRUCTOR'");
        if (instructor.recordset.length === 0) {
            console.log('No instructor found. Creating dummy...');
            const insRes = await pool.request().query("INSERT INTO Users (email, password, name, role, isVerified) OUTPUT INSERTED.id VALUES ('test@test.com', '123', 'Test', 'INSTRUCTOR', 1)");
            var insId = insRes.recordset[0].id;
        } else {
            var insId = instructor.recordset[0].id;
        }
        const exRes = await pool.request().query(`INSERT INTO Exams (title, totalGrade, duration, startTime, endTime, instructorId) OUTPUT INSERTED.id VALUES ('Test Exam', 100, 60, GETDATE(), GETDATE(), ${insId})`);
        examId = exRes.recordset[0].id;
    }

    console.log(`Using Exam ID: ${examId}`);
    
    try {
        await pool.request().query(`
            INSERT INTO Questions (examId, type, text, points) 
            VALUES (${examId}, 'CODING', 'Test Question', 10)
        `);
        console.log('✅ SUCCESS! The INSERT worked. This means the DB is CLEAN.');
        
        // Clean up
        await pool.request().query(`DELETE FROM Questions WHERE type='CODING' AND text='Test Question'`);
        console.log('Cleaned up test question.');
        
    } catch (insertErr) {
        console.error('❌ FAILED! The INSERT hit a constraint:', insertErr.message);
    }

    process.exit(0);
  } catch (err) {
    console.error('Test Failure:', err.message);
    process.exit(1);
  }
}

testInsert();
