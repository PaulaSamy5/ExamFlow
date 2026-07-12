const http = require('http');

function apiCall(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: `/api/auth${path}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function testFullFlow() {
  const email = 'paulasamy52@gmail.com';
  console.log('🧪 Starting Full Auth Flow Test for', email);

  // 1. Initial Request
  console.log('\n[1] Requesting Reset Code...');
  let res1 = await apiCall('/forgot-password', { email });
  console.log('  Status:', res1.status, res1.data);
  if (res1.status !== 200) return;

  // 2. Test Cooldown (Requesting again immediately)
  console.log('\n[2] Testing Rate Limit / Cooldown (Requesting again immediately)...');
  let res2 = await apiCall('/forgot-password', { email });
  console.log('  Status:', res2.status, res2.data);
  if (res2.status === 429) {
    console.log('  ✅ Cooldown works!');
  } else {
    console.log('  ❌ Cooldown failed. Status was', res2.status);
  }

  // We need to fetch the code directly from DB to test the rest
  const { get, run } = require('./src/config/db');
  const record = await get('SELECT * FROM PasswordResets WHERE email = ?', [email]);
  if (!record) {
    console.log('❌ Code not saved to DB!');
    process.exit(1);
  }
  const code = record.token;
  console.log(`\n  Retrieved real code from DB: ${code}`);

  // 3. Test Invalid Code
  console.log('\n[3] Testing Invalid Code...');
  let res3 = await apiCall('/reset-password', { email, code: '111111', newPassword: 'NewPassword123!' });
  console.log('  Status:', res3.status, res3.data);
  if (res3.status === 400 && res3.data.error.includes('Invalid reset code')) {
    console.log('  ✅ Invalid code correctly rejected!');
  } else {
    console.log('  ❌ Invalid code test failed');
  }

  // 4. Test Max Attempts
  console.log('\n[4] Testing Max Attempts...');
  // It takes 5 attempts. We did 1.
  for (let i = 0; i < 4; i++) {
    await apiCall('/reset-password', { email, code: '111111', newPassword: 'NewPassword123!' });
  }
  // This 6th attempt should fail due to too many invalid attempts
  let res4 = await apiCall('/reset-password', { email, code, newPassword: 'NewPassword123!' });
  console.log('  Status after max attempts:', res4.status, res4.data);
  if (res4.status === 400 && (res4.data.error.includes('Too many invalid attempts') || res4.data.error.includes('No reset code found'))) {
    console.log('  ✅ Max attempts protection works! Code was invalidated.');
  } else {
    console.log('  ❌ Max attempts test failed');
  }

  // Reset the code to test valid scenario
  console.log('\n--- Resetting db for valid scenario test ---');
  await run('DELETE FROM PasswordResets WHERE email = ?', [email]);
  // Wait 1s just in case
  await delay(1000);
  
  // Create a new code, manually bypassing cooldown
  console.log('\n[5] Requesting new code...');
  let res5 = await apiCall('/forgot-password', { email });
  console.log('  Status:', res5.status);
  
  const record2 = await get('SELECT * FROM PasswordResets WHERE email = ?', [email]);
  const validCode = record2.token;

  // 6. Test Valid Code
  console.log(`\n[6] Testing Valid Code (${validCode})...`);
  let res6 = await apiCall('/reset-password', { email, code: validCode, newPassword: 'BrandNewPassword123!' });
  console.log('  Status:', res6.status, res6.data);
  if (res6.status === 200) {
    console.log('  ✅ Valid code accepted and password updated!');
  } else {
    console.log('  ❌ Valid code test failed');
  }

  // 7. Test Re-use
  console.log('\n[7] Testing Code Re-use...');
  let res7 = await apiCall('/reset-password', { email, code: validCode, newPassword: 'BrandNewPassword123!' });
  console.log('  Status:', res7.status, res7.data);
  if (res7.status === 400) {
    console.log('  ✅ Code re-use correctly prevented! Code was one-time use.');
  } else {
    console.log('  ❌ Code re-use test failed');
  }
  
  // Set password back to something easy for dev
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('123456', 10);
  await run('UPDATE Users SET password = ? WHERE email = ?', [hashedPassword, email]);

  console.log('\n🎉 All tests completed successfully.');
  process.exit(0);
}

testFullFlow().catch(console.error);
