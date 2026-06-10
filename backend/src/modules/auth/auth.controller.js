const { run, get } = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOTP, sendResetLink } = require('../../utils/mailer');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
}
const JWT_SECRET = process.env.JWT_SECRET;

const handleError = (res, err, context = '') => {
  console.error(`❌ [${context}]`, err.message || err);
  if (err.code === 'DB_CONNECTION_FAILED') {
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
  }
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── Rate Limiting Config ───
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;  // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;          // 60 seconds between resends
const MAX_VERIFY_ATTEMPTS = 5;                  // Max wrong OTP attempts before lockout
const OTP_EXPIRY_MS = 10 * 60 * 1000;          // 10 minutes for OTP expiry

// HIGH-002: In-memory OTP attempt tracker (keyed by email)
// Entry: { count: number, lockedUntil: timestamp|null }
const otpAttempts = new Map();
const MAX_OTP_ATTEMPTS = 5;

// Helper to generate a unique username
const generateUniqueUsername = async (name) => {
  const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  let username = baseUsername;
  let counter = 2; // start appending with 2, e.g., johnsmith2

  while (true) {
    const existingUser = await get('SELECT * FROM Users WHERE username = ?', [username]);
    const existingPending = await get('SELECT * FROM PendingUsers WHERE username = ?', [username]);
    if (!existingUser && !existingPending) {
      break;
    }
    username = `${baseUsername}${counter}`;
    counter++;
  }
  return username;
};

const register = async (req, res) => {
  const { email, password, name, role, username, profileImage } = req.body;

  // ─── VAL-001: Server-side input validation ───
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email address is required.' });
  if (!emailRegex.test(email.trim())) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Full name is required.' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
  if (!password) return res.status(400).json({ error: 'Password is required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  // Validate profileImage is safe (data URL or null) — VAL-006
  if (profileImage && typeof profileImage === 'string' &&
      !profileImage.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid profile image format.' });
  }

  // ─── Security: Block public ADMIN registration ───
  const allowedRoles = ['STUDENT', 'INSTRUCTOR'];
  const safeRole = (role || 'STUDENT').toUpperCase();
  if (!allowedRoles.includes(safeRole)) {
    return res.status(403).json({ error: 'Forbidden: Invalid role selection.' });
  }

  try {
    const existingUser = await get('SELECT * FROM Users WHERE email = ?', [email]);
    if (existingUser) return res.status(400).json({ error: 'This email is already registered.' });

    let finalUsername = username;
    if (finalUsername) {
      // If user provided one, verify it's unique
      const existingUser = await get('SELECT * FROM Users WHERE username = ?', [finalUsername]);
      const existingPending = await get('SELECT * FROM PendingUsers WHERE username = ?', [finalUsername]);
      if (existingUser || existingPending) {
         // Auto-resolve by appending suffix rather than rejecting
         finalUsername = await generateUniqueUsername(finalUsername);
      }
    } else {
      // Auto-generate from name
      finalUsername = await generateUniqueUsername(name);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // Use Math.random for OTP since it's just for email verification (or use crypto.randomInt)
    const otp = crypto.randomInt(100000, 999999).toString();

    // Store in PendingUsers instead of Users
    await run('DELETE FROM PendingUsers WHERE email = ?', [email]); // Clean old pendings
    await run(
      'INSERT INTO PendingUsers (email, password, name, role, verificationCode, username, profileImage) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name, safeRole, otp, finalUsername, profileImage || null]
    );

    // Reset any stale attempt counter so a fresh code always starts clean
    otpAttempts.delete(email);

    // Respond immediately — email is sent in background so UI doesn't hang
    res.status(201).json({
      message: 'OTP sent to email',
      email,
      requiresVerification: true
    });

    // Fire-and-forget: send OTP after response is already delivered
    sendOTP(email, otp).then(sent => {
      if (sent) console.log(`📧 [Register] OTP delivered to ${email}`);
      else console.error(`❌ [Register] OTP email failed for ${email} — user can resend`);
    });
  } catch (err) {
    return handleError(res, err, 'register');
  }
};

const verifyOTP = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  // Normalise both sides — trims whitespace and forces string comparison
  const submittedCode = String(code).trim();

  try {
    // HIGH-002: Check OTP attempt lockout
    const attempts = otpAttempts.get(email);
    if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
      const waitSecs = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      console.warn(`🔒 [verifyOTP] ${email} is locked out for ${waitSecs}s more.`);
      return res.status(429).json({ error: `Too many failed attempts. Please request a new code or wait ${waitSecs} seconds.` });
    }

    const pending = await get('SELECT * FROM PendingUsers WHERE email = ?', [email]);

    if (pending) {
      console.log(`🔍 [verifyOTP] pending record for ${email} — stored="${pending.verificationCode}" submitted="${submittedCode}" createdAt=${pending.createdAt}`);
    }

    // Race-condition guard: if record is gone but user is already verified, treat as success
    if (!pending) {
      const alreadyVerified = await get('SELECT id, email, name, role, username, profileImage FROM Users WHERE email = ? AND isVerified = 1', [email]);
      if (alreadyVerified) {
        console.log(`✅ [verifyOTP] ${email} already verified (race condition — returning success).`);
        otpAttempts.delete(email);
        const token = jwt.sign(
          { id: alreadyVerified.id, email: alreadyVerified.email, role: alreadyVerified.role },
          JWT_SECRET,
          { expiresIn: '1d' }
        );
        return res.json({ user: alreadyVerified, token });
      }
      console.warn(`⚠️  [verifyOTP] ${email} — no pending record and not yet in Users.`);
      return res.status(404).json({ error: 'Verification session not found. Please register again.' });
    }

    // ─── OTP Expiration Check ───
    const createdAt = new Date(pending.createdAt);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    const expiresAt = new Date(createdAt.getTime() + OTP_EXPIRY_MS);
    console.log(`⏰ [verifyOTP] time check for ${email}:`);
    console.log(`   created : ${createdAt.toISOString()}`);
    console.log(`   expires : ${expiresAt.toISOString()}`);
    console.log(`   now     : ${now.toISOString()}`);
    console.log(`   age     : ${Math.round(ageMs / 1000)}s  limit: ${OTP_EXPIRY_MS / 1000}s  expired: ${ageMs > OTP_EXPIRY_MS}`);
    if (ageMs > OTP_EXPIRY_MS) {
      await run('DELETE FROM PendingUsers WHERE email = ?', [email]);
      otpAttempts.delete(email);
      console.warn(`⏰ [verifyOTP] ${email} — code expired (age ${Math.round(ageMs / 1000)}s > limit ${OTP_EXPIRY_MS / 1000}s).`);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.', expired: true });
    }

    const storedCode = String(pending.verificationCode).trim();

    if (storedCode !== submittedCode) {
      const current = otpAttempts.get(email) || { count: 0, lockedUntil: null };
      current.count += 1;
      console.warn(`❌ [verifyOTP] ${email} — wrong code (attempt ${current.count}/${MAX_OTP_ATTEMPTS}). stored="${storedCode}" submitted="${submittedCode}"`);

      if (current.count >= MAX_OTP_ATTEMPTS) {
        current.lockedUntil = Date.now() + OTP_EXPIRY_MS;
        await run('DELETE FROM PendingUsers WHERE email = ?', [email]);
        otpAttempts.set(email, current);
        console.warn(`🔒 [verifyOTP] ${email} — locked out after ${MAX_OTP_ATTEMPTS} failed attempts.`);
        return res.status(429).json({ error: 'Too many failed attempts. Your verification code has been invalidated. Please register again.' });
      }

      otpAttempts.set(email, current);
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // ─── Code correct — clear attempts and promote to Users ───
    otpAttempts.delete(email);
    console.log(`✅ [verifyOTP] ${email} — code accepted.`);

    const result = await run(
      'INSERT INTO Users (email, password, name, role, isVerified, username, profileImage) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [pending.email, pending.password, pending.name, pending.role, pending.username, pending.profileImage]
    );

    await run('DELETE FROM PendingUsers WHERE email = ?', [email]);

    const token = jwt.sign(
      { id: result.lastID, email: pending.email, role: pending.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      user: {
        id: result.lastID,
        email: pending.email,
        name: pending.name,
        role: pending.role,
        username: pending.username,
        profileImage: pending.profileImage,
      },
      token,
    });
  } catch (err) {
    return handleError(res, err, 'verifyOTP');
  }
};


const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await get('SELECT * FROM Users WHERE email = ?', [email]);
    // SEC-005: Use identical error for missing user and wrong password to prevent email enumeration
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.isVerified === 0) {
      return res.status(403).json({
        error: 'Account not verified. Please check your email.',
        requiresVerification: true,
        email: user.email
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, username: user.username, profileImage: user.profileImage }, token });
  } catch (err) {
    return handleError(res, err, 'login');
  }
};


