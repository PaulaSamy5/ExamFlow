const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

console.log('📦 Core Modules Engaged. Booting System...');


const authRoutes = require('./modules/auth/auth.routes');
const examRoutes = require('./modules/exams/exam.routes');
const submissionRoutes = require('./modules/submissions/submission.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');

const app = express();

const contextStorage = require('./utils/context');

// Context Propagation Middleware
app.use((req, res, next) => {
  contextStorage.run({ req, res }, () => {
    next();
  });
});

// Graceful Database Error Interceptor Middleware
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    const isLimitErr = req.isDbLimitExceeded || 
      (body && typeof body.error === 'string' && (
        body.error.includes('DB_LIMIT_EXCEEDED') ||
        body.error.toLowerCase().includes('storage limit') ||
        body.error.toLowerCase().includes('disk full') ||
        body.error.toLowerCase().includes('insufficient disk space') ||
        body.error.toLowerCase().includes('out of disk space') ||
        body.error.toLowerCase().includes('read-only') ||
        body.error.toLowerCase().includes('read-only transaction') ||
        body.error.toLowerCase().includes('temporarily unavailable')
      ));

    if (isLimitErr) {
      res.status(503);
      return originalJson.call(this, { 
        error: 'The service is temporarily unavailable. Please try again later.' 
      });
    }
    return originalJson.call(this, body);
  };
  next();
});

// Trust Railway's reverse proxy — required for express-rate-limit and correct client IP detection
app.set('trust proxy', 1);

// ─── HTTPS Enforcement (production only, behind reverse proxy) ───
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ─── Security Headers ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow fonts/images cross-origin
  contentSecurityPolicy: false, // CSP managed separately; enabling here breaks the SPA served via Vite
}));

// ─── Rate Limiters ───
// Skip rate limiting for authenticated requests — bearer-token auth already
// proves identity, and IP-based bucketing causes false 429s for users behind
// shared NATs or cloud reverse proxies (e.g. Railway, Vercel, university WiFi).
const skipAuthenticated = (req) => !!(req.headers.authorization?.startsWith('Bearer '));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 1000,                 // 1000 requests per window per IP (unauthenticated only)
  skip: skipAuthenticated,   // authenticated requests are exempt
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 300, // Production: strict 30; dev/test: 300
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

// Middlewares
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server / curl

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow all Vercel preview/deployment subdomains
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Allow localhost only outside production — prevents same-host container abuse in prod
    if (process.env.NODE_ENV !== 'production') {
      if (/^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        return callback(null, true);
      }
    }

    callback(new Error(`CORS policy: origin ${origin} is not allowed`));
  },
  credentials: true,
}));
// 10MB covers UML diagrams (base64 images); 50MB was far too permissive for a DoS attack surface
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes (rate-limited)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/exams', apiLimiter, examRoutes);
app.use('/api/submissions', apiLimiter, submissionRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'DB_LIMIT_EXCEEDED' || err.message?.includes('DB_LIMIT_EXCEEDED')) {
    return res.status(503).json({ error: 'The service is temporarily unavailable. Please try again later.' });
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
