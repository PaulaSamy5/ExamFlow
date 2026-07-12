const { run } = require('./src/config/db');

async function deleteOldDashboardAnalytics() {
  try {
    const result = await run("DELETE FROM Analytics WHERE url = '/dashboard'");
    console.log(`Deleted ${result.changes} old /dashboard records from Analytics.`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to delete records:', err);
    process.exit(1);
  }
}

deleteOldDashboardAnalytics();
