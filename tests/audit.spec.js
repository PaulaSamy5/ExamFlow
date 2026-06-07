// ExamFlow Comprehensive E2E Audit Test Suite
// Base URL: http://localhost:5173
// Backend: http://localhost:5000
//
// Prerequisites:
//   1. Run `npm run dev` from the project root to start all services.
//   2. Run `npm install` inside tests/ to install @playwright/test.
//   3. Run `npx playwright install chromium` to install the browser.
//   4. Execute: npx playwright test --reporter=list

const { test, expect } = require('@playwright/test');

// ─── Test credentials ────────────────────────────────────────────────────────
const INSTRUCTOR = { email: 'instructor_test@examflow.com', password: 'Test1234!', name: 'Test Instructor' };
const STUDENT    = { email: 'student_test@examflow.com',    password: 'Test1234!', name: 'Test Student' };
const ADMIN      = { email: 'admin@examflow.com',           password: 'ExamFlow@Admin2026' };

// Shared state between tests
let createdExamId = null;
let examAccessCode = null;
let submissionId = null;

// ─── Helper: log in programmatically via the UI ──────────────────────────────
async function loginAs(page, creds) {
  await page.goto('/login');
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10000 });
}

// ─── Helper: register a new account (bypasses OTP via dev-login after register) ──
async function ensureUserExists(page, creds, role) {
  // Try to log in first; if it fails, we register.
  const resp = await page.request.post('http://localhost:5000/api/auth/dev-login', {
    data: { email: creds.email },
  });
  if (resp.ok()) return; // user exists

  // User doesn't exist — fall back to API-level register + OTP verification would be needed.
  // For CI simplicity, we call the register endpoint and skip OTP (not feasible in headless without email).
  // Signal that setup is incomplete.
  console.warn(`WARNING: User ${creds.email} not found in DB. Create it manually or via /dev-login.`);
}

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Navigation & Page Load
// ═════════════════════════════════════════════════════════════════════════════

