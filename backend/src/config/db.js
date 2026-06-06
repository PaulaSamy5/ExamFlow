const sql = require('mssql');
require('dotenv').config();

const configMaster = {
  server: process.env.DB_SERVER || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 1433,
  options: {
    database: "master",
    encrypt: false, // Set to true if using Azure
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const DB_NAME = process.env.DB_NAME || "ExamsDB";
// MED-005: Validate DB_NAME to prevent SQL injection in DDL statements
if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  throw new Error(`FATAL: DB_NAME '${DB_NAME}' contains invalid characters. Only letters, digits, and underscores are allowed.`);
}
const configTarget = JSON.parse(JSON.stringify(configMaster));
configTarget.options.database = DB_NAME;

let poolPromise = null;

async function getConnection() {
  if (poolPromise) return poolPromise;

  try {
    console.log(`📡 Connecting to SQL Server Instance [${configMaster.server}]...`);
    
    // 1. Ensure target DB exists (using master connection)
    const masterPool = await new sql.ConnectionPool(configMaster).connect();
    console.log('✅ Connected to Master.');
    
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${DB_NAME}')
      CREATE DATABASE ${DB_NAME}
    `);
    await masterPool.close();
    console.log(`📦 Database [${DB_NAME}] Ready/Verified.`);

    // 2. Connect to the actual Application DB
    poolPromise = await new sql.ConnectionPool(configTarget).connect();
    console.log(`✅ Fully established connection to ${DB_NAME} (User: ${configTarget.user}).`);
    
    await initializeSchema(poolPromise);
    return poolPromise;
  } catch (err) {
    console.error('❌ SQL Server CONNECTION ERROR:', err.message);
    poolPromise = null;
    const dbErr = new Error('Database unavailable: ' + err.message);
    dbErr.code = 'DB_CONNECTION_FAILED';
    throw dbErr;
  }
}

// Global Initialization
getConnection().catch(e => console.error('🚩 Core Activation Failure:', e.message));

async function initializeSchema(pool) {
  console.log('🏗️  Synchronizing SQL Schema Layout...');
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    // 1. Users Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
      CREATE TABLE Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) UNIQUE NOT NULL,
        password NVARCHAR(MAX) NOT NULL,
        name NVARCHAR(MAX) NOT NULL,
        role NVARCHAR(50) DEFAULT 'STUDENT',
        isVerified INT DEFAULT 0,
        createdAt DATETIME DEFAULT GETDATE()
      )
    `);

    // 2. Exams Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Exams')
      CREATE TABLE Exams (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(MAX) NOT NULL,
        description NVARCHAR(MAX),
        accessCode NVARCHAR(50) UNIQUE,
        totalGrade FLOAT NOT NULL,
        duration INT NOT NULL,
        startTime DATETIME NOT NULL,
        endTime DATETIME NOT NULL,
        instructorId INT NOT NULL,
        showResults INT DEFAULT 1,
        requireAIGradeApproval INT DEFAULT 0,
        createdAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Exams_Users FOREIGN KEY (instructorId) REFERENCES Users(id)
      )
    `);

    // Graceful column injection + Backfill
    try {
      await request.query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'showResults') ALTER TABLE Exams ADD showResults INT DEFAULT 1");
      await request.query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'requireAIGradeApproval') ALTER TABLE Exams ADD requireAIGradeApproval INT DEFAULT 0");
      await request.query("UPDATE Exams SET showResults = 1 WHERE showResults IS NULL");
      await request.query("UPDATE Exams SET requireAIGradeApproval = 0 WHERE requireAIGradeApproval IS NULL");
    } catch (e) { /* Columns likely exist */ }

    // 3. Questions Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Questions')
      CREATE TABLE Questions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        examId INT NOT NULL,
        type NVARCHAR(50) NOT NULL,
        text NVARCHAR(MAX) NOT NULL,
        points FLOAT NOT NULL,
        options NVARCHAR(MAX),
        correctAnswer NVARCHAR(MAX),
        isMultiple INT DEFAULT 0,
        CONSTRAINT FK_Questions_Exams FOREIGN KEY (examId) REFERENCES Exams(id) ON DELETE CASCADE
      )
    `);

    // Graceful column injection + Backfill for isMultiple
    try {
      await request.query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Questions') AND name = 'isMultiple') ALTER TABLE Questions ADD isMultiple INT DEFAULT 0");
      await request.query("UPDATE Questions SET isMultiple = 0 WHERE isMultiple IS NULL");
    } catch (e) { /* Column likely exists */ }

    // 4. Submissions Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Submissions')
      CREATE TABLE Submissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        studentId INT NOT NULL,
        examId INT NOT NULL,
        status NVARCHAR(50) DEFAULT 'IN_PROGRESS',
        score FLOAT DEFAULT 0,
        submittedAt DATETIME,
        createdAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Submissions_Users FOREIGN KEY (studentId) REFERENCES Users(id),
        CONSTRAINT FK_Submissions_Exams FOREIGN KEY (examId) REFERENCES Exams(id)
      )
    `);

    // 5. Answers Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Answers')
      CREATE TABLE Answers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        submissionId INT NOT NULL,
        questionId INT NOT NULL,
        studentAnswer NVARCHAR(MAX) NOT NULL,
        scoreEarned FLOAT DEFAULT 0,
        isCorrect INT DEFAULT 0,
        isAIGradeApproved INT DEFAULT 0,
        aiScore FLOAT,
        testResults NVARCHAR(MAX),
        CONSTRAINT FK_Answers_Submissions FOREIGN KEY (submissionId) REFERENCES Submissions(id) ON DELETE CASCADE,
        CONSTRAINT FK_Answers_Questions FOREIGN KEY (questionId) REFERENCES Questions(id)
      )
    `);

    // 6. PendingUsers Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PendingUsers')
      CREATE TABLE PendingUsers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) UNIQUE NOT NULL,
        password NVARCHAR(MAX) NOT NULL,
        name NVARCHAR(MAX) NOT NULL,
        role NVARCHAR(50) DEFAULT 'STUDENT',
        verificationCode NVARCHAR(50) NOT NULL,
        createdAt DATETIME DEFAULT GETDATE()
      )
    `);

    // 6.5. PasswordResets Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PasswordResets')
      CREATE TABLE PasswordResets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL,
        token NVARCHAR(MAX) NOT NULL,
        expiresAt DATETIME NOT NULL,
        attempts INT DEFAULT 0,
        createdAt DATETIME DEFAULT GETDATE()
      )
    `);

    // 7. Analytics Table
    await request.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Analytics')
      CREATE TABLE Analytics (
        id INT IDENTITY(1,1) PRIMARY KEY,
        visitorId NVARCHAR(255) NOT NULL,
        userId INT NULL,
        url NVARCHAR(MAX) NOT NULL,
        referrer NVARCHAR(MAX),
        userAgent NVARCHAR(MAX),
        duration INT DEFAULT 0, -- in seconds
        createdAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Analytics_Users FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE SET NULL
      )
    `);

    // Add indices for performance
    try {
      await request.query("IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_Analytics_VisitorId') CREATE INDEX IX_Analytics_VisitorId ON Analytics(visitorId)");
      await request.query("IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_Analytics_CreatedAt') CREATE INDEX IX_Analytics_CreatedAt ON Analytics(createdAt)");
    } catch (e) { /* Indices likely exist */ }

    await transaction.commit();

    // --- PATCH: Add missing columns to existing tables (safe, idempotent) ---
    const patchRequest = pool.request();

    // Patch Users: isVerified, username, profileImage
    await patchRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'isVerified')
        ALTER TABLE Users ADD isVerified INT DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'username')
        ALTER TABLE Users ADD username NVARCHAR(255);
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'profileImage')
        ALTER TABLE Users ADD profileImage NVARCHAR(MAX);
    `);

    // Patch PendingUsers: username, profileImage
    await patchRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PendingUsers') AND name = 'username')
        ALTER TABLE PendingUsers ADD username NVARCHAR(255);
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PendingUsers') AND name = 'profileImage')
        ALTER TABLE PendingUsers ADD profileImage NVARCHAR(MAX);
    `);

    // Patch PasswordResets: attempts
    await patchRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasswordResets') AND name = 'attempts')
        ALTER TABLE PasswordResets ADD attempts INT DEFAULT 0
    `);

    // Patch Submissions: unique constraint to prevent double-start race condition (EDGE-001)
    // LOW-004: Remove any pre-existing duplicates first so the index creation can succeed
    try {
      await patchRequest.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE object_id = OBJECT_ID('Submissions') AND name = 'UQ_Submissions_StudentExam'
        )
        BEGIN
          WITH CTE AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY studentId, examId ORDER BY
                     CASE WHEN status = 'SUBMITTED' THEN 0 ELSE 1 END,
                     createdAt DESC) AS rn
            FROM Submissions
          )
          DELETE FROM CTE WHERE rn > 1;

          CREATE UNIQUE INDEX UQ_Submissions_StudentExam ON Submissions(studentId, examId);
        END
      `);
    } catch (e) { /* constraint may already exist */ }

    // Patch Exams: accessCode
    await patchRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'accessCode')
        ALTER TABLE Exams ADD accessCode NVARCHAR(50)
    `);

    // Patch Exams: examType
    await patchRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'examType')
        ALTER TABLE Exams ADD examType NVARCHAR(50) DEFAULT 'ONLINE'
    `);

    // Patch Exams: examMeta (JSON blob for institution/academic metadata)
    await patchRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'examMeta')
        ALTER TABLE Exams ADD examMeta NVARCHAR(MAX)
    `);

    // Patch Exams: make startTime / endTime nullable to support PRINTABLE_ONLY exams
    try {
      await patchRequest.query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('Exams')
            AND name = 'startTime'
            AND is_nullable = 0
        )
        ALTER TABLE Exams ALTER COLUMN startTime DATETIME NULL
      `);
      await patchRequest.query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('Exams')
            AND name = 'endTime'
            AND is_nullable = 0
        )
        ALTER TABLE Exams ALTER COLUMN endTime DATETIME NULL
      `);
    } catch (e) { console.warn('⚠️ startTime/endTime nullable patch skipped:', e.message); }

    console.log('✨ All Schema Tables Synchronized/Ready.');

    // 🚀 CRITICAL PATCHES (Manually forced for reliability)
    const patch = pool.request();
    console.log('诊断 Running Database Health Check...');
    
    try {
      // Exams Table Patches
      await patch.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'showResults') ALTER TABLE Exams ADD showResults INT DEFAULT 1`);
      await patch.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Exams') AND name = 'requireAIGradeApproval') ALTER TABLE Exams ADD requireAIGradeApproval INT DEFAULT 0`);
      await patch.query(`UPDATE Exams SET showResults = 1 WHERE showResults IS NULL`);
      await patch.query(`UPDATE Exams SET requireAIGradeApproval = 0 WHERE requireAIGradeApproval IS NULL`);
      
      // Questions Table Patches
      await patch.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Questions') AND name = 'isMultiple') ALTER TABLE Questions ADD isMultiple INT DEFAULT 0`);
      await patch.query(`UPDATE Questions SET isMultiple = 0 WHERE isMultiple IS NULL`);

      // Drop restrictive Check Constraint for Question Types
      try {
        await patch.query(`
          IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CHK_Question_Type')
          BEGIN
             ALTER TABLE Questions DROP CONSTRAINT CHK_Question_Type;
          END
        `);
      } catch (dropErr) {}
 
      // Answers Table Patches
      await patch.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Answers') AND name = 'testResults') ALTER TABLE Answers ADD testResults NVARCHAR(MAX)`);
      await patch.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Answers') AND name = 'isAIGradeApproved') ALTER TABLE Answers ADD isAIGradeApproved INT DEFAULT 0`);
      await patch.query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Answers') AND name = 'aiScore') ALTER TABLE Answers ADD aiScore FLOAT`);
      await patch.query(`UPDATE Answers SET isAIGradeApproved = 0 WHERE isAIGradeApproved IS NULL`);
 
      // Drop restrictive Check Constraint for User Roles (add ADMIN support)
      try {
        await patch.query(`
          IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CHK_User_Role')
          BEGIN
             ALTER TABLE Users DROP CONSTRAINT CHK_User_Role;
          END
        `);
        await patch.query(`
          ALTER TABLE Users ADD CONSTRAINT CHK_User_Role CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'ADMIN'))
        `);
      } catch (dropErr) {}

      console.log('✅ DB Patches Applied Successfully.');
    } catch (e) {
      console.warn('⚠️ Some DB Patches skipped or already applied:', e.message);
    }

    // ─── Admin Account Seed ───
    await seedAdminAccount(pool);

  } catch (err) {
    console.error('❌ Schema Sync Failure:', err.message);
    if (transaction) await transaction.rollback();
  }
}

