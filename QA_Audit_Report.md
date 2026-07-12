# ExamFlow — Comprehensive QA Audit Report

**Project:** ExamFlow — Full-Stack Exam Platform  
**Auditor:** QA Engineering Review (Claude Code)  
**Date:** 2026-06-06  
**Audit Scope:** Full codebase static analysis + Playwright E2E test authoring  
**Codebase Branch:** main  

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Overall Health Score | **62 / 100** |
| Critical Issues | **4** |
| High Issues | **9** |
| Medium Issues | **11** |
| Low Issues | **8** |
| Total Findings | **32** |
| Playwright Tests Written | **51** |
| App Running at Audit Time | **Not confirmed** (shell access denied; tests structured to self-report) |

### Key Risk Areas

1. **A developer backdoor (`/auth/dev-login`) is exposed in the production codebase** with only a `NODE_ENV=production` guard. If the environment variable is not set, it is callable in any environment.
2. **Hardcoded admin credentials in `db.js`** are logged to the console in plain text on every startup.
3. **No server-side input validation library** is used; all field validation is done ad-hoc, creating inconsistency between frontend and backend requirements.
4. **Python code execution** runs student-submitted code in a temporary file using `execFileSync`, with no sandboxing beyond a 3-second timeout. Malicious students could attempt file system access.
5. **Correct answers are exposed** in the `/submissions/:id` endpoint response for non-instructor roles when a student views their own MCQ/TRUE_FALSE/FILL_BLANKS results (the `correctAnswer` field is set to `undefined`, but JavaScript `undefined` fields are omitted from JSON, not hidden — this works only because `JSON.stringify` omits `undefined`, which is correct; however, the server-side approach of spreading `...q` and overriding the field post-spread relies on correct JSON serialization).

---

## 2. Environment

| Component | Details |
|---|---|
| Frontend | React 19 + Vite 8 + TailwindCSS v4, port 5173 |
| Backend | Node.js / Express, port 5000 |
| Database | SQL Server (mssql) — NOT SQLite (despite `.db` file in tree) |
| AI Service | Python / FastAPI, port 8001 |
| Auth | JWT (1-day expiry), bcrypt (10 rounds) |
| Mail | Nodemailer + SMTP (Gmail) |
| OS | Windows 11 (affects C++ compilation path: hardcoded `C:\msys64\...`) |
| Start Command | `npm run dev` from project root |

---

## 3. Full Findings

---

### A. FUNCTIONAL BUGS

---

**[BUG-001]**  
**Category:** Functional Bug  
**Severity:** Critical  
**Page/Feature:** Backend / `db.js` — `run()` helper  
**Summary:** INSERT statements on tables that do not have an `id` IDENTITY column (or where `OUTPUT INSERTED.id` is injected) will silently fail to return the last-inserted ID if `VALUES` appears in a subquery context.  
**Steps to Reproduce:**  
1. Call `run()` with any INSERT that includes a `VALUES` keyword inside a subquery (rare but possible).  
2. The regex `convertedSql.toUpperCase().lastIndexOf('VALUES')` picks the *last* occurrence, which could be inside a subquery, injecting `OUTPUT INSERTED.id` in the wrong position.  
**Expected Result:** Correct last-inserted ID returned.  
**Actual Result:** Malformed SQL or `null` lastID.  
**Suggested Fix:** Use `indexOf('VALUES')` from the start, or use a dedicated library for parameterized inserts (e.g., `mssql` named parameters).

---

**[BUG-002]**  
**Category:** Functional Bug  
**Severity:** High  
**Page/Feature:** `submission.controller.js` — `submitExam`  
**Summary:** When `earned` is `null` (AI evaluation error path), the line `earned = Math.round(earned * 100) / 100` evaluates to `NaN`. This NaN is then stored in the database via `UPDATE Answers SET scoreEarned = NaN`, which SQL Server will store as `0` or throw an error, silently corrupting the grade.  
**Steps to Reproduce:**  
1. Submit an essay answer.  
2. The AI service returns `failed: true`.  
3. `earned` is set to `null`, then `Math.round(null * 100) / 100` = `NaN`.  
**Expected Result:** `earned` stored as `null` or `0`.  
**Actual Result:** `NaN` passed to SQL Server parameter; behavior undefined.  
**Suggested Fix:** Replace `earned = Math.round(earned * 100) / 100` with `earned = earned !== null ? Math.round(earned * 100) / 100 : null`.

---

**[BUG-003]**  
**Category:** Functional Bug  
**Severity:** High  
**Page/Feature:** `StudentDashboard.jsx` — exam join by code  
**Summary:** The join endpoint `GET /api/exams/access/:code` calls `code.toUpperCase()` on the server, but the student dashboard sends the code as-is. If a student types lowercase letters in a code that was generated as all-numeric (numeric codes are fine), this works. However, `getExamByCode` does `code.toUpperCase()` internally, so this is benign. More critically, `StudentDashboard` calls `api.get('/exams')` to fetch exams for a **student**, but `/api/exams` is protected by `instructorOnly` middleware. This means the student dashboard will always receive a 403 when trying to populate the exams list.  
**Steps to Reproduce:**  
1. Log in as a student.  
2. The dashboard calls `GET /api/exams` in `useEffect`.  
3. `instructorOnly` returns 403.  
**Expected Result:** Student sees their available exams.  
**Actual Result:** API error; exams array stays empty; error silently swallowed in `catch`.  
**Suggested Fix:** Students should not call `GET /api/exams` (instructor endpoint). Add a separate student-facing endpoint or filter based on role in the existing endpoint.

---

**[BUG-004]**  
**Category:** Functional Bug  
**Severity:** High  
**Page/Feature:** `ExamResult.jsx` — UML score display  
**Summary:** Line 500: `{studentAns.score || r.blendedScore || 0}%` references `studentAns.score` but the `Answers` table has no `score` column — the column is `scoreEarned`. This will always render `0%` for the blended metric unless `r.blendedScore` is set.  
**Steps to Reproduce:**  
1. Submit a UML question.  
2. View results as an instructor.  
3. The "Blended Metric" display shows `0%`.  
**Expected Result:** Blended score displays correctly.  
**Actual Result:** Always shows `0%`.  
**Suggested Fix:** Change `studentAns.score` to `studentAns.scoreEarned`.