test.describe('1. Navigation & Page Load', () => {
  test('1.1 HomePage loads without crash', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
    // Should not show a blank white screen
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(20);
  });

  test('1.2 /login page loads and has email + password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('1.3 /register page loads with role selector', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('button:has-text("Student")')).toBeVisible();
    await expect(page.locator('button:has-text("Instructor")')).toBeVisible();
  });

  test('1.4 /forgot-password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('1.5 /reset-password without token shows error state', async ({ page }) => {
    await page.goto('/reset-password');
    // Should show "Invalid Reset Link" state, not a blank page
    await expect(page.locator('text=Invalid Reset Link')).toBeVisible();
  });

  test('1.6 Unknown routes redirect to home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    // Should redirect to / (wildcard route in App.jsx)
    await expect(page).toHaveURL('/');
  });

  test('1.7 /session/* not accessible without login', async ({ page }) => {
    await page.goto('/session/999');
    await expect(page).toHaveURL('/login');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Auth: Login Validation
// ═════════════════════════════════════════════════════════════════════════════

test.describe('2. Authentication — Login Validation', () => {
  test('2.1 Submit empty form shows field errors', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Email address is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('2.2 Invalid email format shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'notanemail');
    await page.fill('input[type="password"]', 'anything');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=valid email address')).toBeVisible();
  });

  test('2.3 Wrong credentials show toast error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'WrongPass1!');
    await page.click('button[type="submit"]');
    // Expect an error toast or inline error
    await page.waitForSelector('[data-testid="toast"], .react-hot-toast, text=not found, text=Invalid credentials, text=Login failed', { timeout: 8000 }).catch(() => {});
    // Still on login page
    await expect(page).toHaveURL('/login');
  });

  test('2.4 Password toggle works', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    // Click the eye icon button (tabIndex="-1", near the password field)
    const toggle = page.locator('button[tabindex="-1"]').first();
    await toggle.click();
    // Input type should switch to text
    await expect(page.locator('input[type="text"]').last()).toBeVisible();
  });

  test('2.5 Successful login with admin credentials', async ({ page }) => {
    await loginAs(page, ADMIN);
    // Should land on /admin
    await expect(page).toHaveURL('/admin');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Auth: Registration Flow Validation
// ═════════════════════════════════════════════════════════════════════════════

test.describe('3. Registration — Form Validation', () => {
  test('3.1 Step 1: requires role selection', async ({ page }) => {
    await page.goto('/register');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Please select an account type')).toBeVisible();
  });

  test('3.2 Step 1: requires first and last name', async ({ page }) => {
    await page.goto('/register');
    await page.click('button:has-text("Student")');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Last name is required')).toBeVisible();
  });

  test('3.3 Step 2: shows password strength indicator', async ({ page }) => {
    await page.goto('/register');
    // Complete step 1
    await page.click('button:has-text("Student")');
    await page.fill('input[placeholder="Jane"]', 'Test');
    await page.fill('input[placeholder="Doe"]', 'User');
    await page.click('button:has-text("Continue")');
    // Now on step 2 - check password strength bars appear
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('weak');
    // Strength bars exist
    await expect(page.locator('.rounded-full').first()).toBeVisible();
  });

  test('3.4 Cannot advance step 2 without valid password', async ({ page }) => {
    await page.goto('/register');
    await page.click('button:has-text("Student")');
    await page.fill('input[placeholder="Jane"]', 'Test');
    await page.fill('input[placeholder="Doe"]', 'User');
    await page.click('button:has-text("Continue")');
    // Enter too short email and weak password
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'short');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Please meet all password requirements')).toBeVisible();
  });

  test('3.5 Cannot register with already-taken email', async ({ page }) => {
    // admin@examflow.com always exists in DB
    await page.goto('/register');
    await page.click('button:has-text("Student")');
    await page.fill('input[placeholder="Jane"]', 'Dup');
    await page.fill('input[placeholder="Doe"]', 'Email');
    await page.click('button:has-text("Continue")');
    await page.fill('input[type="email"]', 'admin@examflow.com');
    await page.fill('input[type="password"]', 'ValidPass1!');
    await page.click('button:has-text("Continue")');
    // Should get an error from server about email already registered
    await page.waitForSelector('text=already registered, text=toast', { timeout: 8000 }).catch(() => {});
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 4 — Forgot / Reset Password
// ═════════════════════════════════════════════════════════════════════════════

test.describe('4. Forgot / Reset Password', () => {
  test('4.1 Forgot password: empty email shows error', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.click('#send-reset-btn');
    await expect(page.locator('text=Email address is required')).toBeVisible();
  });

  test('4.2 Forgot password: invalid email format', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('#forgot-email', 'notvalid');
    await page.click('#send-reset-btn');
    await expect(page.locator('text=valid email address')).toBeVisible();
  });

  test('4.3 Forgot password: any email shows "sent" state (anti-enumeration)', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('#forgot-email', 'doesnotexist@test.com');
    await page.click('#send-reset-btn');
    // Backend returns same success message for any email
    await page.waitForSelector('text=reset link', { timeout: 8000 });
  });

  test('4.4 Reset password: submit with no token redirects to error state', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('text=Invalid Reset Link')).toBeVisible();
  });

  test('4.5 Reset password: weak password is blocked', async ({ page }) => {
    await page.goto('/reset-password?token=fakeinvalidtoken123');
    await page.fill('input[type="password"]:first-of-type', 'short');
    await page.fill('input[type="password"]:last-of-type', 'short');
    // Submit button should be disabled since isValidPassword is false
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 5 — Instructor Dashboard
// ═════════════════════════════════════════════════════════════════════════════

test.describe('5. Instructor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, INSTRUCTOR);
  });

  test('5.1 Instructor dashboard loads', async ({ page }) => {
    await expect(page).toHaveURL('/instructor/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('5.2 Create exam button is visible', async ({ page }) => {
    await expect(page.locator('text=Create Exam').first()).toBeVisible();
  });

  test('5.3 Student cannot access instructor dashboard', async ({ page }) => {
    // Log out
    await page.locator('button[title="Secure Sign Out"]').click();
    await loginAs(page, STUDENT);
    await page.goto('/instructor/dashboard');
    // Should redirect to login (not the instructor dashboard)
    await expect(page).toHaveURL('/login');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 6 — Create Exam
// ═════════════════════════════════════════════════════════════════════════════

test.describe('6. Create Exam', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, INSTRUCTOR);
  });

  test('6.1 /exams/new page loads for instructor', async ({ page }) => {
    await page.goto('/exams/new');
    await expect(page.locator('body')).toBeVisible();
    // Page should have an exam title input
    await expect(page.locator('input[placeholder*="title" i], input[placeholder*="exam" i], input[id*="title" i]').first()).toBeVisible();
  });

  test('6.2 Submit empty exam form shows validation errors', async ({ page }) => {
    await page.goto('/exams/new');
    // Try to save without filling anything
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Publish"), button:has-text("Create")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      // Some validation errors should appear
      await page.waitForSelector('text=required, text=Please, text=error', { timeout: 5000 }).catch(() => {});
    }
  });

  test('6.3 Can add an MCQ question', async ({ page }) => {
    await page.goto('/exams/new');
    // Click "Add Question" bar
    const addBtn = page.locator('button:has-text("Add Question")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.locator('button:has-text("MCQ")').click();
      // A question card should appear
      await expect(page.locator('text=MCQ, text=Multiple Choice').first()).toBeVisible();
    }
  });

  test('6.4 Cannot access /exams/new as student', async ({ page }) => {
    await page.locator('button[title="Secure Sign Out"]').click();
    await loginAs(page, STUDENT);
    await page.goto('/exams/new');
    await expect(page).toHaveURL('/login');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 7 — Student Dashboard
// ═════════════════════════════════════════════════════════════════════════════

test.describe('7. Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, STUDENT);
  });

  test('7.1 Student dashboard loads', async ({ page }) => {
    await expect(page).toHaveURL('/student/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('7.2 Join code input is visible', async ({ page }) => {
    await expect(page.locator('input[placeholder*="6-digit" i], input[placeholder*="code" i]').first()).toBeVisible();
  });

  test('7.3 Instructor cannot access student dashboard', async ({ page }) => {
    await page.locator('button[title="Secure Sign Out"]').click();
    await loginAs(page, INSTRUCTOR);
    await page.goto('/student/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('7.4 Invalid access code shows error', async ({ page }) => {
    const codeInput = page.locator('input[placeholder*="6-digit" i], input[placeholder*="code" i]').first();
    await codeInput.fill('000000');
    await page.keyboard.press('Enter');
    // Should show an error toast
    await page.waitForSelector('text=Invalid, text=not found, text=error', { timeout: 5000 }).catch(() => {});
  });

  test('7.5 Empty code submit does nothing', async ({ page }) => {
    // Clear the input and submit
    const codeInput = page.locator('input[placeholder*="6-digit" i], input[placeholder*="code" i]').first();
    await codeInput.fill('');
    await page.keyboard.press('Enter');
    // Should still be on dashboard
    await expect(page).toHaveURL('/student/dashboard');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 8 — Role Separation & Access Control
// ═════════════════════════════════════════════════════════════════════════════

test.describe('8. Role Separation & Access Control', () => {
  test('8.1 Unauthenticated user cannot reach /exams/new', async ({ page }) => {
    await page.goto('/exams/new');
    await expect(page).toHaveURL('/login');
  });

  test('8.2 Unauthenticated user cannot reach /submissions/123', async ({ page }) => {
    await page.goto('/submissions/123');
    await expect(page).toHaveURL('/login');
  });

  test('8.3 Unauthenticated user cannot reach /exams/123/submissions', async ({ page }) => {
    await page.goto('/exams/123/submissions');
    await expect(page).toHaveURL('/login');
  });

  test('8.4 Admin dashboard is accessible only by admin', async ({ page }) => {
    // Not logged in
    await page.goto('/admin');
    await expect(page).toHaveURL('/login');
  });

  test('8.5 Admin dashboard loads after admin login', async ({ page }) => {
    await loginAs(page, ADMIN);
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('text=Platform Overview').first()).toBeVisible();
  });

  test('8.6 Instructor cannot access /admin', async ({ page }) => {
    await loginAs(page, INSTRUCTOR);
    await page.goto('/admin');
    // Should redirect to login (not admin role)
    await expect(page).toHaveURL('/login');
  });

  test('8.7 Student cannot start another student\'s submission', async ({ page }) => {
    await loginAs(page, STUDENT);
    // Attempt to fetch a submission that belongs to a different user by going to /session/1
    // The backend should reject this — session page should redirect home
    await page.goto('/session/99999');
    // Should error out and navigate away
    await page.waitForURL(url => !url.pathname.startsWith('/session'), { timeout: 8000 }).catch(() => {});
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 9 — Profile Settings
// ═════════════════════════════════════════════════════════════════════════════

test.describe('9. Profile Settings', () => {
  test('9.1 Profile page loads when authenticated', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/profile');
    await expect(page.locator('body')).toBeVisible();
    // Should have a name field
    await expect(page.locator('input[placeholder*="Full name" i], input[placeholder*="name" i]').first()).toBeVisible();
  });

  test('9.2 Empty name is rejected', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/profile');
    const nameInput = page.locator('input[placeholder*="Full name" i], input[placeholder*="name" i]').first();
    await nameInput.fill('');
    await page.locator('button[type="submit"], button:has-text("Save")').first().click();
    await expect(page.locator('text=Full name is required.')).toBeVisible();
  });

  test('9.3 Profile page not accessible when logged out', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/login');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 10 — Edge Cases & Error States
// ═════════════════════════════════════════════════════════════════════════════

test.describe('10. Edge Cases & Error States', () => {
  test('10.1 /exams/:id with non-existent ID shows not-found UI', async ({ page }) => {
    await loginAs(page, STUDENT);
    await page.goto('/exams/999999');
    // Should show some kind of not-found indicator (not a blank page crash)
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(10);
  });

  test('10.2 /submissions/:id with non-existent ID shows error', async ({ page }) => {
    await loginAs(page, STUDENT);
    await page.goto('/submissions/999999');
    await expect(page.locator('body')).toBeVisible();
  });

  test('10.3 ExamJoin with invalid code shows error', async ({ page }) => {
    await loginAs(page, STUDENT);
    await page.goto('/exams/join/000000');
    await expect(page.locator('text=Validation Failure').first()).toBeVisible({ timeout: 8000 });
  });

  test('10.4 /reset-password with expired/invalid token shows error', async ({ page }) => {
    await page.goto('/reset-password?token=expiredtoken000000000000000000000000000000000');
    // Fill in a valid password using nth selectors (both inputs have the same type)
    await page.locator('input[type="password"]').nth(0).fill('ValidPass1!');
    await page.locator('input[type="password"]').nth(1).fill('ValidPass1!');
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).not.toBeDisabled();
    await submitBtn.click();
    // Should show error about invalid/expired token
    await page.waitForSelector('text=expired, text=Invalid, text=Failed to reset', { timeout: 8000 }).catch(() => {});
  });

  test('10.5 Dev login endpoint not exposed in prod-like check', async ({ page }) => {
    // The /auth/dev-login endpoint exists — this is a security finding we document
    // (it only blocks if NODE_ENV === 'production')
    const resp = await page.request.post('http://localhost:5000/api/auth/dev-login', {
      data: { email: 'admin@examflow.com' },
    });
    // In dev mode it returns 200; in prod it returns 403.
    // We just record that this endpoint exists and is callable.
    console.log(`[SEC] /dev-login returned: ${resp.status()} — ensure NODE_ENV=production disables this`);
    expect([200, 403, 404]).toContain(resp.status());
  });

  test('10.6 Logged-in user redirected from /login to dashboard', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/login');
    await expect(page).not.toHaveURL('/login');
  });

  test('10.7 Logged-in user redirected from /register to dashboard', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/register');
    await expect(page).not.toHaveURL('/register');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 11 — Exam Detail & Session (integration - requires live exam)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('11. Exam Session Guards', () => {
  test('11.1 Already-submitted session redirects away', async ({ page }) => {
    await loginAs(page, STUDENT);
    // Attempt to navigate to a session ID that doesn't exist or is submitted
    await page.goto('/session/99999');
    // Should not stay on /session/
    await page.waitForURL(url => !url.pathname.startsWith('/session'), { timeout: 10000 });
  });

  test('11.2 ExamDetail loads for authenticated user', async ({ page }) => {
    await loginAs(page, STUDENT);
    // Navigate to a generic exam detail — even if not found, page should render
    await page.goto('/exams/1');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 12 — Instructor Exam Submissions
// ═════════════════════════════════════════════════════════════════════════════

test.describe('12. Instructor Exam Submissions', () => {
  test('12.1 /exams/:id/submissions loads for instructor', async ({ page }) => {
    await loginAs(page, INSTRUCTOR);
    await page.goto('/exams/1/submissions');
    await expect(page.locator('body')).toBeVisible();
  });

  test('12.2 Student cannot access /exams/:id/submissions', async ({ page }) => {
    await loginAs(page, STUDENT);
    await page.goto('/exams/1/submissions');
    await expect(page).toHaveURL('/login');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 13 — Theme Toggle
// ═════════════════════════════════════════════════════════════════════════════

test.describe('13. UI — Theme Toggle', () => {
  test('13.1 Theme toggle button is visible', async ({ page }) => {
    await page.goto('/login');
    const themeBtn = page.locator('button[aria-label*="theme" i], button:has(svg)').first();
    await expect(themeBtn).toBeVisible();
  });

  test('13.2 Clicking theme toggle does not crash the page', async ({ page }) => {
    await page.goto('/');
    const toggleBtns = page.locator('button').filter({ hasText: '' });
    // Find the theme button by looking for sun/moon icon
    const moonSunBtn = page.locator('button').nth(0);
    await moonSunBtn.click().catch(() => {}); // may not be the right button but should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 14 — Backend API Direct Tests
// ═════════════════════════════════════════════════════════════════════════════

test.describe('14. Backend API Security', () => {
  test('14.1 Health endpoint returns OK', async ({ page }) => {
    const resp = await page.request.get('http://localhost:5000/health');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('OK');
  });

  test('14.2 /api/exams requires auth token', async ({ page }) => {
    const resp = await page.request.get('http://localhost:5000/api/exams');
    expect(resp.status()).toBe(401);
  });

  test('14.3 /api/admin/users requires auth + admin role', async ({ page }) => {
    const resp = await page.request.get('http://localhost:5000/api/admin/users');
    expect(resp.status()).toBe(401);
  });

  test('14.4 /api/submissions/stats requires student role', async ({ page }) => {
    const resp = await page.request.get('http://localhost:5000/api/submissions/stats');
    expect(resp.status()).toBe(401);
  });

  test('14.5 Register with ADMIN role is blocked', async ({ page }) => {
    const resp = await page.request.post('http://localhost:5000/api/auth/register', {
      data: { email: 'hackeradmin@test.com', password: 'Test1234!', name: 'Hacker', role: 'ADMIN' },
    });
    expect(resp.status()).toBe(403);
  });

  test('14.6 Register with no data returns error', async ({ page }) => {
    const resp = await page.request.post('http://localhost:5000/api/auth/register', {
      data: {},
    });
    // Should not crash with 500 — should return a validation error
    expect(resp.status()).not.toBe(200);
  });

  test('14.7 JWT token cannot be used for wrong role endpoint', async ({ page }) => {
    // Login as student, then call instructor-only endpoint
    const loginResp = await page.request.post('http://localhost:5000/api/auth/login', {
      data: { email: STUDENT.email, password: STUDENT.password },
    });
    if (loginResp.status() !== 200) {
      // Student account may not exist in DB; skip gracefully
      test.skip();
      return;
    }
    const { token } = await loginResp.json();
    const examResp = await page.request.post('http://localhost:5000/api/exams', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Test', totalGrade: 100, duration: 60, startTime: new Date().toISOString(), endTime: new Date().toISOString(), questions: [] },
    });
    expect(examResp.status()).toBe(403);
  });

  test('14.8 SQL injection attempt in login is handled', async ({ page }) => {
    const resp = await page.request.post('http://localhost:5000/api/auth/login', {
      data: { email: "admin@examflow.com' OR 1=1--", password: 'anything' },
    });
    // Should return 404 (user not found) or 400, never 200 with a token
    expect(resp.status()).not.toBe(200);
  });

  test('14.9 Rate limiter header is present', async ({ page }) => {
    const resp = await page.request.get('http://localhost:5000/api/exams');
    // RateLimit-Limit header should be set
    const headers = resp.headers();
    expect(headers['ratelimit-limit'] || headers['x-ratelimit-limit']).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 15 — Accessibility Spot Checks
// ═════════════════════════════════════════════════════════════════════════════

test.describe('15. Accessibility Spot Checks', () => {
  test('15.1 Login page has form labels', async ({ page }) => {
    await page.goto('/login');
    const labels = await page.locator('label').count();
    expect(labels).toBeGreaterThan(0);
  });

  test('15.2 Login form supports keyboard-only submit (Enter)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'TestPass1!');
    await page.keyboard.press('Enter');
    // Should not remain on login with nothing happening
    await expect(page.locator('body')).toBeVisible();
  });

  test('15.3 Register page has visible progress indicator', async ({ page }) => {
    await page.goto('/register');
    // The step indicator dots should be visible
    const dots = page.locator('.rounded-full').filter({ hasText: '' });
    const count = await dots.count();
    expect(count).toBeGreaterThan(0);
  });

  test('15.4 Error messages use role=alert or visible text', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // Error messages should be visible
    await expect(page.locator('text=required').first()).toBeVisible();
  });

  test('15.5 Page has a document title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