// ─── Secure Admin Seed (runs on every startup, idempotent) ───
async function seedAdminAccount(pool) {
  try {
    const bcrypt = require('bcryptjs');
    const checkResult = await pool.request().query(
      "SELECT COUNT(*) AS cnt FROM Users WHERE role = 'ADMIN'"
    );
    const adminCount = checkResult.recordset[0].cnt;

    if (adminCount === 0) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminEmail || !adminPassword) {
        console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in .env — skipping admin seed. Set these variables to create the initial admin account.');
        return;
      }

      const adminName = process.env.ADMIN_NAME || 'System Administrator';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      await pool.request()
        .input('email', adminEmail)
        .input('password', hashedPassword)
        .input('name', adminName)
        .input('role', 'ADMIN')
        .input('isVerified', 1)
        .query(
          "INSERT INTO Users (email, password, name, role, isVerified) VALUES (@email, @password, @name, @role, @isVerified)"
        );

      console.log('🔐 Admin account created. Email stored from ADMIN_EMAIL env var.');
    } else {
      console.log('🔐 Admin account already exists. Skipping seed.');
    }
  } catch (err) {
    console.error('⚠️ Admin seed error:', err.message);
  }
}


// Global helpers (Promisified and auto-mapped for '@' parameters)
const query = async (sqlText, params = []) => {
  const pool = await getConnection();
  const request = pool.request();
  let paramIndex = 0;
  const convertedSql = sqlText.replace(/\?/g, () => {
    const name = `p${paramIndex}`;
    request.input(name, params[paramIndex]);
    paramIndex++;
    return `@${name}`;
  });
  const result = await request.query(convertedSql);
  return result.recordset;
};

