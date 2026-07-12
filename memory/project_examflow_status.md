---
name: project-examflow-status
description: ExamFlow platform security audit and bug-fix status as of June 2026
metadata:
  type: project
---

Full security audit of ExamFlow platform completed on 2026-06-04, based on ExamFlow_Testing_Report.pdf.

**Why:** User submitted a full testing report and requested all issues be verified and fixed.
**How to apply:** Use as reference for any future security or code-quality work on this project.

## Fixed in this session
- BUG-001 (fully): `updateProfile` now uses `req.user.id` from JWT, not `req.body.email`
- BUG-004: Removed `|| 'supersecret'` JWT fallback; server now throws on startup if `JWT_SECRET` is missing
- BUG-005: Added 10-minute OTP expiry check in `verifyOTP`
- BUG-006: Added `instructorOnly` middleware to `GET /api/exams` route
- BUG-007: `updateExam` now blocks question resync if submissions exist (409 response)
- BUG-008: `generateAccessCode` now uses `crypto.randomInt()` instead of `Math.random()`
- BUG-009: Python/C++ execution switched to `execFileSync` (no shell), `crypto.randomBytes` for temp names, `maxBuffer` limit
- BUG-012: Removed space-prefixed `frontend/ .env` from git tracking; added to `.gitignore`
- BUG-013: Removed unused `twMerge`/`clsx`/`cn` from `frontend/src/lib/utils.js` and `frontend/package.json`
- BUG-014: Removed `sqlite3`, `msnodesqlv8`, `zod` from `backend/package.json`
- CORS: Restricted to `FRONTEND_URL` / `ALLOWED_ORIGINS` env var (no longer open wildcard)
- Rate limiting: Added `express-rate-limit` (300 req/15min API-wide, 30 req/15min auth endpoints)

## Already fixed before this session
- BUG-001 (auth middleware on /profile route): `authMiddleware` was already applied
- BUG-002 (cascade delete): Full cascade in `admin.controller.js` deleteUser
- BUG-003 (SMTP .env in git): `backend/.env` was never committed
- BUG-010 (duplicate CSS): `index.css` had no duplicates

## Still open / Cannot fully fix in code
- BUG-009: Python/C++ execution is still unsandboxed at OS level (student code can access filesystem/network); full sandboxing requires Docker/containers
- BUG-011: `frontend/frontend/` nested duplicate directory still exists (cleanup only)
- No HTTPS enforcement (infrastructure/deployment concern, not code)
- Dev backdoor `/api/auth/dev-login` still exists (protected by NODE_ENV check but should be removed for production)
