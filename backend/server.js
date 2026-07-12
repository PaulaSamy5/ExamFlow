const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = require('./src/app');

const PORT = process.env.PORT || 5000;


const server = app.listen(PORT, () => {
  console.log(`🚀 System Online: http://localhost:${PORT}`);
  // Start periodic DB space capacity monitoring
  const dbMonitor = require('./src/services/dbMonitor');
  dbMonitor.startMonitoring();
});



server.on('error', (err) => {
  console.error('❌ Server startup error:', err);
});

