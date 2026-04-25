const { query } = require('./src/config/db');

async function test() {
  try {
    const users = await query('SELECT id, email, role FROM Users');
    console.log('--- ALL USERS ---');
    users.forEach(u => console.log(`- ${u.email} (${u.role}) ID: ${u.id}`));
    console.log('-----------------');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
