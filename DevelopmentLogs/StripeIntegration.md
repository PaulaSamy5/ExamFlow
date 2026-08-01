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