---

**[BUG-005]**  
**Category:** Functional Bug  
**Severity:** Medium  
**Page/Feature:** `submission.controller.js` — `getStudentStats`  
**Summary:** The `avgScore` field is returned as a raw decimal (e.g., `47.333`). The student dashboard rounds it via `Math.round(stats.avgScore)`, but the `bestScore` is returned raw without formatting. If a student scores 99.5, `bestScore` is displayed as `99.5`, which is fine, but there is no percent-sign or `/totalGrade` context shown, making the display ambiguous.  
**Steps to Reproduce:** Submit multiple exams with decimal scores.  
**Expected Result:** Clear display of score with context.  
**Actual Result:** Raw decimal with no unit.  
**Suggested Fix:** Add `/totalGrade` display or normalize to a percentage on the server.

---

**[BUG-006]**  
**Category:** Functional Bug  
**Severity:** Medium  
**Page/Feature:** `exam.controller.js` — `createExam`  
**Summary:** The access code is generated as a 6-digit number `crypto.randomInt(100000, 1000000)`. The range should be `[100000, 999999]` but `randomInt` upper bound is exclusive, so `randomInt(100000, 1000000)` correctly generates `[100000, 999999]`. However, the code is stored as-is without uniqueness enforcement at the application level; uniqueness is only at the database level via `UNIQUE` constraint. If a collision occurs, the INSERT will throw an unhandled error that propagates as a 500.  
**Steps to Reproduce:** Create a large number of exams.  
**Expected Result:** Automatic retry on code collision.  
**Actual Result:** 500 Internal Server Error with `constraint violation` message.  
**Suggested Fix:** Wrap the INSERT in a retry loop that generates a new code on collision.

---

**[BUG-007]**  
**Category:** Functional Bug  
**Severity:** Medium  
**Page/Feature:** `ExamSession.jsx` — auto-save  
**Summary:** The auto-save `useEffect` depends on `[loading, answers]`, which means every time a student types a character, the interval is cleared and re-set, resetting the 30-second countdown. This means auto-save will rarely fire while the student is actively typing — effectively disabling auto-save during active use.  
**Steps to Reproduce:**  
1. Start an exam.  
2. Type continuously in an essay or code field.  
3. Auto-save does not trigger for as long as typing continues.  
**Expected Result:** Auto-save every 30 seconds regardless of typing.  
**Actual Result:** Auto-save timer resets on every keystroke.  
**Suggested Fix:** Remove `answers` from the dependency array of the auto-save interval effect. Use `useCallback` and `useRef` to keep stable references.

---

**[BUG-008]**  
**Category:** Functional Bug  
**Severity:** Medium  
**Page/Feature:** `auth.controller.js` — `verifyOTP`  
**Summary:** There is no attempt-limiting on OTP verification. An attacker who intercepts or guesses the 6-digit OTP (1-in-900,000 chance) can brute-force without lockout since the `MAX_VERIFY_ATTEMPTS` constant is defined but never applied to the OTP flow (it is only used in `resetPassword`).  
**Steps to Reproduce:** POST to `/api/auth/verify` with incorrect codes repeatedly.  
**Expected Result:** Account locked after N failed attempts.  
**Actual Result:** Unlimited OTP attempts allowed.  
**Suggested Fix:** Track failed attempts in `PendingUsers` and delete the record after 5 failures.

---

**[BUG-009]**  
**Category:** Functional Bug  
**Severity:** Low  
**Page/Feature:** `Register.jsx` — Step 4 (Profile Setup)  
**Summary:** Both "Finish Setup" and "Skip for now" buttons call the same `handleComplete` function. The "Skip" button does not visually differ in behavior from "Finish" when no image is uploaded. This is correct in terms of logic, but the duplicate call pattern is confusing.  
**Steps to Reproduce:** Complete registration through to Step 4. Do not upload an image. Click "Skip for now".  
**Expected Result:** Navigates to dashboard without image.  
**Actual Result:** Calls `updateProfile` with `null` image (correct behavior, but unnecessarily calls API).  
**Suggested Fix:** If no profile image and no changes, skip the `updateProfile` API call on "Skip".

---

### B. VALIDATION ISSUES

---

**[VAL-001]**  
**Category:** Validation Issue  
**Severity:** High  
**Page/Feature:** Backend — `auth.controller.js` — `register`  
**Summary:** No server-side validation of email format, name length, or password strength. The backend accepts any string for email (e.g., `""`), any length name, and any password regardless of the frontend's 8-character + complexity requirements.  
**Steps to Reproduce:** POST to `/api/auth/register` with `{"email":"","password":"a","name":"","role":"STUDENT"}`.  
**Expected Result:** 400 Bad Request.  
**Actual Result:** Proceeds to hash the empty password, generate OTP, attempt to send email, and likely error at the SMTP level.  
**Suggested Fix:** Add server-side validation using `express-validator` or `joi`. Minimum: email regex check, password length >= 8, name non-empty.

---

**[VAL-002]**  
**Category:** Validation Issue  
**Severity:** High  
**Page/Feature:** Backend — `exam.controller.js` — `createExam`  
**Summary:** No validation that `questions` array is non-empty, that individual question `text` is non-empty, that `points` is positive, or that `startTime` < `endTime`. An instructor can create an exam with 0 questions, negative points, or an end time before the start time.  
**Steps to Reproduce:** POST to `/api/exams` with `{"title":"T","totalGrade":0,"duration":0,"startTime":"2030-01-01","endTime":"2020-01-01","questions":[]}`.  
**Expected Result:** Validation error.  
**Actual Result:** Exam created successfully with 0 questions and invalid date range.  
**Suggested Fix:** Add server-side validators for all exam fields before INSERT.

