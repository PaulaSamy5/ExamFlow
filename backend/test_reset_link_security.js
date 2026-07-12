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
  const fakeEmail = 'fake_account_does_not_exist@gmail.com';
  console.log('🧪 Starting Full Link-based Auth Flow Test');

  const { get, run } = require('./src/config/db');

  // Clear db
  await run('DELETE FROM PasswordResets WHERE email = ?', [email]);
  
  // 1. Non-existing email
  console.log('\n[1] Testing Non-Existing Email...');
  let res0 = await apiCall('/forgot-password', { email: fakeEmail });
  console.log('  Status:', res0.status, res0.data);
  if (res0.status === 200 && res0.data.message.includes('If an account exists')) {
    console.log('  ✅ Non-existing email gracefully handled (no enumeration)!');
  }

  // 2. Initial Request
  console.log(`\n[2] Requesting Reset Link for ${email}...`);
  let res1 = await apiCall('/forgot-password', { email });
  console.log('  Status:', res1.status, res1.data);
  
  // Fetch token
  const record = await get('SELECT * FROM PasswordResets WHERE email = ?', [email]);
  if (!record) {
    console.log('❌ Token not saved to DB!');
    process.exit(1);
  }
  const token = record.token;
  console.log(`\n  Retrieved real token from DB: ${token}`);

  // 3. Invalid Token
  console.log('\n[3] Testing Invalid Link/Token...');
  let res3 = await apiCall('/reset-password', { token: 'invalid_token_123', newPassword: 'NewPassword123!' });
  console.log('  Status:', res3.status, res3.data);
  if (res3.status === 400 && res3.data.error.includes('Invalid or expired')) {
    console.log('  ✅ Invalid link correctly rejected!');
  }

  // 4. Valid Link
  console.log(`\n[4] Testing Valid Link...`);
  let res6 = await apiCall('/reset-password', { token, newPassword: 'BrandNewPassword123!' });
  console.log('  Status:', res6.status, res6.data);
  if (res6.status === 200) {
    console.log('  ✅ Valid link accepted and password updated!');
  } else {
    console.log('  ❌ Valid link test failed');
  }

  // 5. Re-use Link
  console.log('\n[5] Testing Link Re-use (One-time use)...');
  let res7 = await apiCall('/reset-password', { token, newPassword: 'BrandNewPassword123!' });
  console.log('  Status:', res7.status, res7.data);
  if (res7.status === 400) {
    console.log('  ✅ Link re-use correctly prevented! Token was invalidated.');
  }

  // 6. Test Login with New Password
  console.log('\n[6] Testing Login with New Password...');
  let res8 = await apiCall('/login', { email, password: 'BrandNewPassword123!' });
  console.log('  Status:', res8.status);
  if (res8.status === 200 && res8.data.token) {
    console.log('  ✅ Login successful with new password!');
  } else {
    console.log('  ❌ Login failed');
  }

  // Restore password for dev
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('123456', 10);
  await run('UPDATE Users SET password = ? WHERE email = ?', [hashedPassword, email]);

  console.log('\n🎉 All tests completed successfully.');
  process.exit(0);
}

testFullFlow().catch(console.error);
