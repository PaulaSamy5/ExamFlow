require('dotenv').config({ path: './backend/.env' });
const { query } = require('./src/config/db');

async function test() {
  try {
    const dailyTrend = await query(`
      SELECT 
        CAST(createdAt AS DATE) as date,
        COUNT(DISTINCT visitorId) as visitors,
        COUNT(*) as pageViews
      FROM Analytics
      WHERE createdAt >= DATEADD(DAY, -14, GETDATE())
      GROUP BY CAST(createdAt AS DATE)
      ORDER BY date ASC
    `);
    console.log("DATA TYPE:", typeof dailyTrend);
    console.log("IS ARRAY:", Array.isArray(dailyTrend));
    console.log("DATA:", JSON.stringify(dailyTrend, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

test();