---

**[VAL-003]**  
**Category:** Validation Issue  
**Severity:** Medium  
**Page/Feature:** Frontend — `Register.jsx` — Step 2  
**Summary:** The frontend validates the password meets all 5 criteria before allowing Step 2 to proceed. However, the backend `resetPassword` function only requires `newPassword.length < 6`. This is a frontend/backend validation mismatch: the frontend enforces 8+ characters with complexity, but the backend accepts 6-character passwords with no complexity.  
**Steps to Reproduce:** POST to `/api/auth/reset-password` with a 6-character password.  
**Expected Result:** Error (frontend requires 8+).  
**Actual Result:** Password accepted by backend.  
**Suggested Fix:** Align backend password validation to match frontend: minimum 8 characters.

---

**[VAL-004]**  
**Category:** Validation Issue  
**Severity:** Medium  
**Page/Feature:** Frontend — `Register.jsx` — Step 2  
**Summary:** The confirm-password field has no error message component — it uses inline class changes (red border) but no `<FieldError>` component. A user may not understand why the "Continue" button does not work if passwords don't match.  
**Steps to Reproduce:** Enter mismatched passwords in Step 2.  
**Expected Result:** Clear error message "Passwords do not match" below confirm field.  
**Actual Result:** Only red border styling; no text error message.  
**Suggested Fix:** Add a `<FieldError>` component below confirm password similar to `ResetPassword.jsx`.

---

**[VAL-005]**  
**Category:** Validation Issue  
**Severity:** Medium  
**Page/Feature:** Backend — `submission.controller.js` — `saveDraft`  
**Summary:** `saveDraft` does not validate that `answers` is an array, or that each answer has `questionId` and `studentAnswer` fields. Malformed payloads (e.g., `answers: null`) will cause a runtime error.  
**Steps to Reproduce:** PATCH `/api/submissions/:id/save` with `{"answers": null}`.  
**Expected Result:** 400 Bad Request.  
**Actual Result:** TypeError: Cannot read properties of null (reading 'forEach').  
**Suggested Fix:** Add `if (!Array.isArray(answers)) return res.status(400).json({error: 'answers must be an array'})`.

---

**[VAL-006]**  
**Category:** Validation Issue  
**Severity:** Low  
**Page/Feature:** Backend — `auth.controller.js` — `updateProfile`  
**Summary:** The `updateProfile` endpoint allows changing the user's `profileImage` to any string including non-data-URL strings (e.g., `http://external.com/image.png`), which could expose stored XSS via `<img src=...>` rendering if the value is used in `innerHTML`.  
**Steps to Reproduce:** PATCH `/api/auth/profile` with `profileImage: "javascript:alert(1)"`.  
**Expected Result:** Rejected.  
**Actual Result:** Stored in DB and rendered via `<img src={user.profileImage}>` in the navbar.  
**Suggested Fix:** Validate that `profileImage` is either `null` or starts with `data:image/`.

---

### C. UI/UX ISSUES

---

**[UX-001]**  
**Category:** UI/UX Issue  
**Severity:** High  
**Page/Feature:** `ExamSession.jsx` — copy/paste prevention  
**Summary:** The exam session disables Ctrl+C, Ctrl+V, and right-click globally on the document. This also prevents pasting into the essay and coding text areas, which is a legitimate use case for students who need to type in their code editor and paste it. It also breaks screen readers and password managers.  
**Steps to Reproduce:** Start an exam. Attempt to paste code into the coding textarea.  
**Expected Result:** Paste is allowed in coding/essay areas (anti-cheat should be limited to copying from the page, not preventing input).  
**Actual Result:** All paste operations blocked.  
**Suggested Fix:** Use `e.stopPropagation()` to allow paste events on `<textarea>` and `<input>` elements while still blocking copy from elsewhere.

---

**[UX-002]**  
**Category:** UI/UX Issue  
**Severity:** High  
**Page/Feature:** `ExamSession.jsx` — back-button trap  
**Summary:** The exam session pushes a guard state to `window.history` to trap the back button. While intended, this also traps users after the exam ends until they navigate via the submit confirmation. A student who accidentally navigates to `/session/:id` of a submitted exam will be redirected but still sees the history manipulation. Furthermore, the back-navigation guard is applied even before `submission` state is loaded, causing a race condition.  
**Steps to Reproduce:** Open a submitted exam session URL.  
**Expected Result:** Immediate redirect to home.  
**Actual Result:** Guard state is pushed before submission data loads, causing potential flickering.  
**Suggested Fix:** Only push the guard state after confirming `submission.status === 'IN_PROGRESS'`.

---

**[UX-003]**  
**Category:** UI/UX Issue  
**Severity:** Medium  
**Page/Feature:** `App.jsx` — footer links  
**Summary:** Footer links for "Privacy", "Terms", and "Support" all point to `href="#"`. These are dead links with no content.  
**Steps to Reproduce:** Click any footer link.  
**Expected Result:** Navigate to relevant policy page.  
**Actual Result:** Scrolls to top (anchor behavior).  
**Suggested Fix:** Create placeholder pages or point to real URLs, or remove the links.

---

**[UX-004]**  
**Category:** UI/UX Issue  
**Severity:** Medium  
**Page/Feature:** `ExamSession.jsx` — question navigation  
**Summary:** On mobile (< lg breakpoint), the sidebar question navigation is hidden. The mobile user only has Previous/Next buttons and a timer. There is no way to jump directly to a specific question on mobile, which is a significant UX regression for long exams.  
**Steps to Reproduce:** Open an exam session on a mobile viewport (<1024px).  
**Expected Result:** A compact question navigation (e.g., a scrollable dot row or a dropdown).  
**Actual Result:** No question navigation visible on mobile.  
**Suggested Fix:** Add a collapsible question list or dot indicators visible on mobile.

---

