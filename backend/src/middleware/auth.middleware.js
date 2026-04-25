const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const instructorOnly = (req, res, next) => {
  if (req.user.role !== 'INSTRUCTOR') {
    return res.status(403).json({ error: 'Forbidden: Instructor access only' });
  }
  next();
};

const studentOnly = (req, res, next) => {
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Forbidden: Student access only' });
  }
  next();
};

module.exports = { authMiddleware, instructorOnly, studentOnly };
