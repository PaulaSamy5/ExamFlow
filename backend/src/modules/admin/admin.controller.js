const { query, get, run, withTransaction } = require('../../config/db');
const dbMonitor = require('../../services/dbMonitor');

// ─── Admin Dashboard Analytics ───
const getDashboardStats = async (req, res) => {
  try {
    // Total users by role
    const roleStats = await query(
      "SELECT role, COUNT(*) as count FROM Users GROUP BY role"
    );

    // Total users
    const totalUsers = await get("SELECT COUNT(*) as total FROM Users");

    // Recent registrations (last 30 days)
    const recentRegistrations = await query(
      "SELECT createdAt::DATE as date, COUNT(*) as count FROM Users WHERE createdAt >= NOW() - INTERVAL '30 days' GROUP BY createdAt::DATE ORDER BY date DESC"
    );

    // Active users (users who have submitted at least one exam)
    const activeStudents = await get(
      "SELECT COUNT(DISTINCT studentId) as count FROM Submissions"
    );

    // Total exams
    const totalExams = await get("SELECT COUNT(*) as total FROM Exams");

    // Total submissions
    const totalSubmissions = await get("SELECT COUNT(*) as total FROM Submissions");

    // Graded vs pending submissions
    const submissionStatus = await query(
      "SELECT status, COUNT(*) as count FROM Submissions GROUP BY status"
    );

    // Average exam score percentage — DATA-004: use 'SUBMITTED' (system never sets 'GRADED')
    const avgScore = await get(`
      SELECT AVG((s.score / NULLIF(e.totalGrade, 0)) * 100) as average
      FROM Submissions s
      JOIN Exams e ON s.examId = e.id
      WHERE s.status = 'SUBMITTED' AND s.score IS NOT NULL
    `);

    // Instructor activity (exams created per instructor)
    const instructorActivity = await query(
      "SELECT u.id, u.name, u.email, COUNT(e.id) as examCount FROM Users u LEFT JOIN Exams e ON u.id = e.instructorId WHERE u.role = 'INSTRUCTOR' GROUP BY u.id, u.name, u.email ORDER BY examCount DESC"
    );

    // Student activity (submissions per student, top 20)
    const studentActivity = await query(
      "SELECT u.id, u.name, u.email, COUNT(s.id) as submissionCount, AVG(s.score) as avgScore FROM Users u LEFT JOIN Submissions s ON u.id = s.studentId WHERE u.role = 'STUDENT' GROUP BY u.id, u.name, u.email ORDER BY submissionCount DESC LIMIT 20"
    );

    // Exams created over time (last 30 days)
    const examTimeline = await query(
      "SELECT createdAt::DATE as date, COUNT(*) as count FROM Exams WHERE createdAt >= NOW() - INTERVAL '30 days' GROUP BY createdAt::DATE ORDER BY date DESC"
    );

    res.json({
      overview: {
        totalUsers: totalUsers?.total || 0,
        totalExams: totalExams?.total || 0,
        totalSubmissions: totalSubmissions?.total || 0,
        activeStudents: activeStudents?.count || 0,
        averageScore: avgScore?.average ? Math.round(avgScore.average * 100) / 100 : 0,
      },
      roleDistribution: roleStats || [],
      recentRegistrations: recentRegistrations || [],
      submissionStatus: submissionStatus || [],
      instructorActivity: instructorActivity || [],
      studentActivity: studentActivity || [],
      examTimeline: examTimeline || [],
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Failed to load admin dashboard data' });
  }
};

// ─── Get All Users ───
const getAllUsers = async (req, res) => {
  try {
    const users = await query(
      "SELECT id, email, name, role, isVerified, createdAt FROM Users ORDER BY createdAt DESC"
    );
    res.json(users || []);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// ─── Update User Role (Admin can promote/demote — but not self) ───
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot modify your own role' });
  }

  const validRoles = ['STUDENT', 'INSTRUCTOR', 'ADMIN'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    await run("UPDATE Users SET role = ? WHERE id = ?", [role, parseInt(id)]);
    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// ─── Delete User (Admin cannot delete self) ───
const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    // Check user exists
    const user = await get("SELECT id, role FROM Users WHERE id = ?", [parseInt(id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // BLOCK-5: All 8 cascade deletes wrapped in a single transaction.
    // If any step fails the entire deletion is rolled back, preventing partial deletes.
    await withTransaction(async (runTx) => {
      // 1. Delete answers from user's submissions
      await runTx("DELETE FROM Answers WHERE submissionId IN (SELECT id FROM Submissions WHERE studentId = ?)", [parseInt(id)]);
      // 2. Delete user's submissions
      await runTx("DELETE FROM Submissions WHERE studentId = ?", [parseInt(id)]);
      // 3. If instructor, delete answers linked to their exam questions
      await runTx("DELETE FROM Answers WHERE questionId IN (SELECT id FROM Questions WHERE examId IN (SELECT id FROM Exams WHERE instructorId = ?))", [parseInt(id)]);
      // 4. Delete submissions to their exams
      await runTx("DELETE FROM Submissions WHERE examId IN (SELECT id FROM Exams WHERE instructorId = ?)", [parseInt(id)]);
      // 5. Delete their exam questions
      await runTx("DELETE FROM Questions WHERE examId IN (SELECT id FROM Exams WHERE instructorId = ?)", [parseInt(id)]);
      // 6. Delete their exams
      await runTx("DELETE FROM Exams WHERE instructorId = ?", [parseInt(id)]);
      // 7. Clean analytics references
      await runTx("UPDATE Analytics SET userId = NULL WHERE userId = ?", [parseInt(id)]);
      // 8. Finally delete the user
      await runTx("DELETE FROM Users WHERE id = ?", [parseInt(id)]);
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// ─── Get System Health ───
const getSystemInfo = async (req, res) => {
  const startTime = Date.now();

  // ── DB Health ──
  let dbStatus = 'online';
  let dbVersion = 'Unknown';
  let dbTables = 0;
  let dbSizeMB = null;
  let totalUsers = 0;
  let totalExams = 0;
  let onlineExams = 0;
  let printableExams = 0;
  let totalSubmissions = 0;

  try {
    const dbInfo = await get("SELECT version() as version");
    const tableCount = await get(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const sizeRow = await get(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes"
    );
    const userRow = await get("SELECT COUNT(*) as total FROM Users");
    const examRow = await get("SELECT COUNT(*) as total FROM Exams");
    const onlineRow = await get("SELECT COUNT(*) as total FROM Exams WHERE examType = 'ONLINE'");
    const printRow = await get("SELECT COUNT(*) as total FROM Exams WHERE examType != 'ONLINE'");
    const subRow = await get("SELECT COUNT(*) as total FROM Submissions");

    dbVersion = dbInfo?.version?.split(' ').slice(0, 2).join(' ') || 'Unknown';
    dbTables = tableCount?.count || 0;
    dbSizeMB = sizeRow?.size || null;
    totalUsers = parseInt(userRow?.total) || 0;
    totalExams = parseInt(examRow?.total) || 0;
    onlineExams = parseInt(onlineRow?.total) || 0;
    printableExams = parseInt(printRow?.total) || 0;
    totalSubmissions = parseInt(subRow?.total) || 0;
  } catch (err) {
    dbStatus = 'offline';
    console.error('DB health check failed:', err.message);
  }

  // ── AI Service Health ──
  let aiStatus = 'unknown';
  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (aiServiceUrl) {
    try {
      const http = require('http');
      const https = require('https');
      const url = new URL('/health', aiServiceUrl);
      const lib = url.protocol === 'https:' ? https : http;
      await new Promise((resolve, reject) => {
        const req = lib.get(url.toString(), { timeout: 5000 }, (r) => {
          aiStatus = r.statusCode === 200 ? 'online' : 'degraded';
          resolve();
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
    } catch {
      aiStatus = 'offline';
    }
  } else {
    aiStatus = 'not_configured';
  }

  // ── Email Service Health ──
  const emailStatus = process.env.BREVO_API_KEY || process.env.RESEND_API_KEY
    ? 'configured'
    : 'not_configured';

  // ── API Response Time ──
  const responseTimeMs = Date.now() - startTime;

  // ── Process Info ──
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const mins = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  res.json({
    services: {
      backend: 'online',
      database: dbStatus,
      aiService: aiStatus,
      emailService: emailStatus,
    },
    database: {
      version: dbVersion,
      tables: dbTables,
      sizeFormatted: dbSizeMB,
      status: dbStatus,
      storageAlert: dbMonitor.getStatus(),
    },
    platform: {
      totalUsers,
      totalExams,
      onlineExams,
      printableExams,
      totalSubmissions,
    },
    server: {
      nodeVersion: process.version,
      uptime: uptimeLabel,
      uptimeSeconds,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development',
      apiResponseTimeMs: responseTimeMs,
    },
  });
};


module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getSystemInfo,
};