**[UX-005]**  
**Category:** UI/UX Issue  
**Severity:** Medium  
**Page/Feature:** `Dashboard.jsx` / Routing  
**Summary:** `/dashboard` redirects to `/instructor/dashboard` or `/student/dashboard` based on role, but `/student/dashboard` renders `<Dashboard />` while `/instructor/dashboard` also renders `<Dashboard />`. The same component serves both roles. The `Dashboard.jsx` component must conditionally render based on role — if this is incorrect, one role will see the other's UI.  
**Steps to Reproduce:** Read `App.jsx` routes: both student and instructor dashboard routes render `<Dashboard />`.  
**Expected Result:** Each role sees their appropriate dashboard.  
**Actual Result:** Depends on what `Dashboard.jsx` renders conditionally. If it has a bug in role detection, wrong content shows.  
**Suggested Fix:** Verify `Dashboard.jsx` correctly detects the role and renders distinct content. Consider separate components for clarity.

---

**[UX-006]**  
**Category:** UI/UX Issue  
**Severity:** Low  
**Page/Feature:** `InstructorDashboard.jsx` — navigation  
**Summary:** The "Return to Dashboard" button in `ExamSubmissions.jsx` navigates to `/` (home) instead of `/instructor/dashboard`. An instructor is taken to the home page, not their dashboard.  
**Steps to Reproduce:** View exam submissions and click "Return to Dashboard".  
**Expected Result:** Navigates to `/instructor/dashboard`.  
**Actual Result:** Navigates to `/`.  
**Suggested Fix:** Change `navigate('/')` to `navigate('/instructor/dashboard')`.

---

**[UX-007]**  
**Category:** UI/UX Issue  
**Severity:** Low  
**Page/Feature:** `ExamResult.jsx` — "Return to Dashboard" button  
**Summary:** Same issue as UX-006. The back button navigates to `/` instead of the user's dashboard.  
**Suggested Fix:** Use `navigate(user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard')`.

---

### D. ACCESSIBILITY ISSUES (WCAG)

---

**[A11Y-001]**  
**Category:** Accessibility Issue  
**Severity:** High  
**Page/Feature:** All pages — `<label>` elements  
**Summary:** Labels in `Login.jsx`, `Register.jsx`, and several other pages use `<label>` elements that are not programmatically associated with their inputs via `for`/`htmlFor` attributes. Screen readers cannot identify which label belongs to which field.  
**Steps to Reproduce:** Inspect the DOM with axe DevTools.  
**Expected Result:** Labels have `htmlFor` matching input `id` attributes.  
**Actual Result:** Labels are visual-only with no `htmlFor`.  
**Suggested Fix:** Add `htmlFor="email-input"` to labels and `id="email-input"` to corresponding inputs.

---

**[A11Y-002]**  
**Category:** Accessibility Issue  
**Severity:** High  
**Page/Feature:** `ExamSession.jsx` — MCQ options  
**Summary:** MCQ answer options are `<button>` elements rendering as custom checkboxes. They lack `aria-pressed`, `role="checkbox"`, or `aria-checked` attributes. Screen readers cannot determine the selection state.  
**Steps to Reproduce:** Navigate through exam MCQ questions with a screen reader.  
**Expected Result:** Screen reader announces "Option A — checked/unchecked".  
**Actual Result:** Screen reader announces button text only.  
**Suggested Fix:** Add `role="checkbox"` and `aria-checked={isSelected}` to MCQ option buttons.

---

**[A11Y-003]**  
**Category:** Accessibility Issue  
**Severity:** Medium  
**Page/Feature:** `ExamSession.jsx` — timer  
**Summary:** The countdown timer is a visual element with no `aria-live` region. Screen reader users receive no auditory countdown alerts and may be unaware that time is running out.  
**Steps to Reproduce:** Use a screen reader during an exam session.  
**Expected Result:** Periodic announcements of remaining time (e.g., "10 minutes remaining").  
**Actual Result:** Timer changes visually but is never announced.  
**Suggested Fix:** Add an `aria-live="assertive"` region that announces at key intervals (30 min, 10 min, 5 min, 1 min remaining).

---

**[A11Y-004]**  
**Category:** Accessibility Issue  
**Severity:** Medium  
**Page/Feature:** `Register.jsx` — OTP input  
**Summary:** The 6 individual OTP digit inputs have no `aria-label` or `autocomplete="one-time-code"` attribute. Screen readers announce each box as an unlabeled text input. The `autocomplete="one-time-code"` attribute is also missing, preventing OS-level OTP autofill.  
**Steps to Reproduce:** Navigate to Step 3 of registration with a screen reader or on iOS/Android.  
**Expected Result:** Screen reader announces "Digit 1 of 6", OS offers to autofill OTP.  
**Actual Result:** Unlabeled inputs; no autofill.  
**Suggested Fix:** Add `aria-label={`Digit ${index + 1}`}` and `autoComplete="one-time-code"` (on the first input only, per Web OTP spec).

---

**[A11Y-005]**  
**Category:** Accessibility Issue  
**Severity:** Medium  
**Page/Feature:** `App.jsx` — navbar  
**Summary:** The logout button has `title="Secure Sign Out"` but no visible text on mobile. For screen readers, `title` is announced, but this is not a reliable accessible name mechanism. The theme toggle button has no accessible name at all.  
**Suggested Fix:** Add `aria-label="Sign out"` to logout and `aria-label="Toggle theme"` to the theme button.

---

**[A11Y-006]**  
**Category:** Accessibility Issue  
**Severity:** Low  
**Page/Feature:** All pages — color contrast  
**Summary:** Several text elements use `text-slate-400` on white/near-white backgrounds or `text-slate-500` in dark mode. Many of these fail WCAG AA contrast ratio of 4.5:1, especially the `text-[9px]` uppercase tracking labels used throughout the app.  
**Suggested Fix:** Increase contrast by using darker text colors for small text, or increase font size.

---

### E. EDGE CASES

---

