const { Pool, types } = require('pg');
require('dotenv').config();

// pg parses TIMESTAMP WITHOUT TIME ZONE as local time by default.
// Neon stores NOW() as UTC, so we must tell pg to treat these values as UTC
// to avoid OTPs and tokens appearing instantly expired on non-UTC servers.
types.setTypeParser(1114, (str) => (str ? new Date(str + 'Z') : null)); // TIMESTAMP
types.setTypeParser(1082, (str) => str); // DATE — keep as string, avoid date-shifting

// Supports DATABASE_URL (Neon/Railway/Render) OR individual DB_* vars (local dev)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      }
    : {
        host: process.env.DB_HOST || process.env.DB_SERVER || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'examflow',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Convert ? placeholders to $1, $2, ... for pg
const convertParams = (sqlText, params) => {
  let i = 0;
  const sql = sqlText.replace(/\?/g, () => `$${++i}`);
  return { sql, values: params };
};

// PostgreSQL folds all unquoted identifiers to lowercase.
// This map restores the camelCase names used throughout the codebase.
const COLUMN_MAP = {
  // Users / PendingUsers
  isverified:              'isVerified',
  verificationcode:        'verificationCode',
  profileimage:            'profileImage',
  createdat:               'createdAt',
  // Exams
  accesscode:              'accessCode',
  totalgrade:              'totalGrade',
  starttime:               'startTime',
  endtime:                 'endTime',
  instructorid:            'instructorId',
  showresults:             'showResults',
  requireaiggradeapproval: 'requireAIGradeApproval',
  examtype:                'examType',
  exammeta:                'examMeta',
  // Questions
  examid:                  'examId',
  correctanswer:           'correctAnswer',
  ismultiple:              'isMultiple',
  // Submissions
  studentid:               'studentId',
  submittedat:             'submittedAt',
  // Answers
  submissionid:            'submissionId',
  questionid:              'questionId',
  studentanswer:           'studentAnswer',
  scoreearned:             'scoreEarned',
  iscorrect:               'isCorrect',
  isaiggradeapproved:      'isAIGradeApproved',
  aiscore:                 'aiScore',
  testresults:             'testResults',
  // PasswordResets
  expiresat:               'expiresAt',
  // Analytics
  visitorid:               'visitorId',
  userid:                  'userId',
  useragent:               'userAgent',
  totalviews:              'totalViews',
  uniquevisitors:          'uniqueVisitors',
  loggedinviews:           'loggedInViews',
  guestviews:              'guestViews',
  avgduration:             'avgDuration',
  newvisitors:             'newVisitors',
  returningvisitors:       'returningVisitors',
  loggedinusers:           'loggedInUsers',
  pageviews:               'pageViews',
  uniqueviews:             'uniqueViews',
  questioncount:           'questionCount',
};

const camelizeRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[COLUMN_MAP[k] ?? k] = v;
  }
  return out;
};

async function getConnection() {
  try {
    await pool.query('SELECT 1');
    return pool;
  } catch (err) {
    console.error('❌ PostgreSQL CONNECTION ERROR:', err.message);
    const dbErr = new Error('Database unavailable: ' + err.message);
    dbErr.code = 'DB_CONNECTION_FAILED';
    throw dbErr;
  }
}

