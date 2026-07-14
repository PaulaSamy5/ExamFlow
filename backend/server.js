const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

if (process.env.VERCEL) {
  // Export app handler for Vercel Serverless Function execution
  module.exports = app;
} else {
  // Regular long-running server boot (local / traditional hosting)
  const server = app.listen(PORT, () => {
    console.log(`🚀 System Online: http://localhost:${PORT}`);
    // Run a single initial DB check at boot to warm up in-memory values
    const dbMonitor = require('./src/services/dbMonitor');
    dbMonitor.checkDatabaseSize().catch((err) => console.error('[DB Boot Check Error]', err.message));
  });

  server.on('error', (err) => {
    console.error('❌ Server startup error:', err);
  });
}

