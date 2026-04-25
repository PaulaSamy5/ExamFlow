const { run, get } = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../../utils/mailer');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const register = async (req, res) => {
  const { email, password, name, role } = req.body;

  try {
    const existingUser = await get('SELECT * FROM Users WHERE email = ?', [email]);
    if (existingUser) return res.status(400).json({ error: 'User identity already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    // Store in PendingUsers instead of Users
    await run('DELETE FROM PendingUsers WHERE email = ?', [email]); // Clean old pendings
    await run(
      'INSERT INTO PendingUsers (email, password, name, role, verificationCode) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, role || 'STUDENT', otp]
    );

    await sendOTP(email, otp);

    res.status(201).json({ 
      message: 'OTP sent to email', 
      email,
      requiresVerification: true 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const verifyOTP = async (req, res) => {
  const { email, code } = req.body;

  try {
    const pending = await get('SELECT * FROM PendingUsers WHERE email = ?', [email]);
    if (!pending) return res.status(404).json({ error: 'Identity not found in verification queue' });

    if (pending.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid Access Code' });
    }

    // Move to OFFICIAL Users Table
    const result = await run(
      'INSERT INTO Users (email, password, name, role, isVerified) VALUES (?, ?, ?, ?, 1)',
      [pending.email, pending.password, pending.name, pending.role]
    );

    // Clean up queue
    await run('DELETE FROM PendingUsers WHERE email = ?', [email]);

    const token = jwt.sign(
      { id: result.lastID, email: pending.email, role: pending.role },
      process.env.JWT_SECRET || 'supersecret',
      { expiresIn: '1d' }
    );

    res.json({ 
      user: { id: result.lastID, email: pending.email, name: pending.name, role: pending.role }, 
      token 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await get('SELECT * FROM Users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.isVerified === 0) {
      // Re-send OTP if needed or just inform
      return res.status(403).json({ 
        error: 'Account not verified. Please check your email.',
        requiresVerification: true,
        email: user.email
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'supersecret',
      { expiresIn: '1d' }
    );

    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const devLogin = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden in production mode' });
  }
  const { email } = req.body;
  try {
    const user = await get('SELECT * FROM Users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: `User ${email} not found in DB` });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'supersecret',
      { expiresIn: '1d' }
    );

    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { register, verifyOTP, login, devLogin };
