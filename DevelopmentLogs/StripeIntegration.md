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

---

# Step 03

**Date:** 2026-08-02

**Goal:** Get the Stripe test-mode account fully usable — API keys in place, and the 3 paid-plan Products/Prices created — as prep for Milestone 2. No app code behavior changed in this step; this is account/environment setup plus one new reusable script.

**Files Modified:** None.

**New Files:**
- `backend/scripts/setup-stripe-products.js` — idempotent script (safe to re-run) that creates or reuses the `ExamFlow Starter/Professional/Business` Products + monthly recurring Prices in whatever Stripe account the configured `STRIPE_SECRET_KEY` points at. Refuses to run unless the key starts with `sk_test_`, as a guard against ever accidentally running it against a live key. Prints the resulting `STRIPE_PRICE_ID_*` values to paste into `.env`.

**Deleted Files:** None.

**Database Changes:** None.

**Environment Variables Added** (all in `backend/.env`, not committed — `.env` is gitignored):
- `STRIPE_SECRET_KEY` — **Purpose:** authenticates the backend's Stripe SDK calls (Checkout Session creation in Milestone 2, webhook processing in Milestone 3). **Required:** yes, for all future milestones. **Development only:** this specific value is a `sk_test_...` key (test mode) — a separate live key will be needed for `STRIPE_SECRET_KEY` in a real production cutover, added only to Railway's env vars at that time, never to this repo.
- `STRIPE_PRICE_ID_STARTER` / `STRIPE_PRICE_ID_PROFESSIONAL` / `STRIPE_PRICE_ID_BUSINESS` — **Purpose:** the specific Stripe Price objects the Checkout Session (Milestone 2) will reference for each paid plan. **Required:** yes, for Milestone 2 onward. **Development only:** yes, these are test-mode price IDs (`price_...` under the test sandbox); production would need its own live-mode equivalents created the same way, via the same script pointed at a live key.

Frontend's `VITE_STRIPE_PUBLISHABLE_KEY` is still pending — not yet provided by the user.

**Routes Added:** None.

**Components Added:** None.

**Services Added:** None (StripeService remains an empty shell — its real implementation is Milestone 2).

**Bug Fixes:** None.

**Important Notes:**
- Paula's Stripe account is registered under a supported billing country (not Egypt — Stripe doesn't support Egypt for merchant accounts at all yet) purely to unlock test-mode API access for development. This has zero effect on anything built so far since everything is test-mode only. If/when ExamFlow goes live with real payments, the live-account country and processor choice (Stripe live support vs. an Egypt-compatible alternative like Paymob/Fawry) will need a separate decision — explicitly out of scope for now.
- `_setup_stripe_products.js` was first run from a scratch location, then promoted to `backend/scripts/setup-stripe-products.js` (matching the existing `backend/scripts/seed-test-accounts.js` convention) since it's a legitimate reusable asset, not throwaway. Run twice locally to confirm idempotency (second run correctly reused all 3 existing products/prices instead of duplicating them).
- Installing the `stripe` npm package (`backend/package.json`) triggered a real Railway redeploy, which was used as a confirmation check that the Railway GitHub webhook (fixed in Step 02) is now reliably triggering on every push — confirmed: the new commit appeared as Railway's active deployment within the normal ~1 minute window, and both `/api/billing/status` and the pre-existing `/api/exams` route responded correctly (401, as expected without a token) afterward.
- Resulting test-mode Price IDs (safe to record here — these are not secrets, just identifiers scoped to the test sandbox):
  - Starter: `price_1TzwPjJuZQ4zdRIdZYXH3wvE`
  - Professional: `price_1TzwPkJuZQ4zdRIdPcgsBGFO`
  - Business: `price_1TzwPlJuZQ4zdRId9T9QD0ZM`

**Rollback Instructions:**
- Delete `backend/scripts/setup-stripe-products.js`.
- Revert `backend/package.json`/`backend/package-lock.json` to drop the `stripe` dependency (`npm uninstall stripe`).
- Remove the `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID_*` lines from `backend/.env` (local-only change, nothing to revert on GitHub since `.env` was never committed).
- The Stripe Products/Prices themselves can be archived (not hard-deleted — Stripe discourages deleting Prices once created) from the Stripe Dashboard's Product catalog if no longer needed; this has no effect on the ExamFlow codebase either way.

