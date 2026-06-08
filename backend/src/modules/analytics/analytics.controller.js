const { run, query, get } = require('../../config/db');
const XLSX = require('xlsx');

// ─── Track Page View ───
const trackPageView = async (req, res) => {
  const { visitorId, url, referrer, duration } = req.body;
  const userId = req.user?.id || null;
  const userAgent = req.headers['user-agent'];

  // Guard: reject oversized payloads to prevent log flooding
  if (!url || typeof url !== 'string' || url.length > 2048) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  if (visitorId && (typeof visitorId !== 'string' || visitorId.length > 128)) {
    return res.status(400).json({ error: 'Invalid visitorId' });
  }

  try {
    await run(
      'INSERT INTO Analytics (visitorId, userId, url, referrer, userAgent, duration) VALUES (?, ?, ?, ?, ?, ?)',
      [visitorId, userId, url, referrer, userAgent, duration || 0]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Analytics tracking error:', err);
    res.status(500).json({ error: 'Failed to track analytics' });
  }
};

// ─── Get Analytics Stats for Admin ───
const getAnalyticsStats = async (req, res) => {
  try {
    // 1. Visitor Stats (Last 30 days)
    const visitorStats = await get(`
      SELECT 
        COUNT(*) as totalViews,
        COUNT(DISTINCT visitorId) as uniqueVisitors,
        COUNT(CASE WHEN userId IS NOT NULL THEN 1 END) as loggedInViews,
        COUNT(CASE WHEN userId IS NULL THEN 1 END) as guestViews,
        AVG(duration) as avgDuration
      FROM Analytics
      WHERE createdAt >= NOW() - INTERVAL '30 days'
    `);

    // 2. Returning vs New Visitors
    // New: visitorId seen for the first time in this period
    // Returning: visitorId seen before this period
    const visitorType = await get(`
      WITH FirstSeen AS (
        SELECT visitorId, MIN(createdAt) as firstVisit
        FROM Analytics
        GROUP BY visitorId
      )
      SELECT 
        COUNT(CASE WHEN firstVisit >= NOW() - INTERVAL '30 days' THEN 1 END) as newVisitors,
        COUNT(CASE WHEN firstVisit < NOW() - INTERVAL '30 days' THEN 1 END) as returningVisitors
      FROM FirstSeen
      WHERE visitorId IN (SELECT DISTINCT visitorId FROM Analytics WHERE createdAt >= NOW() - INTERVAL '30 days')
    `);

    // 3. Daily Visitor Trend (Last 14 days)
    const dailyTrend = await query(`
      SELECT 
        createdAt::DATE as date,
        COUNT(DISTINCT visitorId) as visitors,
        COUNT(DISTINCT userId) as loggedInUsers,
        COUNT(*) as pageViews
      FROM Analytics
      WHERE createdAt >= NOW() - INTERVAL '14 days'
      GROUP BY createdAt::DATE
      ORDER BY date ASC
    `);

    // 4. Most Visited Pages
    const topPages = await query(`
      SELECT
        url,
        COUNT(*) as views,
        COUNT(DISTINCT visitorId) as uniqueViews
      FROM Analytics
      WHERE createdAt >= NOW() - INTERVAL '30 days'
      GROUP BY url
      ORDER BY views DESC
      LIMIT 10
    `);

    // 5. User Activity Flags
    const flags = [];
    
    // Flag: Inactive Instructors (No exams in last 14 days)
    const inactiveInstructors = await query(`
      SELECT name, email, id FROM Users 
      WHERE role = 'INSTRUCTOR' 
      AND id NOT IN (SELECT instructorId FROM Exams WHERE createdAt >= NOW() - INTERVAL '14 days')
    `);
    if (inactiveInstructors.length > 0) {
      flags.push({ 
        type: 'INACTIVE_INSTRUCTOR', 
        message: `${inactiveInstructors.length} instructors have been inactive lately.`,
        data: inactiveInstructors 
      });
    }

    // Flag: Drop-offs (Registered but never logged a page view after registration day)
    const dropOffs = await query(`
      SELECT u.name, u.email, u.id 
      FROM Users u
      LEFT JOIN Analytics a ON u.id = a.userId
      WHERE u.createdAt >= NOW() - INTERVAL '30 days'
      GROUP BY u.id, u.name, u.email, u.createdAt
      HAVING MAX(a.createdAt) <= u.createdAt + INTERVAL '24 hours' OR MAX(a.createdAt) IS NULL
    `);
    if (dropOffs.length > 0) {
      flags.push({ 
        type: 'DROP_OFF', 
        message: `${dropOffs.length} users registered but didn't return.`,
        data: dropOffs 
      });
    }

    res.json({
      stats: {
        totalViews: visitorStats.totalViews || 0,
        uniqueVisitors: visitorStats.uniqueVisitors || 0,
        avgDuration: Math.round(visitorStats.avgDuration || 0),
        newVisitors: visitorType.newVisitors || 0,
        returningVisitors: visitorType.returningVisitors || 0,
        guestRatio: visitorStats.totalViews ? Math.round((visitorStats.guestViews / visitorStats.totalViews) * 100) : 0
      },
      dailyTrend,
      topPages,
      flags
    });

  } catch (err) {
    console.error('Failed to fetch analytics stats:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Export Report to Excel ───
const exportReport = async (req, res) => {
  const { type } = req.query; // 'visitors', 'users', 'exams'

  try {
    let data = [];
    let fileName = 'report.xlsx';

    if (type === 'users') {
      data = await query("SELECT id, name, email, role, isVerified, createdAt FROM Users ORDER BY createdAt DESC");
      fileName = 'Users_Report.xlsx';
    } else if (type === 'exams') {
      data = await query(`
        SELECT e.title, u.name as instructor, e.totalGrade, e.duration, 
               (SELECT COUNT(*) FROM Submissions s WHERE s.examId = e.id) as submissions
        FROM Exams e
        JOIN Users u ON e.instructorId = u.id
        ORDER BY e.createdAt DESC
      `);
      fileName = 'Exams_Report.xlsx';
    } else {
      data = await query("SELECT * FROM Analytics ORDER BY createdAt DESC LIMIT 5000");
      fileName = 'Visitor_Analytics_Report.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ error: 'Export failed' });
  }
};

module.exports = { trackPageView, getAnalyticsStats, exportReport };
