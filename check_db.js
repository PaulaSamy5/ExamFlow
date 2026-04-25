const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'backend/exams_flow.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error(err.message);
  console.log('--- Database Check ---');
  db.all('PRAGMA table_info(Exams)', (err, columns) => {
    if (err) return console.error(err);
    console.log('Columns:', columns.map(c => c.name).join(', '));
    
    db.all('SELECT id, title, accessCode FROM Exams LIMIT 5', (err, rows) => {
      if (err) return console.error(err);
      console.log('Data Check:', JSON.stringify(rows, null, 2));
      db.close();
    });
  });
});
