const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/exams_flow.db');

db.serialize(() => {
  console.log('--- Database Deep Wipe Initiation ---');
  
  db.run('DELETE FROM Users', (err) => {
    if (err) console.error('❌ Users wipe failed:', err.message);
    else console.log('✅ Users records purged.');
  });

  db.run('DELETE FROM Exams', (err) => {
    if (err) console.error('❌ Exams wipe failed:', err.message);
    else console.log('✅ Exams records purged.');
  });

  db.run('DELETE FROM Questions', (err) => {
    if (err) console.error('❌ Questions wipe failed:', err.message);
    else console.log('✅ Questions records purged.');
  });

  db.run('DELETE FROM Submissions', (err) => {
    if (err) console.error('❌ Submissions wipe failed:', err.message);
    else console.log('✅ Submissions records purged.');
  });

  console.log('--- System is now Pureized ---');
});

db.close();