**Milestone 1 prep status: ✅ Stripe test account + backend env vars ready. Still needed before Milestone 2 can be fully wired end-to-end: `VITE_STRIPE_PUBLISHABLE_KEY` for the frontend.**

**Update (same day):** `VITE_STRIPE_PUBLISHABLE_KEY` received and added to `frontend/.env` and `frontend/.env.production` (commit `9fa5ca4`), deployed to Vercel and confirmed successful. Not yet present in the built JS bundle — expected, since Vite only inlines env vars that are actually referenced in source code, and nothing reads it yet (Milestone 2 is what wires it in). All prerequisites for Milestone 2 (Stripe SDK, secret key, 3 price IDs, publishable key) are now in place.

---

# Step 04

**Date:** 2026-08-03

**Goal:** Implement Milestone 2 — real Stripe Checkout Session creation — then deploy and verify per Rule 2. This step also documents a second, more serious Railway deployment incident (a genuine production crash-loop), distinct from the earlier webhook-staleness issue in Step 02.

**Files Modified:**
- `backend/src/services/billing/StripeService.js` — Reason: implemented for real (previously an empty shell). Wraps the Stripe SDK: `createCustomer(user)` creates a Stripe Customer with `metadata.userId` for traceability; `createCheckoutSession({ customerId, plan, userId, role })` creates a `mode: 'subscription'` Checkout Session for the plan's configured Price ID, with `success_url`/`cancel_url` both pointing at the user's role-appropriate dashboard (`?billing=success`/`?billing=canceled` — the actual toast/UI wiring for these lands in Milestone 4). Throws a fatal startup error if `STRIPE_SECRET_KEY` is missing — see Important Notes below for why this mattered.
- `backend/src/services/billing/SubscriptionService.js` — Reason: added `saveStripeCustomerId(userId, stripeCustomerId)`, an upsert (`INSERT ... ON CONFLICT (userId) DO UPDATE`) so a user's first checkout attempt creates and persists one Stripe Customer, and any retry reuses it instead of creating duplicate Stripe Customers.
- `backend/src/services/billing/BillingService.js` — Reason: added `createCheckoutSession(user, plan)` orchestration — validates the plan is one of `STARTER`/`PROFESSIONAL`/`BUSINESS` (400 error otherwise), ensures a Stripe Customer exists (creating one via `StripeService` + persisting via `SubscriptionService` on first use), then delegates to `StripeService` for the actual session and returns its URL.
- `backend/src/modules/billing/billing.controller.js` — Reason: added `createCheckout` — reads `plan` from the request body, fetches the user's current name/email fresh from the DB (the JWT payload only carries `{id, email, role}`, and Stripe needs the display name), calls `BillingService.createCheckoutSession`, returns `{ url }`.
- `backend/src/modules/billing/billing.routes.js` — Reason: added `POST /checkout` (authenticated) route.