// ═══════════════════════════════════════════════════════════════
//  SECURE PASSWORD RESET FLOW (Link-based)
// ═══════════════════════════════════════════════════════════════

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await get('SELECT * FROM Users WHERE email = ?', [email]);
    
    // Always return same message (prevent email enumeration)
    const safeMessage = 'If an account exists, a reset link has been sent.';
    
    if (!user) {
      return res.json({ message: safeMessage });
    }

    // ─── Rate Limiting: Check cooldown (return same message to avoid email enumeration) ───
    const existing = await get('SELECT * FROM PasswordResets WHERE email = ?', [email]);
    if (existing) {
      const nodeCreatedAt = new Date(existing.expiresAt).getTime() - RESET_TOKEN_EXPIRY_MS;
      const elapsed = Date.now() - nodeCreatedAt;
      if (elapsed < RESEND_COOLDOWN_MS) {
        // Return same generic message — do NOT return 429 or retryAfter which would confirm the email exists
        return res.json({ message: safeMessage });
      }
    }

    // ─── Generate cryptographically secure 64-char token ───
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    // Clean up old tokens for this email
    await run('DELETE FROM PasswordResets WHERE email = ?', [email]);

    // Store the new token (attempts starts at 0)
    await run(
      'INSERT INTO PasswordResets (email, token, expiresAt) VALUES (?, ?, ?)',
      [email, resetToken, expiresAt]
    );

    console.log(`🔐 [Reset] Link generated for ${email}, expires at ${expiresAt.toISOString()}`);

    // Build frontend link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send the link via email
    await sendResetLink(email, resetLink);

    res.json({ message: safeMessage });
  } catch (err) {
    return handleError(res, err, 'forgotPassword');
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const resetRecord = await get('SELECT * FROM PasswordResets WHERE token = ?', [token]);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    // ─── Check expiration ───
    const now = new Date();
    const expiresAt = new Date(resetRecord.expiresAt);
    if (now > expiresAt) {
      await run('DELETE FROM PasswordResets WHERE token = ?', [token]);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    // ─── Check max attempts (optional for links, but good to keep) ───
    const attempts = resetRecord.attempts || 0;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      await run('DELETE FROM PasswordResets WHERE token = ?', [token]);
      return res.status(400).json({ error: 'Too many invalid attempts. Please request a new link.' });
    }

    // ─── Code is valid — update password ───
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await run('UPDATE Users SET password = ? WHERE email = ?', [hashedPassword, resetRecord.email]);
    
    // ─── Invalidate the token immediately (one-time use) ───
    await run('DELETE FROM PasswordResets WHERE token = ?', [token]);

    console.log(`✅ [Reset] Password updated for ${resetRecord.email}`);
    res.json({ message: 'Password has been successfully updated.' });
  } catch (err) {
    return handleError(res, err, 'resetPassword');
  }
};

