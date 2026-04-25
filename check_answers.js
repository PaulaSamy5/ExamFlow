const { query } = require('./backend/src/config/db');

async function check() {
  try {
    const answers = await query('SELECT TOP 5 a.*, q.text as qText FROM Answers a JOIN Questions q ON a.questionId = q.id ORDER BY a.id DESC');
    console.log(JSON.stringify(answers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