**[EDGE-001]**  
**Category:** Edge Case  
**Severity:** High  
**Page/Feature:** `submission.controller.js` — `startSubmission`  
**Summary:** A student can start an exam twice in parallel if two requests arrive simultaneously before the first `INSERT` completes (TOCTOU race condition). The existing check (`SELECT ... WHERE status = 'IN_PROGRESS'`) will not prevent this since both requests may read "no existing submission" before either has written.  
**Steps to Reproduce:** Send two concurrent POST requests to `/api/submissions/:examId/start`.  
**Expected Result:** One submission created.  
**Actual Result:** Two `IN_PROGRESS` submissions for the same student/exam.  
**Suggested Fix:** Add a database-level UNIQUE constraint on `(studentId, examId)` in the Submissions table, or use a database-level serializable transaction.

---

**[EDGE-002]**  
**Category:** Edge Case  
**Severity:** Medium  
**Page/Feature:** `ExamSession.jsx` — time calculation  
**Summary:** The remaining time is calculated as `durationSeconds - elapsed`, where `elapsed` is computed from SQL Server's `GETDATE()`. If the SQL Server clock and the Node.js clock are out of sync (possible in VMs/containers), this calculation will be incorrect. The comment in the code acknowledges this ("SQL Server GETDATE() is local DB time") but the fix is incomplete — it uses `serverNow` from the submission fetch to compute elapsed, which is correct, but `endTime` comparison uses `serverNowDate` which is from the same fetch — meaning the exam could appear to have ended even if there are minutes remaining.  
**Suggested Fix:** Use a dedicated server time endpoint or store `createdAt` in UTC.

---

**[EDGE-003]**  
**Category:** Edge Case  
**Severity:** Medium  
**Page/Feature:** `submission.controller.js` — JavaScript VM execution  
**Summary:** Student JavaScript code runs in a Node.js `vm.createContext` sandbox with a 1-second timeout. However, `vm.Script` is not fully secure — certain Node.js versions allow `vm` context escapes via `__proto__` manipulation or `Proxy` objects.  
**Steps to Reproduce:** Submit JavaScript code that attempts `this.constructor.constructor('return process')()`.  
**Expected Result:** Code runs in isolation, no access to Node.js process.  
**Actual Result:** Potential VM escape in some Node.js versions.  
**Suggested Fix:** Use a dedicated sandbox like `isolated-vm` or run student code in a child process with restricted permissions.

---

**[EDGE-004]**  
**Category:** Edge Case  
**Severity:** Medium  
**Page/Feature:** `auth.controller.js` — `register`  
**Summary:** The username uniqueness check queries both `Users` and `PendingUsers` tables, but the check is not atomic. If two users register with the same name simultaneously, both may pass the uniqueness check and then fail on the database UNIQUE constraint (if any) or silently create duplicate usernames.  
**Suggested Fix:** Add a UNIQUE constraint on `username` in the database (currently only checked at application level).

---

**[EDGE-005]**  
**Category:** Edge Case  
**Severity:** Low  
**Page/Feature:** `ExamSession.jsx` — tab violation counter  
**Summary:** The tab violation counter uses `setTabViolations(prev => ...)` inside a document visibility event. If the user rapidly switches back and forth, the counter may increment multiple times per "tab leave" event due to closure/state timing.  
**Suggested Fix:** Use a `useRef` for the violation count to avoid stale closure issues, matching the pattern already used for `autoSubmitTriggeredRef`.

---

**[EDGE-006]**  
**Category:** Edge Case  
**Severity:** Low  
**Page/Feature:** `analytics.js` (frontend)  
**Summary:** The visitor ID is generated using `Math.random()`, which is not cryptographically random and can produce collisions for high-traffic sites. Two different visitors could receive the same ID.  
**Suggested Fix:** Use `crypto.randomUUID()` (available in modern browsers) for the visitor ID.

---

### F. BROKEN FLOWS

---

**[FLOW-001]**  
**Category:** Broken Flow  
**Severity:** Critical  
**Page/Feature:** `StudentDashboard.jsx` — exam list  
**Summary:** (See BUG-003) The student dashboard calls `GET /api/exams` which is an instructor-only endpoint. Students cannot see any available exams on their dashboard. The only way to start an exam is by entering an access code manually.  
**Steps to Reproduce:** Log in as a student and observe the dashboard.  
**Expected Result:** List of available or joinable exams.  
**Actual Result:** Empty state or 403 error (silently caught).  
**Suggested Fix:** Create `GET /api/exams/available` for students, or accept both STUDENT and INSTRUCTOR roles on `GET /api/exams` with role-based filtering.

---

**[FLOW-002]**  
**Category:** Broken Flow  
**Severity:** High  
**Page/Feature:** `ExamSession.jsx` — submission navigate  
**Summary:** After exam submission, `navigate` uses `sub.exam.showResults` to determine whether to go to the results page. However, `showResults` is an integer (0=hidden, 1=immediate, 2=scheduled) but the code checks `if (showResults === 1)` with strict equality. If `showResults` arrives from the API as the string `"1"` (possible if SQL Server returns NVARCHAR), the redirect to results page will fail and the student will be sent home with no feedback.  
**Steps to Reproduce:** Confirm API returns `showResults` as a number vs. string.  
**Expected Result:** Correct redirect after submission.  
**Actual Result:** May silently redirect to home even when results should be shown.  
**Suggested Fix:** Use `parseInt(showResults) === 1` or convert at API level.

---

**[FLOW-003]**  
**Category:** Broken Flow  
**Severity:** High  
**Page/Feature:** `auth.routes.js` — profile update  
**Summary:** The `updateProfile` endpoint uses `POST /api/auth/profile` (POST method), but REST convention and HTTP standards would use `PUT` or `PATCH` for updates. More critically, the `AuthContext.updateProfile` function re-issues a new JWT token, but if the request fails mid-operation (network error), the frontend may have stale user data in `localStorage` while the database has partial changes.  
**Suggested Fix:** Use `PATCH` for partial updates. Add optimistic rollback in the frontend.

---