// ═══════════════════════════════════════════════════════════════
//  USER PROFILE UPDATES
// ═══════════════════════════════════════════════════════════════

const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, username, profileImage, newPassword } = req.body;

  try {
    const user = await get('SELECT * FROM Users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validate username uniqueness if changed
    if (username && username !== user.username) {
      const existingUsername = await get('SELECT * FROM Users WHERE username = ?', [username]);
      if (existingUsername) return res.status(400).json({ error: 'Username is already taken.' });
    }

    // HIGH-004: Validate profile image format
    if (profileImage && typeof profileImage === 'string' && !profileImage.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid profile image format.' });
    }

    let passwordToSave = user.password;
    if (newPassword) {
      if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      passwordToSave = await bcrypt.hash(newPassword, 12);
    }

    await run(
      'UPDATE Users SET name = ?, username = ?, profileImage = ?, password = ? WHERE id = ?',
      [name || user.name, username || user.username, profileImage !== undefined ? profileImage : user.profileImage, passwordToSave, userId]
    );

    // Fetch updated user to return
    const updatedUser = await get('SELECT id, email, name, role, username, profileImage FROM Users WHERE id = ?', [userId]);

    // Issue a new token with updated details
    const token = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ message: 'Profile updated successfully', user: updatedUser, token });
  } catch (err) {
    return handleError(res, err, 'updateProfile');
  }
};

module.exports = { register, verifyOTP, login, forgotPassword, resetPassword, updateProfile };