**New Files:** None (all changes landed in Milestone 1's scaffolded files).

**Deleted Files:** None.

**Database Changes:** None new — `Subscriptions.stripeCustomerId` (added in Milestone 1) is now actually written to for the first time, via `saveStripeCustomerId`. No schema change.

**Environment Variables Added:** None new in this step (all four Stripe env vars were added to `backend/.env` in Step 03) — but see Important Notes: this step is what surfaced that **local `.env` values are not automatically available in Railway's production environment**, since `.env` is gitignored and never pushed.

**Routes Added:** `POST /api/billing/checkout` (authenticated) — body `{ plan: 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' }`, returns `{ url: 'https://checkout.stripe.com/...' }` (a real test-mode Checkout URL) on success, `400` for an invalid/missing plan.

**Components Added:** None (still backend-only; pricing page wiring is Milestone 4).

**Services Added:** None new — `StripeService`/`SubscriptionService`/`BillingService` were all scaffolded in Milestone 1; this step is their real implementation.

**Bug Fixes:**
- Corrected a testing-instruction mistake from Step 03 (not a code bug): I had given the user a `fetch('/api/billing/status', ...)` snippet using a relative URL. That only resolves correctly against `localhost` (where Vite's dev server proxies `/api/*` to the local backend) — on the deployed site, the frontend (Vercel) and backend (Railway) are on completely separate domains with no proxy between them, and `vercel.json`'s catch-all SPA rewrite serves `index.html` for any unmatched path, which is what produced the `"Unexpected token '<'"` JSON-parse error the user saw. The real backend was never broken; the fix was giving the correct fully-qualified Railway URL for testing directly against production.

**Important Notes — a genuine production incident, root-caused and fixed:**
1. After pushing the Milestone 2 commit, Railway's GitHub webhook had gone stale again (same class of issue as Step 02 — no new deployment appeared at all, even as a skipped/failed entry, for over a day of wall-clock time this time). Fixed the same way: disconnect + reconnect the GitHub source in Railway Settings, followed by a fresh empty "trigger" commit (reconnecting alone doesn't retroactively deploy commits already sitting on GitHub — confirmed this pattern is consistent both times now).
2. Once a fresh deploy finally did start, the service became **completely unreachable** — not a 404, but TCP connections succeeding (TLS handshake completed) and then hanging with zero bytes received until timeout. This is the signature of a crash-looping container (Railway repeatedly starting and killing a process that dies immediately on boot), not a webhook/proxy issue.
3. **Root cause:** `StripeService.js` throws a fatal `Error` at module-require time if `STRIPE_SECRET_KEY` isn't set (`if (!process.env.STRIPE_SECRET_KEY) throw new Error(...)`), by design — but `STRIPE_SECRET_KEY` (and the 3 price IDs) had only ever been added to the **local** `backend/.env` file, which is gitignored and therefore never reaches Railway. The moment Railway actually deployed the Milestone 2 code, the app crashed on every boot attempt because the production environment never had these variables.
4. **Fix:** had the user add all 4 Stripe env vars directly in Railway's dashboard (Variables tab), which is the correct place for production secrets regardless of what's in a local, gitignored `.env` file. Railway auto-redeployed on save; the service came back up immediately (401 on the new route instead of a hung connection).
5. **Full verification after the fix:** confirmed `/api/exams` (pre-existing route) and `/api/billing/status` both healthy (401 without a token). Created a throwaway test user, called `POST /api/billing/checkout` with `{"plan":"STARTER"}` — got back a real `https://checkout.stripe.com/c/pay/cs_test_...` URL. Called it again with an invalid plan name — got a `400` as designed. Queried the `Subscriptions` table directly and confirmed a row was created for the test user with `stripeCustomerId` populated (proving `saveStripeCustomerId`'s upsert worked against production Postgres, not just locally). Deleted the test user and their `Subscriptions` row immediately after.
6. **Lesson for all future milestones that add env vars:** local `backend/.env` and `frontend/.env`/`.env.production` are **not** synced to Railway/Vercel automatically. Every new env var must be added in *both* places — the local file (for `git`-ignored local dev) *and* the corresponding platform's dashboard (Railway Variables tab for backend secrets; Vercel Environment Variables for frontend, though `frontend/.env.production` happens to be committed today since it holds no secrets — that convention could change if a future frontend env var needs to be secret). Verify with an authenticated production request after every such change, not just a plain reachability check, since a reachability check alone (e.g. hitting `/` or an existing unrelated route) would not have caught this — only the specific new route depending on the missing var would fail.

**Rollback Instructions:**
- In `backend/src/services/billing/StripeService.js`: revert to the empty-shell version (`module.exports = {};`).
- In `backend/src/services/billing/SubscriptionService.js`: remove `saveStripeCustomerId` and its export.
- In `backend/src/services/billing/BillingService.js`: remove `createCheckoutSession` and its export (keep `getBillingStatus`).
- In `backend/src/modules/billing/billing.controller.js`: remove `createCheckout` and its export (keep `getStatus`).
- In `backend/src/modules/billing/billing.routes.js`: remove the `POST /checkout` line (keep `GET /status`).
- No database rollback needed — `Subscriptions.stripeCustomerId` already existed as a column from Milestone 1; only its usage is being removed, not the column.
- If reverting, any Stripe Customers already created in the test sandbox can be left as-is (harmless test data) or deleted from the Stripe Dashboard's Customers list.

**Milestone 2 status: ✅ complete and verified live in production.**
