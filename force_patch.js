const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'backend/exams_flow.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error(err.message);
  console.log('--- Force Schema Update (V2) ---');
  
  db.serialize(() => {
    // 1. Add Column (WITHOUT UNIQUE to bypass SQLite restriction)
    db.run('ALTER TABLE Exams ADD COLUMN accessCode TEXT', (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('🛡️ Column already exists, skipping.');
        } else {
          return console.error('❌ Alter Table Failed:', err.message);
        }
      } else {
        console.log('✅ Column accessCode added successfully.');
      }
      
      // 2. Backfill with numeric codes
      db.all('SELECT id FROM Exams WHERE accessCode IS NULL OR accessCode = ""', (err, rows) => {
        if (err) return console.error(err);
        if (rows && rows.length > 0) {
          console.log(`🔄 Backfilling ${rows.length} assessments...`);
          rows.forEach(row => {
            const newCode = Math.floor(100000 + Math.random() * 900000).toString();
            db.run('UPDATE Exams SET accessCode = ? WHERE id = ?', [newCode, row.id]);
          });
          console.log('✨ All assessments secured with digital keys.');
        } else {
          console.log('✨ No assessments found requiring backfill (already populated).');
        }
        db.close();
      });
    });
  });
});