const run = async (sqlText, params = []) => {
  const pool = await getConnection();
  const request = pool.request();
  let paramIndex = 0;
  let convertedSql = sqlText.replace(/\?/g, () => {
    const name = `p${paramIndex}`;
    request.input(name, params[paramIndex]);
    paramIndex++;
    return `@${name}`;
  });

  const isInsert = convertedSql.toUpperCase().includes('INSERT');
  if (isInsert && convertedSql.toUpperCase().includes('VALUES')) {
    // Inject OUTPUT INSERTED.id before VALUES
    const idx = convertedSql.toUpperCase().lastIndexOf('VALUES');
    convertedSql = convertedSql.slice(0, idx) + 'OUTPUT INSERTED.id ' + convertedSql.slice(idx);
  }

  const result = await request.query(convertedSql);
  if (isInsert) {
    let id = null;
    if (result.recordset && result.recordset.length > 0 && result.recordset[0].id) {
       id = result.recordset[0].id;
    }
    return { lastID: id, changes: result.rowsAffected ? result.rowsAffected.reduce((a,b)=>a+b,0) : 0 };
  }
  return { lastID: null, changes: result.rowsAffected ? result.rowsAffected[0] : 0 };
};

const get = async (sqlText, params = []) => {
  const pool = await getConnection();
  const request = pool.request();
  let paramIndex = 0;
  const convertedSql = sqlText.replace(/\?/g, () => {
    const name = `p${paramIndex}`;
    request.input(name, params[paramIndex]);
    paramIndex++;
    return `@${name}`;
  });
  const result = await request.query(convertedSql);
  return result.recordset[0] || null;
};

module.exports = {
  sql,
  query,
  run,
  get
};