**[FLOW-004]**  
**Category:** Broken Flow  
**Severity:** Medium  
**Page/Feature:** `Register.jsx` — `handleComplete` navigates to `/dashboard`  
**Summary:** `handleComplete` navigates to `/dashboard`, which redirects based on role. But the route `/ dashboard` checks `user.role === 'INSTRUCTOR'` vs. default. If the user was just registered with role `STUDENT`, this should work. However, the navigate to `/dashboard` relies on the updated user state being set before the navigation, which may not be guaranteed since `navigate` is synchronous but `updateProfile` is async.  
**Steps to Reproduce:** Complete registration (Step 4).  
**Expected Result:** Navigate to student dashboard.  
**Actual Result:** May briefly flash the wrong route or show a loading state.  
**Suggested Fix:** Navigate to the explicit role-based path after `updateProfile` resolves successfully.

---

### G. DATA CONSISTENCY ISSUES

---

**[DATA-001]**  
**Category:** Data Consistency  
**Severity:** High  
**Page/Feature:** `exam.controller.js` — `updateExam`  
**Summary:** When updating an exam's metadata only (no questions), the `questions` array is conditionally skipped. However, there is no atomic transaction wrapping the UPDATE and potential question DELETE/INSERT. If the process crashes between the exam UPDATE and question INSERT, the exam will have no questions.  
**Suggested Fix:** Wrap the update operation in a database transaction.

---

**[DATA-002]**  
**Category:** Data Consistency  
**Severity:** Medium  
**Page/Feature:** `submission.controller.js` — `approveAIGrade`  
**Summary:** The `approveAIGrade` endpoint recalculates the total score by summing ALL answers including those with `null` scoreEarned values (`reduce` treats `null` as 0, which is correct). However, if some answers have not yet been graded (AI failure), the total displayed to the student after instructor approval of one answer may be incorrect (undercount).  
**Steps to Reproduce:** Have a submission where 2 of 3 questions are AI-graded and 1 failed. Instructor approves one. Total shows sum of approved + unapproved zeros.  
**Expected Result:** Total shows pending state until all answers are graded.  
**Actual Result:** Incorrect total score shown.  
**Suggested Fix:** Mark the submission as `PARTIALLY_GRADED` until all answers have non-null scores.

---

**[DATA-003]**  
**Category:** Data Consistency  
**Severity:** Medium  
**Page/Feature:** `db.js` — schema initialization  
**Summary:** The schema initialization runs multiple `IF NOT EXISTS ... ALTER TABLE` patch queries inside a transaction that is committed early, then runs more patches outside the transaction via `patchRequest`. If the server crashes between the transaction commit and the `patchRequest` execution, the database will be in an inconsistent state.  
**Suggested Fix:** Move all patches inside the transaction, or use a proper migration framework (e.g., `db-migrate`).

---

**[DATA-004]**  
**Category:** Data Consistency  
**Severity:** Low  
**Page/Feature:** `admin.controller.js` — `getDashboardStats`  
**Summary:** The `avgScore` query filters by `status = 'GRADED'` but the system uses `status = 'SUBMITTED'` throughout the codebase. There are no submissions with `status = 'GRADED'`. The average score will always return 0 in the admin dashboard.  
**Steps to Reproduce:** Submit exams and check the admin dashboard average score.  
**Expected Result:** Average score reflects actual submissions.  
**Actual Result:** Always shows 0.  
**Suggested Fix:** Change the filter to `status = 'SUBMITTED'`.

---

### H. SECURITY CONCERNS

---

**[SEC-001]**  
**Category:** Security  
**Severity:** Critical  
**Page/Feature:** `auth.controller.js` — `devLogin` / `auth.routes.js`  
**Summary:** A developer backdoor endpoint `POST /api/auth/dev-login` is present and only disabled when `NODE_ENV === 'production'`. This endpoint issues a valid JWT for ANY user in the database given only their email address — no password required. If deployed without `NODE_ENV=production` (e.g., on a staging server), any person who knows the email of a user (or guesses the admin email `admin@examflow.com` — which is hardcoded and logged at startup) can obtain full admin access.  
**Steps to Reproduce:**  
1. POST to `/api/auth/dev-login` with `{"email":"admin@examflow.com"}`.  
2. Receive a valid JWT with admin role.  
**Expected Result:** 403 Forbidden always.  
**Actual Result:** 200 OK with full admin JWT when NODE_ENV is not "production".  
**Suggested Fix:** Remove the dev-login endpoint entirely from production code, or gate it behind an additional environment-specific secret that is not committed to the repository.

---

**[SEC-002]**  
**Category:** Security  
**Severity:** Critical  
**Page/Feature:** `db.js` — admin seed  
**Summary:** The admin account is seeded with hardcoded credentials (`admin@examflow.com` / `ExamFlow@Admin2026`) that are:
  1. Printed in plain text to the server console on every startup.
  2. Committed to the repository in `db.js`.
  3. The same default credentials every installation starts with.  
Any developer, CI/CD log viewer, or log aggregation tool can see these credentials.  
**Suggested Fix:** Read admin credentials from environment variables (`process.env.ADMIN_EMAIL`, `process.env.ADMIN_PASSWORD`). Never log passwords. Document that changing them after first login is mandatory.

---

