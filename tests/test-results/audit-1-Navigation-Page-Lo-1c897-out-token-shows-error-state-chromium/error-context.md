# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audit.spec.js >> 1. Navigation & Page Load >> 1.5 /reset-password without token shows error state
- Location: audit.spec.js:79:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/reset-password
Call log:
  - navigating to "http://localhost:5173/reset-password", waiting until "load"

```

# Test source

```ts
  1   | // ExamFlow Comprehensive E2E Audit Test Suite
  2   | // Base URL: http://localhost:5173
  3   | // Backend: http://localhost:5000
  4   | //
  5   | // Prerequisites:
  6   | //   1. Run `npm run dev` from the project root to start all services.
  7   | //   2. Run `npm install` inside tests/ to install @playwright/test.
  8   | //   3. Run `npx playwright install chromium` to install the browser.
  9   | //   4. Execute: npx playwright test --reporter=list
  10  | 
  11  | const { test, expect } = require('@playwright/test');
  12  | 
  13  | // ─── Test credentials ────────────────────────────────────────────────────────
  14  | const INSTRUCTOR = { email: 'instructor_test@examflow.com', password: 'Test1234!', name: 'Test Instructor' };
  15  | const STUDENT    = { email: 'student_test@examflow.com',    password: 'Test1234!', name: 'Test Student' };
  16  | const ADMIN      = { email: 'admin@examflow.com',           password: 'ExamFlow@Admin2026' };
  17  | 
  18  | // Shared state between tests
  19  | let createdExamId = null;
  20  | let examAccessCode = null;
  21  | let submissionId = null;
  22  | 
  23  | // ─── Helper: log in programmatically via the UI ──────────────────────────────
  24  | async function loginAs(page, creds) {
  25  |   await page.goto('/login');
  26  |   await page.fill('input[type="email"]', creds.email);
  27  |   await page.fill('input[type="password"]', creds.password);
  28  |   await page.click('button[type="submit"]');
  29  |   // Wait for redirect away from /login
  30  |   await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10000 });
  31  | }
  32  | 
  33  | // ─── Helper: register a new account (bypasses OTP via dev-login after register) ──
  34  | async function ensureUserExists(page, creds, role) {
  35  |   // Try to log in first; if it fails, we register.
  36  |   const resp = await page.request.post('http://localhost:5000/api/auth/dev-login', {
  37  |     data: { email: creds.email },
  38  |   });
  39  |   if (resp.ok()) return; // user exists
  40  | 
  41  |   // User doesn't exist — fall back to API-level register + OTP verification would be needed.
  42  |   // For CI simplicity, we call the register endpoint and skip OTP (not feasible in headless without email).
  43  |   // Signal that setup is incomplete.
  44  |   console.warn(`WARNING: User ${creds.email} not found in DB. Create it manually or via /dev-login.`);
  45  | }
  46  | 
  47  | // ═════════════════════════════════════════════════════════════════════════════
  48  | // SUITE 1 — Navigation & Page Load
  49  | // ═════════════════════════════════════════════════════════════════════════════
  50  | 
  51  | test.describe('1. Navigation & Page Load', () => {
  52  |   test('1.1 HomePage loads without crash', async ({ page }) => {
  53  |     const response = await page.goto('/');
  54  |     expect(response?.status()).toBeLessThan(400);
  55  |     await expect(page.locator('body')).toBeVisible();
  56  |     // Should not show a blank white screen
  57  |     const bodyText = await page.textContent('body');
  58  |     expect(bodyText?.length).toBeGreaterThan(20);
  59  |   });
  60  | 
  61  |   test('1.2 /login page loads and has email + password fields', async ({ page }) => {
  62  |     await page.goto('/login');
  63  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  64  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  65  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  66  |   });
  67  | 
  68  |   test('1.3 /register page loads with role selector', async ({ page }) => {
  69  |     await page.goto('/register');
  70  |     await expect(page.locator('text=Student')).toBeVisible();
  71  |     await expect(page.locator('text=Instructor')).toBeVisible();
  72  |   });
  73  | 
  74  |   test('1.4 /forgot-password page loads', async ({ page }) => {
  75  |     await page.goto('/forgot-password');
  76  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  77  |   });
  78  | 
  79  |   test('1.5 /reset-password without token shows error state', async ({ page }) => {
> 80  |     await page.goto('/reset-password');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/reset-password
  81  |     // Should show "Invalid Reset Link" state, not a blank page
  82  |     await expect(page.locator('text=Invalid Reset Link')).toBeVisible();
  83  |   });
  84  | 
  85  |   test('1.6 Unknown routes redirect to home', async ({ page }) => {
  86  |     await page.goto('/this-route-does-not-exist-xyz');
  87  |     // Should redirect to / (wildcard route in App.jsx)
  88  |     await expect(page).toHaveURL('/');
  89  |   });
  90  | 
  91  |   test('1.7 /session/* not accessible without login', async ({ page }) => {
  92  |     await page.goto('/session/999');
  93  |     await expect(page).toHaveURL('/login');
  94  |   });
  95  | });
  96  | 
  97  | // ═════════════════════════════════════════════════════════════════════════════
  98  | // SUITE 2 — Auth: Login Validation
  99  | // ═════════════════════════════════════════════════════════════════════════════
  100 | 
  101 | test.describe('2. Authentication — Login Validation', () => {
  102 |   test('2.1 Submit empty form shows field errors', async ({ page }) => {
  103 |     await page.goto('/login');
  104 |     await page.click('button[type="submit"]');
  105 |     await expect(page.locator('text=Email address is required')).toBeVisible();
  106 |     await expect(page.locator('text=Password is required')).toBeVisible();
  107 |   });
  108 | 
  109 |   test('2.2 Invalid email format shows error', async ({ page }) => {
  110 |     await page.goto('/login');
  111 |     await page.fill('input[type="email"]', 'notanemail');
  112 |     await page.fill('input[type="password"]', 'anything');
  113 |     await page.click('button[type="submit"]');
  114 |     await expect(page.locator('text=valid email address')).toBeVisible();
  115 |   });
  116 | 
  117 |   test('2.3 Wrong credentials show toast error', async ({ page }) => {
  118 |     await page.goto('/login');
  119 |     await page.fill('input[type="email"]', 'nonexistent@example.com');
  120 |     await page.fill('input[type="password"]', 'WrongPass1!');
  121 |     await page.click('button[type="submit"]');
  122 |     // Expect an error toast or inline error
  123 |     await page.waitForSelector('[data-testid="toast"], .react-hot-toast, text=not found, text=Invalid credentials, text=Login failed', { timeout: 8000 }).catch(() => {});
  124 |     // Still on login page
  125 |     await expect(page).toHaveURL('/login');
  126 |   });
  127 | 
  128 |   test('2.4 Password toggle works', async ({ page }) => {
  129 |     await page.goto('/login');
  130 |     const passwordInput = page.locator('input[type="password"]');
  131 |     await expect(passwordInput).toBeVisible();
  132 |     // Click toggle button (the eye icon)
  133 |     const toggle = page.locator('button[type="button"]').last();
  134 |     await toggle.click();
  135 |     // Input type should switch to text
  136 |     await expect(page.locator('input[type="text"]').last()).toBeVisible();
  137 |   });
  138 | 
  139 |   test('2.5 Successful login with admin credentials', async ({ page }) => {
  140 |     await loginAs(page, ADMIN);
  141 |     // Should land on /admin
  142 |     await expect(page).toHaveURL('/admin');
  143 |   });
  144 | });
  145 | 
  146 | // ═════════════════════════════════════════════════════════════════════════════
  147 | // SUITE 3 — Auth: Registration Flow Validation
  148 | // ═════════════════════════════════════════════════════════════════════════════
  149 | 
  150 | test.describe('3. Registration — Form Validation', () => {
  151 |   test('3.1 Step 1: requires role selection', async ({ page }) => {
  152 |     await page.goto('/register');
  153 |     await page.click('button:has-text("Continue")');
  154 |     await expect(page.locator('text=Please select an account type')).toBeVisible();
  155 |   });
  156 | 
  157 |   test('3.2 Step 1: requires first and last name', async ({ page }) => {
  158 |     await page.goto('/register');
  159 |     await page.click('button:has-text("Student")');
  160 |     await page.click('button:has-text("Continue")');
  161 |     await expect(page.locator('text=First name is required')).toBeVisible();
  162 |     await expect(page.locator('text=Last name is required')).toBeVisible();
  163 |   });
  164 | 
  165 |   test('3.3 Step 2: shows password strength indicator', async ({ page }) => {
  166 |     await page.goto('/register');
  167 |     // Complete step 1
  168 |     await page.click('button:has-text("Student")');
  169 |     await page.fill('input[placeholder="Jane"]', 'Test');
  170 |     await page.fill('input[placeholder="Doe"]', 'User');
  171 |     await page.click('button:has-text("Continue")');
  172 |     // Now on step 2 - check password strength bars appear
  173 |     const passwordInput = page.locator('input[type="password"]').first();
  174 |     await passwordInput.fill('weak');
  175 |     // Strength bars exist
  176 |     await expect(page.locator('.rounded-full').first()).toBeVisible();
  177 |   });
  178 | 
  179 |   test('3.4 Cannot advance step 2 without valid password', async ({ page }) => {
  180 |     await page.goto('/register');
```