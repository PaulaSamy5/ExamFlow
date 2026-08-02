# Stripe Integration — Development Journal

This file is a running log of the Stripe billing/subscription integration for ExamFlow. Every entry below is appended after a prompt/milestone — never overwritten. Each step is meant to be independently reviewable and, if needed, reversible using its own Rollback Instructions.

---

# Step 01

**Date:** 2026-08-02

**Goal:** Read and understand the existing ExamFlow architecture before writing any Stripe code, and produce a milestone plan. No code was written in this step — pure research and planning, per the explicit "do not rebuild/redesign, work in small testable milestones" instructions.

**Files Modified:** None.

**New Files:**
- `DevelopmentLogs/StripeIntegration.md` (this file).

**Deleted Files:** None.

**Database Changes:** None yet.

**Environment Variables Added:** None yet.

**Routes Added:** None yet.

**Components Added:** None yet.

**Services Added:** None yet.

**Bug Fixes:** None.

**Important Notes — architecture findings that will shape every later milestone:**

- **Landing/Pricing** — `frontend/src/pages/HomePage.jsx` already has a full `PricingSection` with 4 hardcoded plans (Free $0, Starter $29, Professional $79, Business $149), each with a feature list and a `popular` flag on Professional. The CTA button on every plan card is currently `disabled` with text "Coming Soon" and a "Currently in trial phase" banner — it has no `onClick`/`Link`, purely decorative. This is the exact, only place a real "Select Plan" action needs to be wired in; the surrounding card design must not change.
- **Auth flow** — `AuthContext.login()` always navigates immediately to `/instructor/dashboard` or `/student/dashboard` based on role (`getRedirectPath`). There is currently **no** "resume what I was doing before login" mechanism anywhere (no redirect query param, no `location.state` capture, no `ProtectedRoute` wrapper). This has to be built new — smallest option is a query/localStorage-based "pending plan selection" that `AuthContext` checks right after a successful login/register/OTP-verify and redirects to checkout instead of the dashboard when present.
- **Dashboard** — `Dashboard.jsx` role-routes to `InstructorDashboard.jsx` / `StudentDashboard.jsx`, both flat single-page layouts with no sidebar. Top nav (in `App.jsx`) is the only persistent chrome — a "Billing" entry belongs there, next to the existing `/profile` link.
- **Profile page** — `frontend/src/pages/ProfileSettings.jsx` is a single form, not tabbed, with an existing convention of a collapsible section (used for "Change Password"). The requested Billing page will follow that same collapsible-section convention rather than introducing tabs (which don't exist yet and would be a structural redesign).
- **Backend modules** — Strict 2-file-per-module convention: `backend/src/modules/<name>/<name>.routes.js` + `<name>.controller.js`, mounted in `backend/src/app.js` as `app.use('/api/<name>', apiLimiter, xRoutes)`. No per-module service files exist yet (there's a top-level `backend/src/services/` for cross-cutting concerns like AI/db-monitor) — this integration will be the first to introduce dedicated service files (`StripeService`, `BillingService`, `SubscriptionService`, `WebhookService`), living under `backend/src/services/billing/` to keep the existing module convention intact while satisfying the "separate responsibilities cleanly" requirement.
- **Critical constraint**: `app.js` applies `express.json()` globally before routes are mounted. Stripe webhook signature verification requires the **raw** request body, so the webhook route must be registered with `express.raw({ type: 'application/json' })` on that specific path, mounted *before* (or explicitly excluded from) the global JSON parser.
- **Database** — Postgres via `pg`, no ORM, `CREATE TABLE IF NOT EXISTS` pattern in `initializeSchema()` (`backend/src/config/db.js`), with a manual `COLUMN_MAP` translating Postgres's lowercased columns back to camelCase for JS. New tables just need their own `CREATE TABLE IF NOT EXISTS` block plus `COLUMN_MAP` entries. No existing table needs to change — a purely additive `Subscriptions` table (+ likely `Invoices`, `SubscriptionEvents` for history) referencing `Users(id)` is fully backward compatible with zero risk to current users/data.
- **Dependencies** — Neither `stripe` (backend) nor `@stripe/stripe-js` (frontend) is installed yet. Both will be new additions.
- **Env vars** — Backend `.env` uses a `# ── Section Header ──` comment-block convention; a new `# Stripe / Billing Configuration` block will hold `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and per-plan Price IDs. Frontend needs `VITE_STRIPE_PUBLISHABLE_KEY` (safe to expose client-side, matches the existing `VITE_`-prefix convention).
- **Deployment** — Frontend auto-deploys to Vercel, backend auto-deploys to Railway (`https://examflow-production-7689.up.railway.app`), both on push to `main`, confirmed via existing GitHub commit-status checks. The Stripe webhook endpoint will be publicly reachable at `https://examflow-production-7689.up.railway.app/api/billing/webhook` once mounted — this is the URL to register in the Stripe Dashboard's webhook settings (test mode).

**Rollback Instructions:** N/A — no code changes were made in this step. Delete `DevelopmentLogs/StripeIntegration.md` if the log itself needs to be discarded.

**Proposed Milestone Plan (subject to your adjustment before Milestone 1 starts):**

1. **Milestone 1 — DB + backend scaffold (no Stripe calls yet).** Add `Subscriptions`, `Invoices`, `SubscriptionEvents` tables (additive only). Scaffold the `billing` module (`billing.routes.js` + `billing.controller.js`) and service files (`BillingService`, `SubscriptionService`, empty `StripeService`/`WebhookService` shells) mounted at `/api/billing`, plus one real read endpoint `GET /api/billing/status` that returns `{ plan: 'FREE', status: 'ACTIVE' }` for every user (everyone defaults to Free — no behavior change for existing users). Testable in isolation: hit the endpoint, confirm schema created, confirm nothing else changed.
2. **Milestone 2 — Stripe SDK + Checkout Session creation.** Install `stripe`/`@stripe/stripe-js`, implement `StripeService`, add `POST /api/billing/checkout` that creates a real Stripe Checkout Session (test mode) for a paid plan and returns the redirect URL. No UI wiring yet — testable via a direct API call/Postman-style check that a real test-mode Checkout URL comes back.
3. **Milestone 3 — Webhook handling + subscription activation.** Add the raw-body webhook route, `WebhookService` verifying Stripe's signature, handling `checkout.session.completed` / `customer.subscription.updated` / `.deleted` to write into `Subscriptions`/`SubscriptionEvents`. Testable with the Stripe CLI's `stripe trigger`/local webhook forwarding against the deployed Railway URL.
4. **Milestone 4 — Wire the Pricing page.** Replace the disabled "Coming Soon" buttons with real "Select Plan" actions: logged-in users go straight to Checkout; logged-out users get the plan choice remembered and are sent to Checkout automatically right after login/register. This is the first milestone with any visible UI behavior change.
5. **Milestone 5 — Billing page in Profile.** Add the collapsible Billing section to `ProfileSettings.jsx`: current plan, status, renewal date, payment history (from `Invoices`), Upgrade, Cancel — all reading from endpoints built in earlier milestones.
6. **Milestone 6 — Success/cancel handling + Dashboard messaging.** Stripe Checkout `success_url`/`cancel_url` handling, success banner on Dashboard after activation, cancel returns to Dashboard with the previous plan intact and retry available.

Each milestone above ends with commit → push → deploy (Vercel + Railway) → manual verification, per Rule 2, before the next one starts.

---

# Step 02

**Date:** 2026-08-02

**Goal:** Implement Milestone 1 (DB schema + backend billing module scaffold) as proposed in Step 01, then deploy and verify per Rule 2. This step also documents a significant, unplanned deployment infrastructure investigation that had to be resolved before Milestone 1 could be verified as live.

**Files Modified:**
- `backend/src/config/db.js` — Reason: added `Subscriptions`, `Invoices`, `SubscriptionEvents` table definitions (via `CREATE TABLE IF NOT EXISTS`, fully additive) inside `initializeSchema()`, added `CHK_Subscription_Plan`/`CHK_Subscription_Status` check constraints following the existing `CHK_User_Role` convention, added two new indices, and extended `COLUMN_MAP` with the new tables' camelCase column mappings. No existing table or column was altered.
- `backend/src/app.js` — Reason: required the new `billingRoutes` module and mounted it as `app.use('/api/billing', apiLimiter, billingRoutes)`, following the exact existing pattern used for `admin`/`analytics`/etc. No existing route mounting changed.

**New Files:**
- `backend/src/modules/billing/billing.routes.js` — defines `GET /api/billing/status` (authenticated).
- `backend/src/modules/billing/billing.controller.js` — calls `BillingService.getBillingStatus(userId)`.
- `backend/src/services/billing/SubscriptionService.js` — reads a user's `Subscriptions` row, or returns a virtual `{ plan: 'FREE', status: 'ACTIVE', ... }` default when no row exists (no row is created until a user's plan actually changes).
- `backend/src/services/billing/BillingService.js` — orchestration layer for controllers; currently just delegates to `SubscriptionService` for the status read.
- `backend/src/services/billing/StripeService.js` — empty shell, scaffolded per the four-service requirement; implemented in Milestone 2.
- `backend/src/services/billing/WebhookService.js` — empty shell, scaffolded per the four-service requirement; implemented in Milestone 3.

**Deleted Files:** None.

**Database Changes:**
- **What changed:** three new tables added — `Subscriptions` (one row per user once their plan changes away from default; includes `stripeCustomerId`/`stripeSubscriptionId`/`stripePriceId`/period dates/`cancelAtPeriodEnd`/`canceledAt`/`couponId` for future coupon support), `Invoices` (payment history, one row per Stripe invoice), `SubscriptionEvents` (append-only webhook audit log with a `UNIQUE stripeEventId` for idempotent webhook processing/retries).
- **Why:** foundation for all later milestones (Checkout, webhooks, Billing page) without needing further schema changes for the initially-requested future features (coupons/promo codes/discounts/invoices/subscription history all fit the existing columns).
- **Is it safe:** yes — every statement is `CREATE TABLE IF NOT EXISTS` / idempotent `ALTER ... ADD CONSTRAINT` wrapped in try/catch, matching the existing schema-init pattern exactly. Verified locally and in production that the schema sync ran with zero errors.
- **Are old users affected:** no. No existing table gained or lost a column, no existing row was touched. A user with no `Subscriptions` row is treated as `FREE`/`ACTIVE` by the application layer (`SubscriptionService`), which is already true for 100% of current users today.

**Environment Variables Added:** None yet (Stripe keys come in Milestone 2 — user is setting up a Stripe test-mode account in parallel).

**Routes Added:** `GET /api/billing/status` (authenticated) — returns `{ plan, status, currentPeriodEnd, cancelAtPeriodEnd }` for the requesting user.

**Components Added:** None (backend-only milestone, no UI changes).

**Services Added:** `BillingService`, `SubscriptionService`, `StripeService` (empty shell), `WebhookService` (empty shell) — all under `backend/src/services/billing/`.

**Bug Fixes:** None (unrelated to this integration).

**Important Notes:**
- **Local verification (before deploy):** started the backend locally, confirmed `✨ PostgreSQL Schema Ready.` logged with no errors, directly queried Postgres to confirm all 3 tables + correct columns + both check constraints exist, then hit `GET /api/billing/status` with a throwaway JWT (no real user data used) — confirmed 401 without a token and the correct `{"plan":"FREE","status":"ACTIVE","currentPeriodEnd":null,"cancelAtPeriodEnd":false}` with one. Confirmed the pre-existing `/api/exams` route was completely unaffected. Test user deleted immediately after.
- **Deployment blocker encountered (significant, unplanned):** after pushing, Vercel deployed normally but Railway did not pick up the new commit at all — `GET /api/billing/status` kept returning a generic 404 (route not found) instead of the expected 401, even though the pre-existing `/api/exams` route worked fine (confirming the *old* code was still running, not that the server was down). Investigated with the user directly in the Railway dashboard:
  1. Railway's Source settings showed "Auto deploys when pushed to GitHub" enabled and correctly pointed at `PaulaSamy5/ExamFlow` on `main` — looked correctly configured.
  2. The service was in a "Sleeping" state (expected free-tier idle behavior, not the actual problem — it wakes on request).
  3. Manually clicking "Redeploy" in the Railway UI surfaced the real, first blocker: **"Free-tier deploys to sfo are not available during peak hours (8 AM – 8 PM America/Los_Angeles). Please try again later or upgrade your plan."** This is a Railway free-tier hosting restriction, unrelated to our code. User chose to wait rather than upgrade.
  4. Later, the user re-attempted a manual "Redeploy" and it succeeded — but Railway's Deployments history showed it was still redeploying a **17-commits-stale** GitHub commit (`43935d0`, a tour fix from earlier in the day), not the actual current `main` HEAD (`a88fa07`). This meant the GitHub→Railway webhook itself had stopped delivering new-push events at some point after that commit, independent of the peak-hours restriction.
  5. Fix: disconnected and reconnected the GitHub source in Railway's Settings (Source section → Disconnect → reconnect `PaulaSamy5/ExamFlow` on `main`). This did **not** retroactively pull the commits that were already pushed before reconnecting (redeploy still showed the same stale commit immediately after reconnecting).
  6. Confirmed theory by pushing a new, trivial empty commit (`580bdd8`, "chore(billing): trigger Railway redeploy after reconnecting GitHub source") — **this triggered a real, successful deploy of the current code within ~45 seconds.** The reconnect fixed the webhook for *future* pushes; it just doesn't retroactively re-trigger for commits already sitting on GitHub.
  7. Re-ran the full local verification steps above against the live Railway URL (`https://examflow-production-7689.up.railway.app`) — identical correct results: 401 without a token, correct FREE/ACTIVE JSON with one, `/api/exams` unaffected. Test user deleted immediately after. Also reconfirmed Vercel frontend still returns 200.
- **Practical implication for future milestones:** the Railway GitHub webhook can silently stop delivering events without any visible error in the dashboard until you try to redeploy. If a future push doesn't show up on Railway within a couple of minutes, don't assume it's still building — check whether the Deployments list is showing a stale commit SHA (compare against `git log`), and if so, an empty "trigger" commit (or another Settings → Source disconnect/reconnect) is the known fix.

**Rollback Instructions:**
- Remove `backend/src/modules/billing/` (both files).
- Remove `backend/src/services/billing/` (all four files).
- In `backend/src/app.js`: remove the `billingRoutes` require line and the `app.use('/api/billing', ...)` line.
- In `backend/src/config/db.js`: remove the three `CREATE TABLE IF NOT EXISTS` blocks for `Subscriptions`/`Invoices`/`SubscriptionEvents`, their two `CREATE INDEX` statements, the `CHK_Subscription_Plan`/`CHK_Subscription_Status` constraint block, and the corresponding `COLUMN_MAP` entries added in this step. Note: if any real subscription data has been written by that point, drop the tables manually (`DROP TABLE IF EXISTS SubscriptionEvents, Invoices, Subscriptions;`, in that FK-safe order) since `CREATE TABLE IF NOT EXISTS` won't remove them on its own.
- Commit `580bdd8` (empty trigger commit) can be left in place harmlessly, or dropped via revert — it has no code effect.

**Milestone 1 status: ✅ complete and verified live in production.**