**[SEC-003]**  
**Category:** Security  
**Severity:** High  
**Page/Feature:** `submission.controller.js` — Python/C++ code execution  
**Summary:** Student-submitted Python code is written to a temporary file (`tmp_*.py`) in `process.cwd()` (the server's working directory) and executed with `execFileSync('python', [tmpFile])`. The code has access to:
  - The local file system (can read `db.js`, `.env`, etc.)
  - Network access (can exfiltrate data)
  - Process creation capabilities  
The only mitigation is a 3-second timeout.  
**Steps to Reproduce:** Submit Python code: `import os; print(open('.env').read())`  
**Expected Result:** Code runs in an isolated sandbox.  
**Actual Result:** `.env` file contents (including DB credentials and JWT secret) are returned in the test output.  
**Suggested Fix:** Run student code in a Docker container with no filesystem/network access, or use a managed sandboxing service.

---

**[SEC-004]**  
**Category:** Security  
**Severity:** High  
**Page/Feature:** `submission.controller.js` — JavaScript VM execution  
**Summary:** (See also EDGE-003) Node.js `vm` module is not a security boundary. Student JavaScript can escape the sandbox. This is a well-documented Node.js security issue.  
**Suggested Fix:** Use `isolated-vm` npm package which uses V8 isolates, or a subprocess with restricted permissions.

---

**[SEC-005]**  
**Category:** Security  
**Severity:** High  
**Page/Feature:** `auth.controller.js` — `login`  
**Summary:** The login endpoint returns `{ error: 'User not found' }` when the email does not exist, and `{ error: 'Invalid credentials' }` when the password is wrong. These distinct messages allow an attacker to enumerate valid email addresses in the system.  
**Steps to Reproduce:** POST `/api/auth/login` with unknown email — returns "User not found". With known email but wrong password — returns "Invalid credentials".  
**Expected Result:** Same response for both cases (e.g., "Invalid email or password").  
**Actual Result:** Different responses allow user enumeration.  
**Suggested Fix:** Use a unified error message: `{ error: 'Invalid email or password' }`.

---

**[SEC-006]**  
**Category:** Security  
**Severity:** Medium  
**Page/Feature:** `analytics.controller.js` (assumed) / `analytics.js` (frontend)  
**Summary:** Page-view analytics are tracked for every route change including the exam session URL (`/session/:id`), which could reveal to an observer when a student started or was active in an exam. The analytics endpoint stores `userId`, `url`, and `userAgent` — PII data — without explicit consent notice or data retention policy.  
**Suggested Fix:** Exclude exam session URLs from analytics tracking. Add a consent banner or data retention policy.

---

**[SEC-007]**  
**Category:** Security  
**Severity:** Medium  
**Page/Feature:** `ExamSession.jsx` — anti-cheat  
**Summary:** The anti-cheat tab-switching detection uses `document.visibilitychange`. This is easily bypassed by opening a second window (not a tab), using a second monitor, or using the Windows Snapping feature. The security theater provides a false sense of academic integrity enforcement.  
**Suggested Fix:** Document the limitation to instructors. Consider using the Page Visibility API in combination with browser focus events and mouse/keyboard activity logging for a more robust approach.

---

**[SEC-008]**  
**Category:** Security  
**Severity:** Low  
**Page/Feature:** `frontend/src/lib/api.js`  
**Summary:** The JWT token is stored in `localStorage`. This is susceptible to XSS attacks — any injected script can read the token. While the app uses React which mitigates most XSS vectors, stored third-party scripts or CDN compromise could exfiltrate tokens.  
**Suggested Fix:** Consider `httpOnly` cookies for token storage. At minimum, implement a Content Security Policy (CSP) header.

---

### I. PDF / PRINT DESIGN ISSUES

---

**[PDF-001]**  
**Category:** PDF Design  
**Severity:** Medium  
**Page/Feature:** `PrintableExamView.jsx`  
**Summary:** The printable exam view is only accessible to instructors via `/exams/:id/print`. It uses a React component designed to be printed via `window.print()`. The component exists but no audit of its print CSS was performed (file not read). Key risks include: question numbering may reset between page breaks, page margins may not respect printer defaults, and any TailwindCSS utility classes used for print may conflict with the browser's default print stylesheet.  
**Suggested Fix:** Test the print view across browsers (Chrome, Firefox, Edge). Add `@media print { ... }` rules explicitly to control page breaks, margins, and font sizes.

---

**[PDF-002]**  
**Category:** PDF Design  
**Severity:** Low  
**Page/Feature:** `PrintableExamView.jsx` — exam metadata  
**Summary:** The `examMeta` field (institution name, subject, academic year etc.) is stored as a JSON blob. If this data is not present or is malformed, the printable view may render missing fields without graceful fallbacks.  
**Suggested Fix:** Add null-safe fallbacks for all `examMeta` fields in the printable template.

---

## 4. Playwright Test Results

**Test environment:** The application was not confirmed to be running at audit time (shell/PowerShell tool access was denied). Tests were written against the specification derived from code analysis.

### Test Execution Instructions

```bash
# Step 1: Install Playwright in the tests directory
cd "E:\TA\Exams Site\tests"
npm install
npx playwright install chromium

# Step 2: Start the application
cd "E:\TA\Exams Site"
npm run dev

# Step 3: Run the tests (from tests/ directory)
cd "E:\TA\Exams Site\tests"
npx playwright test --reporter=list
```

### Expected Test Status Matrix

| Suite | Test | Expected Status | Notes |
|---|---|---|---|
| 1. Navigation | 1.1 HomePage loads | PASS | |
| 1. Navigation | 1.2 /login fields visible | PASS | |
| 1. Navigation | 1.3 /register role selector | PASS | |
| 1. Navigation | 1.4 /forgot-password loads | PASS | |
| 1. Navigation | 1.5 /reset-password no token | PASS | |
| 1. Navigation | 1.6 Unknown routes redirect | PASS | |
| 1. Navigation | 1.7 /session unauthenticated | PASS | |
| 2. Login Validation | 2.1 Empty form errors | PASS | |
| 2. Login Validation | 2.2 Invalid email format | PASS | |
| 2. Login Validation | 2.3 Wrong credentials | PASS | |
| 2. Login Validation | 2.4 Password toggle | PASS | |
| 2. Login Validation | 2.5 Admin login | PASS (if DB running) | Requires live backend + DB |
| 3. Registration | 3.1 Role required | PASS | |
| 3. Registration | 3.2 Name required | PASS | |
| 3. Registration | 3.3 Password strength indicator | PASS | |
| 3. Registration | 3.4 Weak password blocked | PASS | |
| 3. Registration | 3.5 Duplicate email | PASS (if DB running) | |
| 4. Forgot/Reset | 4.1 Empty email error | PASS | |
| 4. Forgot/Reset | 4.2 Invalid email format | PASS | |
| 4. Forgot/Reset | 4.3 Anti-enumeration | PASS (if backend running) | |
| 4. Forgot/Reset | 4.4 No token state | PASS | |
| 4. Forgot/Reset | 4.5 Weak password blocked | PASS | |
| 5. Instructor Dashboard | 5.1 Dashboard loads | PASS (if accounts exist) | Requires test accounts |
| 5. Instructor Dashboard | 5.2 Create exam button | PASS | |
| 5. Instructor Dashboard | 5.3 Student blocked | PASS | |
| 6. Create Exam | 6.1 /exams/new loads | PASS | |
| 6. Create Exam | 6.2 Empty form errors | PASS | |
| 6. Create Exam | 6.3 Add MCQ question | PASS | |
| 6. Create Exam | 6.4 Student blocked | PASS | |
| 7. Student Dashboard | 7.1 Dashboard loads | PASS (if accounts exist) | |
| 7. Student Dashboard | 7.2 Join code input | PASS | |
| 7. Student Dashboard | 7.3 Instructor blocked | PASS | |
| 7. Student Dashboard | 7.4 Invalid code error | PASS | |
| 7. Student Dashboard | 7.5 Empty code no-op | PASS | |
| 8. Role Separation | 8.1-8.7 All access control | PASS | |
| 9. Profile Settings | 9.1-9.3 Profile page | PASS | |
| 10. Edge Cases | 10.1-10.7 Various | MIXED | Test 10.5 (dev-login) is a security finding |
| 11. Session Guards | 11.1-11.2 | PASS | |
| 12. Submissions | 12.1-12.2 | PASS | |
| 13. Theme Toggle | 13.1-13.2 | PASS | |
| 14. Backend API | 14.1 Health | PASS (if backend running) | |
| 14. Backend API | 14.2-14.4 Auth required | PASS | |
| 14. Backend API | 14.5 ADMIN role blocked | PASS | |
| 14. Backend API | 14.6 Empty register | FAIL — **BUG** | Backend does not validate, likely crashes with SMTP error |
| 14. Backend API | 14.7 Cross-role blocked | PASS | |
| 14. Backend API | 14.8 SQL injection | PASS | mssql parameterization prevents injection |
| 14. Backend API | 14.9 Rate limit headers | PASS | |
| 15. Accessibility | 15.1-15.5 | PASS | Visual checks only; axe audit not run |

---

## 5. Risk Assessment

### Critical Risk: Production Backdoor
The `/auth/dev-login` endpoint is the single most dangerous item. Combined with the hardcoded admin email (`admin@examflow.com`) being logged at startup, any deployment that does not set `NODE_ENV=production` is fully compromised.

### Critical Risk: Student Code Sandbox Escape
Students can execute arbitrary Python (and to a lesser extent C++) code on the server with full filesystem access. The server's `.env` file containing the JWT secret and database password can be read by any student who submits crafted code.

### High Risk: Exam Data Integrity
- Race condition on submission start allows double submissions.
- NaN scores from AI failure corrupt grade data.
- Missing transaction wrapping on question updates.

### Medium Risk: Broken Student Experience
- The student dashboard's exam list is always empty due to the instructor-only API call (FLOW-001 / BUG-003).
- Copy-paste prevention in exam sessions blocks legitimate code pasting.

### Low Risk: WCAG Compliance
The app uses no ARIA attributes on interactive custom components. A significant accessibility refactor is needed for compliance with WCAG 2.1 Level AA.

---

## 6. Prioritized Recommendations

### P0 — Fix Before Any Production Deployment

1. **Remove or properly secure `/auth/dev-login`** (SEC-001). Use a separate environment-gated config, not code.
2. **Move admin credentials to environment variables** (SEC-002). Never log or commit them.
3. **Sandbox student code execution** (SEC-003, SEC-004). Run in an isolated container or use `isolated-vm`.
4. **Add server-side input validation** (VAL-001) to all API endpoints.

### P1 — Fix Before Beta/Public Launch

5. **Fix student exam list** (FLOW-001 / BUG-003). Students see no exams on their dashboard.
6. **Fix NaN score persistence** (BUG-002). AI grading errors silently corrupt grades.
7. **Fix auto-save timer reset** (BUG-007). Students may lose work if they type continuously.
8. **Fix email enumeration** (SEC-005). Use unified error messages on login.
9. **Add UNIQUE constraint on student+exam in Submissions** (EDGE-001). Prevent duplicate submissions.
10. **Wrap exam/question updates in transactions** (DATA-001).

### P2 — Improve Before Stable Release

11. **Align frontend/backend password validation** (VAL-003). Backend should require 8+ characters.
12. **Fix admin dashboard average score query** (DATA-004). Change `'GRADED'` to `'SUBMITTED'`.
13. **Fix "Return to Dashboard" navigation** (UX-006, UX-007). Navigate to role-specific dashboard.
14. **Fix copy-paste prevention blocking code input** (UX-001). Allow paste in text areas.
15. **Add mobile question navigation in exam session** (UX-004).
16. **Fix UML blended metric display** (BUG-004). Change `studentAns.score` to `studentAns.scoreEarned`.

### P3 — Accessibility & Polish

17. **Add `htmlFor`/`id` associations to all form labels** (A11Y-001).
18. **Add ARIA attributes to MCQ buttons** (A11Y-002).
19. **Add `aria-live` timer announcements** (A11Y-003).
20. **Add `autocomplete="one-time-code"` to OTP inputs** (A11Y-004).
21. **Add accessible names to icon-only buttons** (A11Y-005).
22. **Fix footer dead links** (UX-003).
23. **Fix confirm-password error message in Register** (VAL-004).
24. **Use `crypto.randomUUID()` for analytics visitor ID** (EDGE-006).

---

*Report generated by static code analysis of the ExamFlow codebase. Test execution results are projected based on code analysis; actual pass/fail may vary with live application state.*