// ─── Schema Initialization ───
async function initializeSchema() {
  console.log('🏗️  Synchronizing PostgreSQL Schema...');
  const client = await pool.connect();
  try {
    // ── Core Tables ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id        SERIAL PRIMARY KEY,
        email     VARCHAR(255) UNIQUE NOT NULL,
        password  TEXT NOT NULL,
        name      TEXT NOT NULL,
        role      VARCHAR(50) DEFAULT 'STUDENT',
        isVerified INTEGER DEFAULT 0,
        username  VARCHAR(255),
        profileImage TEXT,
        createdAt TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Exams (
        id                    SERIAL PRIMARY KEY,
        title                 TEXT NOT NULL,
        description           TEXT,
        accessCode            VARCHAR(50) UNIQUE,
        totalGrade            FLOAT NOT NULL DEFAULT 0,
        duration              INTEGER NOT NULL DEFAULT 0,
        startTime             TIMESTAMP,
        endTime               TIMESTAMP,
        instructorId          INTEGER NOT NULL REFERENCES Users(id),
        showResults           INTEGER DEFAULT 1,
        requireAIGradeApproval INTEGER DEFAULT 0,
        examType              VARCHAR(50) DEFAULT 'ONLINE',
        examMeta              TEXT,
        createdAt             TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Questions (
        id            SERIAL PRIMARY KEY,
        examId        INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
        type          VARCHAR(50) NOT NULL,
        text          TEXT NOT NULL,
        points        FLOAT NOT NULL DEFAULT 0,
        options       TEXT,
        correctAnswer TEXT,
        isMultiple    INTEGER DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Submissions (
        id          SERIAL PRIMARY KEY,
        studentId   INTEGER NOT NULL REFERENCES Users(id),
        examId      INTEGER NOT NULL REFERENCES Exams(id),
        status      VARCHAR(50) DEFAULT 'IN_PROGRESS',
        score       FLOAT DEFAULT 0,
        submittedAt TIMESTAMP,
        createdAt   TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Answers (
        id               SERIAL PRIMARY KEY,
        submissionId     INTEGER NOT NULL REFERENCES Submissions(id) ON DELETE CASCADE,
        questionId       INTEGER NOT NULL REFERENCES Questions(id),
        studentAnswer    TEXT NOT NULL,
        scoreEarned      FLOAT DEFAULT 0,
        isCorrect        INTEGER DEFAULT 0,
        isAIGradeApproved INTEGER DEFAULT 0,
        aiScore          FLOAT,
        testResults      TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS PendingUsers (
        id               SERIAL PRIMARY KEY,
        email            VARCHAR(255) UNIQUE NOT NULL,
        password         TEXT NOT NULL,
        name             TEXT NOT NULL,
        role             VARCHAR(50) DEFAULT 'STUDENT',
        verificationCode VARCHAR(50) NOT NULL,
        username         VARCHAR(255),
        profileImage     TEXT,
        createdAt        TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS PasswordResets (
        id        SERIAL PRIMARY KEY,
        email     VARCHAR(255) NOT NULL,
        token     TEXT NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        attempts  INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Analytics (
        id          SERIAL PRIMARY KEY,
        visitorId   VARCHAR(255) NOT NULL,
        userId      INTEGER REFERENCES Users(id) ON DELETE SET NULL,
        url         TEXT NOT NULL,
        referrer    TEXT,
        userAgent   TEXT,
        duration    INTEGER DEFAULT 0,
        createdAt   TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── Indices ──
    await client.query(`CREATE INDEX IF NOT EXISTS IX_Analytics_VisitorId ON Analytics(visitorId)`);
    await client.query(`CREATE INDEX IF NOT EXISTS IX_Analytics_CreatedAt ON Analytics(createdAt)`);

    // ── Unique constraint for double-submission prevention (BLOCK-4) ──
    try {
      // Remove any duplicate submissions first (keep best: SUBMITTED > IN_PROGRESS, newest)
      await client.query(`
        DELETE FROM Submissions WHERE id NOT IN (
          SELECT DISTINCT ON ("studentid", "examid") id
          FROM Submissions
          ORDER BY "studentid", "examid",
            CASE WHEN status = 'SUBMITTED' THEN 0 ELSE 1 END,
            "createdat" DESC
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_Submissions_StudentExam
        ON Submissions(studentId, examId)
      `);
    } catch (e) { /* index may already exist */ }

    // ── Role check constraint ──
    try {
      await client.query(`ALTER TABLE Users DROP CONSTRAINT IF EXISTS CHK_User_Role`);
      await client.query(`ALTER TABLE Users ADD CONSTRAINT CHK_User_Role CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'ADMIN'))`);
    } catch (e) { /* ignore */ }

    console.log('✨ PostgreSQL Schema Ready.');
    await seedAdminAccount(client);
  } finally {
    client.release();
  }
}

// ─── Admin Seed ───
async function seedAdminAccount(client) {
  try {
    const bcrypt = require('bcryptjs');
    const result = await client.query("SELECT COUNT(*) as cnt FROM Users WHERE role = 'ADMIN'");
    const adminCount = parseInt(result.rows[0].cnt, 10);

    if (adminCount === 0) {
      const adminEmail    = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminEmail || !adminPassword) {
        console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed.');
        return;
      }
      const adminName      = process.env.ADMIN_NAME || 'System Administrator';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await client.query(
        "INSERT INTO Users (email, password, name, role, isVerified) VALUES ($1, $2, $3, 'ADMIN', 1)",
        [adminEmail, hashedPassword, adminName]
      );
      console.log('🔐 Admin account created.');
    } else {
      console.log('🔐 Admin account exists. Skipping seed.');
    }
  } catch (err) {
    console.error('⚠️ Admin seed error:', err.message);
  }
}

// Boot
(async () => {
  try {
    console.log('📡 Connecting to PostgreSQL...');
    await getConnection();
    console.log('✅ PostgreSQL connected.');
    await initializeSchema();
  } catch (e) {
    console.error('🚩 DB boot failure:', e.message);
  }
})();

// ─── Query Helpers ───

const query = async (sqlText, params = []) => {
  const { sql, values } = convertParams(sqlText, params);
  const result = await pool.query(sql, values);
  return result.rows.map(camelizeRow);
};

const run = async (sqlText, params = []) => {
  let { sql, values } = convertParams(sqlText, params);
  const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
  if (isInsert && !sql.toUpperCase().includes('RETURNING')) {
    sql += ' RETURNING id';
  }
  const result = await pool.query(sql, values);
  return {
    lastID: isInsert ? (result.rows[0]?.id ?? null) : null,
    changes: result.rowCount || 0,
  };
};

const get = async (sqlText, params = []) => {
  const { sql, values } = convertParams(sqlText, params);
  const result = await pool.query(sql, values);
  return camelizeRow(result.rows[0] ?? null);
};

const withTransaction = async (callback) => {
  const client = await pool.connect();
  const runTx = async (sqlText, params = []) => {
    const { sql, values } = convertParams(sqlText, params);
    const result = await client.query(sql, values);
    return { changes: result.rowCount || 0 };
  };
  try {
    await client.query('BEGIN');
    const result = await callback(runTx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, run, get, withTransaction };
