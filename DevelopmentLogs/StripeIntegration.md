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

---

# Step 05

**Date:** 2026-08-13

**Goal:** Implement Milestone 3 — Stripe webhook signature verification + subscription activation — as part of a combined push (requested by the user) to get "select plan → real payment → visible Billing page" fully testable end-to-end, deploy, and verify per Rule 2.

**Files Modified:**
- `backend/src/app.js` — Reason: registered `POST /api/billing/webhook` directly on `app` (via `express.raw({ type: 'application/json' })`) **before** the global `app.use(express.json(...))` line. Stripe's signature verification needs the exact raw request bytes; once `express.json()` parses and re-serializes a body, the signature can no longer be verified. This is why the webhook route lives directly in `app.js` instead of inside `billing.routes.js` (which is mounted after JSON parsing, alongside every other billing route). No other route or middleware ordering changed.
- `backend/src/modules/billing/billing.controller.js` — Reason: added `handleWebhook`, called by the route above. Delegates signature verification + event processing to `WebhookService`; a thrown error (bad signature or processing failure) returns `400` (tells Stripe to retry), success returns `200`.
- `backend/src/services/billing/StripeService.js` — Reason: added `getPlanForPriceId(priceId)`, a reverse lookup (Price ID → plan name) needed by the webhook handlers to determine which plan a Stripe subscription now represents (e.g. after an upgrade/downgrade changes the underlying price).
- `backend/src/services/billing/SubscriptionService.js` — Reason: added `getByStripeCustomerId`, `getByStripeSubscriptionId` (lookups used to resolve which user a webhook event belongs to), and `upsertFromStripeSubscription(userId, fields)` — the **only** place in the codebase that writes a subscription's plan/status as confirmed-true (as opposed to `saveStripeCustomerId`, which just records intent to start a checkout).
- `backend/src/services/billing/WebhookService.js` — Reason: implemented for real (previously an empty shell from Milestone 1). Verifies the Stripe signature via `stripe.webhooks.constructEvent`, checks `SubscriptionEvents.stripeEventId` (UNIQUE) for idempotency before doing any work, then routes to one of four handlers: `checkout.session.completed` (retrieves the full Subscription from Stripe and activates it), `customer.subscription.updated` (syncs plan/status/period dates — covers renewals and upgrade/downgrade), `customer.subscription.deleted` (reverts the user to `FREE`/`CANCELED`), `invoice.paid` (inserts a row into `Invoices` for payment history, `ON CONFLICT (stripeInvoiceId) DO NOTHING`). Every handler resolves the target user via `metadata.userId` first (set at checkout-creation time in Milestone 2), falling back to a `stripeCustomerId` lookup. Stripe's raw subscription statuses (`trialing`/`active`/`past_due`/`canceled`/`incomplete`/`incomplete_expired`/`unpaid`/`paused`) are normalized into the `CHK_Subscription_Status` enum via a `STATUS_MAP` with a safe `'INCOMPLETE'` fallback for anything unrecognized, so an unexpected Stripe status can never violate the check constraint and crash the handler.

**New Files:**
- `backend/scripts/setup-stripe-webhook.js` — idempotent (mirrors `setup-stripe-products.js`): registers the `/api/billing/webhook` endpoint in the Stripe test sandbox for `checkout.session.completed`/`customer.subscription.updated`/`customer.subscription.deleted`/`invoice.paid`, and prints the signing secret. Refuses to run against a non-`sk_test_` key. Notes clearly that Stripe only ever shows the signing secret once, at creation — if lost, the fix is deleting the endpoint in the Dashboard and re-running the script.

**Deleted Files:** None.

**Database Changes:** None new (no schema change) — this step is the first to actually *write* to `Invoices` and `SubscriptionEvents` (both created empty in Milestone 1), and the first to write real subscription state (`plan`, `status`, period dates, `cancelAtPeriodEnd`, `canceledAt`) into `Subscriptions` rather than just `stripeCustomerId`.

**Environment Variables Added:**
- `STRIPE_WEBHOOK_SECRET` — **Purpose:** verifies that incoming `/api/billing/webhook` requests genuinely came from Stripe (HMAC signature check) rather than an arbitrary POST from anyone who finds the URL. **Required:** yes, `WebhookService` throws a fatal error at require-time if it's missing (same fail-fast convention as `JWT_SECRET`/`STRIPE_SECRET_KEY` elsewhere in this codebase). **Development only:** yes — this value is tied to the *test-mode* webhook endpoint; a live cutover needs its own live-mode webhook endpoint (created the same way, via the same script pointed at a live key) and its own secret, added only to Railway at that time.

**Routes Added:** `POST /api/billing/webhook` (unauthenticated by design — Stripe calls this directly, not a logged-in user; authenticity comes from the signature check, not a JWT).

**Components Added:** None (still backend-only; Milestone 4 is the first with any frontend change).

**Services Added:** None new — `WebhookService` was scaffolded in Milestone 1; this step is its real implementation.

**Bug Fixes:** None.

**Important Notes — process discipline that paid off, and one more deployment incident:**
- **Applied the Milestone 2 lesson successfully this time:** before writing any webhook code, ran `setup-stripe-webhook.js` to obtain `STRIPE_WEBHOOK_SECRET`, added it to *both* `backend/.env` and Railway's Variables tab, and confirmed the backend was still healthy — all *before* pushing the webhook code. This is the correct order (env var in place first, code that requires it second) and is what should happen for every future milestone that adds a required env var.
- **Local verification before any deploy:** started the backend locally, confirmed a clean boot (no crash) with the new webhook route registered. Hit it with a deliberately bogus `Stripe-Signature` header — got a proper `400 {"error":"Webhook Error: ..."}` (not a 404), confirming the route exists and signature verification is actually being enforced. Then used `Stripe.webhooks.generateTestHeaderString()` to construct a **real, correctly-signed** synthetic `customer.subscription.updated` event for a throwaway local test user and POSTed it directly to `localhost:5000/api/billing/webhook` — confirmed the resulting `Subscriptions` row had the exact right `plan` (reverse-mapped from the price ID), `status: ACTIVE`, `stripeCustomerId`/`stripeSubscriptionId`/`stripePriceId`, and 30-day period dates, and that a matching row appeared in `SubscriptionEvents`. Re-sent the identical event (same `event.id`) and confirmed the response reported `"duplicate": true` and did not reprocess — idempotency genuinely works, not just in theory.
- **Deployment incident (this time NOT a crash, initially misdiagnosed as one):** after pushing, the site became unreachable again (`curl` timeouts, TCP connects but nothing comes back) — the exact same *symptom* as the Milestone 2 crash-loop, which triggered the same immediate suspicion. This time, though, the deploy logs (checked directly in the Railway dashboard) showed a completely clean boot all the way through `🚀 System Online` and `PostgreSQL connected` — no crash at all. Waited it out and the service came back up on its own within a couple of minutes. **Conclusion: this was Railway's free-tier "sleeping" cold-start behavior taking longer than usual, not a code or configuration problem.** The practical lesson: a connection timeout right after a deploy is *not* automatically a crash-loop — check the actual deploy logs before assuming the worst; a genuine crash-loop shows an error or an incomplete boot sequence in the logs, a slow cold-start does not.
- **Full production verification after confirming the service was up:** hit the webhook route with a bogus signature (got the same correct `400` as local), confirmed `/api/exams` and `/api/billing/status` both healthy. Then repeated the full signed-event test directly against the production URL (`https://examflow-production-7689.up.railway.app/api/billing/webhook`) with a fresh throwaway user — confirmed the `Subscriptions` row landed correctly in the **production** database with the right plan/status/Stripe IDs, and the audit row appeared in `SubscriptionEvents`. Deleted the test user, `Subscriptions` row, and `SubscriptionEvents` row immediately after.

**Rollback Instructions:**
- In `backend/src/app.js`: remove the `billingController` require and the `app.post('/api/billing/webhook', ...)` line.
- In `backend/src/modules/billing/billing.controller.js`: remove `handleWebhook` and its export, remove the `webhookService` require.
- In `backend/src/services/billing/WebhookService.js`: revert to the empty-shell version (`module.exports = {};`).
- In `backend/src/services/billing/SubscriptionService.js`: remove `getByStripeCustomerId`, `getByStripeSubscriptionId`, `upsertFromStripeSubscription`.
- In `backend/src/services/billing/StripeService.js`: remove `getPlanForPriceId`.
- Delete `backend/scripts/setup-stripe-webhook.js`.
- Remove `STRIPE_WEBHOOK_SECRET` from `backend/.env` and Railway's Variables tab.
- In the Stripe Dashboard (Developers → Webhooks, test mode), delete the registered endpoint for `https://examflow-production-7689.up.railway.app/api/billing/webhook` if no longer needed — otherwise Stripe will keep attempting deliveries to a route that no longer exists (harmless, just noisy failed-delivery entries in the Dashboard).
- No database rollback needed — `Invoices`/`SubscriptionEvents` already existed as empty tables from Milestone 1; only their write path is being removed, not the tables themselves. Any real rows written by this point can be left as historical data or manually deleted.

**Milestone 3 status: ✅ complete and verified live in production (both locally and directly against the deployed Railway URL, with a real Stripe-signed test event in each case).**

---

# Step 06

**Date:** 2026-08-14

**Goal:** Implement Milestone 4 — wire the Landing Page pricing cards to real Stripe Checkout, including the "select plan while logged out → register/login → automatically continue to payment" flow — then deploy and verify. First frontend-facing milestone; every prior step was backend-only.

**Files Modified:**
- `frontend/src/pages/HomePage.jsx` — Reason: `PricingSection`'s 4 plan buttons were `disabled` with "Coming Soon" text and no handler at all. Added a `key` (`FREE`/`STARTER`/`PROFESSIONAL`/`BUSINESS`) to each plan object, replaced the disabled button with a real one calling `handleSelectPlan(plan.key)`, and removed the now-inaccurate "Currently in trial phase — subscriptions will be available soon" banner. `handleSelectPlan` saves the plan (paid plans only) via `pendingPlan.js` and navigates to `/register`. **Why it's safe to always go to `/register` and not branch on auth state here:** `HomePage` already returns `<Navigate>` and redirects logged-in users away before `PricingSection` ever renders (confirmed by reading the top of the file), so every click in this component is guaranteed to come from a logged-out visitor — no dead "already logged in" branch was added.
- `frontend/src/store/AuthContext.jsx` — Reason: added `redirectAfterAuth(role)`, called from the three places a user becomes authenticated (`login`, the instant-success path in `register`, and `verifyOTP`) in place of the old direct `navigate(getRedirectPath(role))`. It checks for a pending plan; if present, clears it and creates a real Checkout Session via `POST /billing/checkout`, then does a full `window.location.href` redirect to Stripe (not a router navigation, since it's leaving the app entirely). If there's no pending plan, or the checkout call fails, it falls back to the exact same role-based dashboard redirect as before — a plain login with nothing pending behaves identically to pre-Milestone-4.
- `frontend/src/pages/Dashboard.jsx` — Reason: Stripe's `success_url`/`cancel_url` (set in Milestone 2's `StripeService`) both land back on the role-appropriate dashboard with a `?billing=success` or `?billing=canceled` query param. Added a `useEffect` reading that param via `useSearchParams`, showing a toast (`react-hot-toast`, matching the app's existing notification convention) and stripping the param from the URL afterward (`replace: true`, so refreshing doesn't re-fire it). Deliberately worded the success toast as "Payment successful! Your plan will update in a moment" rather than claiming the plan is already active — the actual `Subscriptions` row is only ever written by the webhook (Milestone 3), never trusted from a redirect alone, since a redirect firing isn't proof a webhook has landed yet.

**New Files:**
- `frontend/src/lib/pendingPlan.js` — thin `localStorage` wrapper (`savePendingPlan`/`getPendingPlan`/`clearPendingPlan`) under the key `examflow_pending_plan`. This is the only mechanism connecting "plan selected on Landing Page" to "continue to Checkout after auth," since (per the Step 01 architecture review) nothing like a redirect-after-login mechanism existed anywhere in the codebase before this.

**Deleted Files:** None.

**Database Changes:** None.

**Environment Variables Added:** None.

**Routes Added:** None (reuses `POST /api/billing/checkout` from Milestone 2).

**Components Added:** None new (all changes are to existing pages/context).

**Services Added:** None.

**Bug Fixes:** None (a double-firing toast observed during dev-server testing was investigated and confirmed to be a React StrictMode dev-only artifact — see Important Notes — not an actual bug, so nothing needed fixing).

**Important Notes:**
- **Verified the full chain locally, end to end, exactly as the user will experience it:** visited the landing page logged out, confirmed the pricing buttons read "Select Plan" (not "Coming Soon"), clicked Professional, confirmed both the `/register` redirect and `examflow_pending_plan = PROFESSIONAL` in `localStorage`. Then — simulating "I already have an account" — went to `/login` instead of finishing registration, logged in with an existing test user, and confirmed the browser actually landed on a real `checkout.stripe.com` URL (not the dashboard), with the pending plan cleared from `localStorage` afterward. This proves the mechanism works regardless of whether the user completes register *or* login — both funnel through the same `redirectAfterAuth`.
- **Regression-checked the unmodified path:** logged in with no pending plan set — confirmed it still lands on `/instructor/dashboard` exactly as before this milestone, with no behavior change for the vast majority of logins that have nothing to do with billing.
- **Dashboard toast verified in both directions:** navigated directly to `.../dashboard?billing=success` and `.../dashboard?billing=canceled` and confirmed the correct toast text appears and the query param is stripped from the URL in both cases.
- **Investigated a real discrepancy before dismissing it:** the success toast rendered *twice* during dev-server testing (`npm run dev`). Rather than assume it was harmless, ran `npm run build` + `npm run preview` (an actual production build) and repeated the exact same test with a synthetic `localStorage` session (via `page.addInitScript`, no real login needed) — the toast fired exactly once. `frontend/src/main.jsx` wraps the app in `<React.StrictMode>`, which deliberately double-invokes effects in development only (a documented React behavior, stripped entirely from production builds) specifically to help catch missing-cleanup bugs — this is exactly that, confirmed rather than assumed, and requires no code change.
- **Copy change beyond just the buttons:** the "Currently in trial phase — subscriptions will be available soon" banner directly contradicted the now-functional Select Plan buttons, so it was removed as part of the same "remove the Coming Soon state" request rather than left as stale, confusing copy.

**Rollback Instructions:**
- In `frontend/src/pages/HomePage.jsx`: revert the pricing button to `disabled` with "Coming Soon" text (drop the `key` fields and `handleSelectPlan`); optionally restore the trial-phase banner if desired.
- In `frontend/src/store/AuthContext.jsx`: remove `redirectAfterAuth` and revert its three call sites back to `navigate(getRedirectPath(role))` directly.
- In `frontend/src/pages/Dashboard.jsx`: remove the `useEffect`/`useSearchParams` block and its imports (`useEffect`, `useSearchParams`, `toast`).
- Delete `frontend/src/lib/pendingPlan.js`.
- No backend or database rollback needed — this step only added frontend call sites for the `POST /api/billing/checkout` endpoint that already existed from Milestone 2.

**Milestone 4 status: ✅ complete and verified live in production (Vercel deploy confirmed, bundle contains the new pricing/redirect code, "Coming Soon" text confirmed absent from the deployed bundle).**

---

# Step 07

**Date:** 2026-08-15

**Goal:** Implement Milestone 5 — the Billing page inside Profile (current plan, status, renewal date, upgrade/downgrade, cancel, resume, payment history) — plus the backend endpoints it needs (`change-plan`, `cancel`, `resume`, `invoices`), deploy, and verify.

**Files Modified:**
- `backend/src/services/billing/StripeService.js` — Reason: added three functions on top of Milestone 2/3's `createCheckoutSession`: `changeSubscriptionPlan(stripeSubscriptionId, newPlan)` (in-place `stripe.subscriptions.update` with `proration_behavior: 'create_prorations'` — deliberately **not** a new Checkout Session, which would create a second, duplicate subscription instead of modifying the existing one), `cancelSubscriptionAtPeriodEnd` (`cancel_at_period_end: true` — user keeps access through what they already paid for, not an immediate cutoff), `resumeSubscription` (undoes that flag). All three let the resulting `customer.subscription.updated` webhook (Milestone 3) be the one to actually update the `Subscriptions` row, same as every other state change — nothing here writes to the database directly.
- `backend/src/services/billing/SubscriptionService.js` — Reason: added `getInvoicesForUser(userId)`, a simple `SELECT * FROM Invoices WHERE userId = ? ORDER BY createdAt DESC`.
- `backend/src/services/billing/BillingService.js` — Reason: added `changePlan(user, plan)`, `cancelSubscription(userId)`, `resumeSubscription(userId)`, `getInvoices(userId)` orchestrating the above. `changePlan` has a deliberate fallback: if the user has no active Stripe subscription yet (still on FREE, or a fully-ended past subscription), it transparently calls `createCheckoutSession` instead of erroring — so the same "Upgrade" button in the UI works correctly whether this is someone's first paid plan or a switch between two paid plans, without the frontend needing to know which case it is.
- `backend/src/modules/billing/billing.controller.js` — Reason: added `changePlan`, `cancelSubscription`, `resumeSubscription`, `getInvoices` controller functions, thin wrappers around the `BillingService` calls above (matching the existing `getStatus`/`createCheckout` pattern exactly).
- `backend/src/modules/billing/billing.routes.js` — Reason: added `POST /change-plan`, `POST /cancel`, `POST /resume`, `GET /invoices` (all `authMiddleware`-protected, matching every other billing route).
- `frontend/src/pages/ProfileSettings.jsx` — Reason: imported and rendered the new `BillingCard` component, placed between the existing Security card and the Replay Tour card — follows the page's established "stack of cards in the right column" layout with zero structural changes to the surrounding form.

**New Files:**
- `frontend/src/components/BillingCard.jsx` — the actual Billing UI: current plan name + status badge, renewal/cancellation date (`date-fns` `format`, matching the exact convention already used in `InstructorDashboard.jsx`), a Cancel/Resume button that swaps based on `cancelAtPeriodEnd`, an "Upgrade your plan" (or "Switch plan," worded differently depending on whether the user is on Free or already paid) grid offering every *other* paid plan as a one-click switch, and a Payment History list from `GET /billing/invoices` with links out to Stripe's hosted invoice pages. Uses the app's existing card styling (`bg-slate-50 dark:bg-slate-900/60 border ... rounded-3xl p-6 shadow-xl`) verbatim — no new design system introduced.

**Deleted Files:** None.

**Database Changes:** None (no schema change — this milestone is the first to *read* `Invoices` via the API, and the first to trigger `changeSubscriptionPlan`/cancel/resume paths that ultimately write through the same `upsertFromStripeSubscription` webhook path Milestone 3 already built).

**Environment Variables Added:** None.

**Routes Added:** `POST /api/billing/change-plan`, `POST /api/billing/cancel`, `POST /api/billing/resume`, `GET /api/billing/invoices` (all authenticated).

**Components Added:** `BillingCard` (see above).

**Services Added:** None new — extended the existing three billing services.

**Bug Fixes:** None.

**Important Notes:**
- **`getBillingStatus` gained a `hasActiveSubscription` field** (`!!sub.stripeSubscriptionId && sub.status !== 'CANCELED'`) specifically so the frontend can decide whether to show the Cancel button without needing to expose raw Stripe IDs to the client or duplicate that logic in `BillingCard`.
- **Local verification before any deploy, using real (test-mode) Stripe objects, not synthetic ones:** created a real Stripe Customer + real Subscription via the SDK directly (`payment_method: 'pm_card_visa'`, Stripe's standard always-succeeds test card), synced it into the DB with a properly-signed webhook call (same technique as Step 05), then ran through the full sequence against `localhost:5000`: status read, invoice list, an invalid-plan rejection (400), a same-plan no-op rejection (400, "Already on the X plan"), a real upgrade (STARTER → PROFESSIONAL, confirmed Stripe actually prorated it), cancel-at-period-end, resume, and confirmed an `Invoices` row appeared with the right amount. All 9 steps passed. Canceled the real Stripe subscription and deleted all test rows immediately after.
- **UI verification via Playwright, also against real local servers:** logged in as a fresh test instructor and discovered the onboarding tour (built earlier this session) auto-starts for new instructors and actively fights direct navigation to `/profile` — worked around it in the test by setting `examflow_onboarding_completed_<userId>` in `localStorage` before navigating, which is exactly the flag the tour itself checks, so this isn't a workaround around a bug, just correctly bypassing an unrelated feature to isolate this one. Confirmed the Free-plan state (badge, "No active subscription," three upgrade options, "No payments yet") both by text assertions and a screenshot, then clicked "Starter" from the Billing page as an already-logged-in user and confirmed it landed on a real `checkout.stripe.com` URL — this is the "upgrade from within the app" path, distinct from Milestone 4's "select plan while logged out" path, and both now confirmed working.
- **Deployment hit the exact same Railway webhook staleness as Steps 02 and 05** — pushed the Milestone 5 commit, waited, `POST /billing/change-plan` kept returning 404 (route not found) while `/api/exams` stayed healthy (server up, just running old code). Same diagnosis, same fix: disconnect + reconnect the GitHub source in Railway's Settings, then an empty trigger commit (`ac41cd4`) to actually pull the already-pushed code. Deployed successfully within about a minute of the trigger commit landing. **This is now a firmly established pattern across three separate milestones** — see the "Practical implication" note in Step 05; the fix is quick once recognized, but it is not a one-time fluke, so expect to repeat it for future milestones too, and check for it proactively (a 404 on a route that should exist, right after a push, with the rest of the API healthy) rather than assuming something is broken in the code.
- **Full production verification after the fix:** confirmed `/api/exams` (pre-existing) and `/api/billing/status`, `/api/billing/invoices`, `/api/billing/cancel`, `/api/billing/resume` all correctly reachable and auth-gated (401 without a token). Then ran an authenticated round-trip directly against the production URL with a throwaway user: status read (FREE), `change-plan` → `STARTER` (confirmed `type: "checkout"` with a real URL), `cancel` with no subscription (confirmed the correct 400 "No active subscription to cancel"), and `invoices` (confirmed an empty array for a brand-new user). Deleted the test user and all related rows immediately after. Separately confirmed the Vercel deploy: fetched the live JS bundle and confirmed it contains `examflow_pending_plan`, `Switch plan`, `Resume Subscription`, and `Get Started Free` — i.e. both Milestone 4's and Milestone 5's frontend code are genuinely live, not just committed.

**Rollback Instructions:**
- In `backend/src/services/billing/StripeService.js`: remove `changeSubscriptionPlan`, `cancelSubscriptionAtPeriodEnd`, `resumeSubscription` and their exports (keep `createCustomer`/`createCheckoutSession`/`getPriceIdForPlan`/`getPlanForPriceId` from earlier milestones).
- In `backend/src/services/billing/SubscriptionService.js`: remove `getInvoicesForUser`.
- In `backend/src/services/billing/BillingService.js`: remove `changePlan`, `cancelSubscription`, `resumeSubscription`, `getInvoices` (keep `getBillingStatus`/`createCheckoutSession`; also revert `getBillingStatus`'s return value to drop `hasActiveSubscription` if fully rolling back).
- In `backend/src/modules/billing/billing.controller.js`: remove `changePlan`, `cancelSubscription`, `resumeSubscription`, `getInvoices`.
- In `backend/src/modules/billing/billing.routes.js`: remove the 4 new route lines (keep `GET /status` and `POST /checkout`).
- In `frontend/src/pages/ProfileSettings.jsx`: remove the `BillingCard` import and its render.
- Delete `frontend/src/components/BillingCard.jsx`.
- No database rollback needed — nothing in this step altered the schema.

**Milestone 5 status: ✅ complete and verified live in production (backend endpoints confirmed reachable and correct via a real authenticated round-trip against the deployed Railway URL; frontend confirmed live via the deployed Vercel bundle).**

---

# Step 08

**Date:** 2026-08-15

**Goal:** Deliver the requested comprehensive testing guide covering the whole billing/subscription system (Phases 1–7: backend, frontend, database, Stripe Dashboard, edge cases, deployment, rollback), now that Milestones 1–5 are all complete and independently verified.

**Files Modified:** None.

**New Files:**
- `DevelopmentLogs/BillingTestingGuide.md` — the full step-by-step checklist. Reflects exactly what's implemented today (every endpoint, response shape, and error case listed matches the real code, not an aspirational spec). Two items from the original request are explicitly called out as **not currently applicable** rather than silently included as if they exist: "Profile badge updates" (no plan badge exists outside the Billing card itself) and "Landing page plan updates" (logged-in users never see the Landing Page at all, so there's no plan state to reflect there). Phase 7 (Rollback) intentionally points back to this file's own per-step Rollback Instructions rather than duplicating them in a second document, to avoid the two ever drifting out of sync.

**Deleted Files:** None.

**Database Changes:** None.

**Environment Variables Added:** None.

**Routes Added:** None.

**Components Added:** None.

**Services Added:** None.

**Bug Fixes:** None.

**Important Notes:**
- The guide's Phase 6 (Deployment Verification) directly encodes the Railway webhook-staleness lesson learned the hard way across Steps 02, 05, and 07 — checking the active deployment's commit SHA against `git log` immediately after every push, rather than assuming a timeout means something is broken in the code.
- No separate `docs/BILLING_IMPLEMENTATION_LOG.md` was created — this journal (`StripeIntegration.md`) already serves that exact purpose per the original Rule 3 from Step 01, and a second parallel log would only risk the two falling out of sync.

**Rollback Instructions:**
- Delete `DevelopmentLogs/BillingTestingGuide.md` if no longer wanted. Purely documentation — no code or infrastructure to revert.

**Testing guide status: ✅ delivered.**

---

# Step 09

**Date:** 2026-08-16

**Goal:** Redirect the subscription entry point through the existing Login page instead of opening Stripe Checkout directly from the Landing Page, so an unauthenticated visitor picking a paid plan authenticates first, an existing Instructor lands straight on Checkout with zero extra clicks, an existing Student is clearly told subscriptions are Instructor-only (both in the UI and, non-negotiably, on the backend), and a brand-new signup started from a paid plan skips the Instructor/Student picker entirely (Instructor assumed) without touching normal registration's own picker. No redesign of Landing, Login, Register, or Dashboard — only the minimum routing/state glue.

**Files Modified:**
- `backend/src/modules/billing/billing.routes.js` — Reason: subscriptions are Instructor-only per the request, and the frontend can never be trusted to enforce that on its own. Added the existing `instructorOnly` middleware (already used for exam-management routes, pattern reused verbatim) to `POST /checkout`, `POST /change-plan`, `POST /cancel`, `POST /resume`. `GET /status` and `GET /invoices` stay open to any authenticated role, since a Student's status is always FREE with no invoices — nothing to protect there, and gating reads too would only complicate the Billing page for no security benefit.
- `frontend/src/pages/HomePage.jsx` — Reason: `PricingSection`'s `handleSelectPlan` now saves the chosen plan (`savePendingPlan`, from Milestone 4's already-existing `pendingPlan.js`) and routes paid plans to `/login` instead of opening Checkout immediately; Free is untouched (`/register`, as before).
- `frontend/src/store/AuthContext.jsx` — Reason: this is where "what happens right after auth succeeds" already lived (`redirectAfterAuth`, from Milestone 4). Extended it to be the single decision point for all three post-auth outcomes: no pending plan → normal dashboard redirect (unchanged); pending plan + Instructor → clears the plan, calls `POST /billing/checkout`, and does a full-page redirect to the returned Stripe URL, skipping the dashboard entirely; pending plan + non-Instructor → flags a one-shot `sessionStorage` marker (see `pendingPlan.js` below) and redirects to that role's normal dashboard, where the marker triggers an explanatory toast. `redirectAfterAuth` is now exposed through the context value so `Register.jsx` can call it directly. `login()`/`register()` merge its `{ blockedInstructorOnly }` result into their own return value.
- `frontend/src/lib/pendingPlan.js` — Reason: added `flagInstructorOnlyBlock()` / `consumeInstructorOnlyFlag()`, a one-shot `sessionStorage` flag consumed by `Dashboard.jsx`. **This replaced an initial `?billing=instructor_only` query-param design that looked correct in code review but silently failed in Playwright testing.** Root cause: `App.jsx`'s `/login` route guard (`!user ? <Login/> : <Navigate to={getRedirectPath(user.role)}/>`) and `AuthContext.redirectAfterAuth`'s own `navigate()` call both fire off the exact same `setUser(...)` update, and empirically do **not** reliably land in one batched React transition — instrumented with a `history.pushState`/`replaceState` monkey-patch (`page.addInitScript` in a throwaway Playwright script) that logged every history call with a stack trace, which caught the route guard's own internal `<Navigate>` effect firing *after* `redirectAfterAuth`'s `navigate('...?billing=instructor_only')` had already landed, silently overwriting it with the bare path and dropping the query string before `Dashboard.jsx` ever read it. A `sessionStorage` flag isn't attached to either navigation, so it survives the race regardless of which `navigate()` call wins. The existing `?billing=success` / `?billing=canceled` params (used by Stripe's own `success_url`/`cancel_url` redirects, not by an in-app SPA navigate racing a route guard) were not affected by this and are untouched.
- `frontend/src/pages/Dashboard.jsx` — Reason: (1) reads `consumeInstructorOnlyFlag()` in its own effect (separate from the pre-existing `?billing=` query-param effect) and shows a `react-hot-toast` JSX toast — "Instructor accounts only... Please sign in with an instructor account to subscribe." — with a "Sign in with a different account" action. (2) That action's `onClick` was originally a plain `logout('/')`, which hit the *identical* batching race described above (`logout()`'s `setUser(null)` + its own `navigate('/')` racing the `/student/dashboard` route guard's `<Navigate to="/login"/>`), and was observed in testing landing the user on `/login` instead of `/` (pricing). Fixed by calling `logout('/', true)` (skip the SPA navigate) followed by a hard `window.location.href = '/'` — a full reload sidesteps the race entirely rather than trying to out-time it. This mirrors why `App.jsx`'s own navbar logout already uses an `isLoggingOut`-suppression flag + delay instead of a bare `logout()` call; that flag is local to `App.jsx` and wasn't worth plumbing through context for this one button.
- `frontend/src/pages/Login.jsx` — Reason: `handleSubmit` now skips the "Welcome back" toast when `redirectAfterAuth` reports `blockedInstructorOnly`, so it doesn't collide with the dashboard's explanatory toast. No visual/structural changes to the page itself — an earlier attempt at an inline "blocked" screen directly on the Login page was built and then removed once testing proved it unreachable (see Important Notes).
- `frontend/src/pages/Register.jsx` — Reason: (a) hides the Instructor/Student picker and shows a small "Instructor plans are available for instructors only" note instead, only when `getPendingPlan()` is truthy at mount (`isSubscriptionSignup`), forcing `role = 'INSTRUCTOR'` in that case; normal registration (no pending plan) is provably unchanged (`isSubscriptionSignup` is false and the original picker renders exactly as before). (b) `handleComplete()` — the final step of the registration wizard — previously hardcoded `navigate('/dashboard')` after profile setup, silently never continuing to Checkout even for a genuine subscription signup; now calls the shared `redirectAfterAuth(role)` like every other auth entry point.

**New Files:** None.

**Deleted Files:** None (test/debug scaffolding created and removed during this step is listed under Important Notes, not here, since none of it was ever committed).

**Database Changes:** None.

**Environment Variables Added:** None.

**Routes Added:** None (existing `/billing/*` routes gained middleware; see Files Modified).

**Components Added:** None.

**Services Added:** None.

**Bug Fixes:**
- Fixed `Register.jsx`'s `handleComplete()` unconditionally navigating to `/dashboard` and never continuing to Checkout — pre-existing gap from Milestone 4, exposed while wiring this milestone's "Create Account from subscription flow" path.
- Fixed the `?billing=instructor_only` query-param race described above (never shipped externally — caught during this same milestone's own testing).

**How the flow works now:**
1. Landing Page, paid plan → `savePendingPlan(plan)` (localStorage) → `/login`.
2. Login succeeds → `AuthContext.redirectAfterAuth(role)`:
   - No pending plan → normal role-based dashboard (unchanged behavior).
   - Pending plan, role = INSTRUCTOR → `POST /billing/checkout` (plan validated + mapped to a Stripe Price ID server-side, per `billing.controller.js`/`StripeService.js` from Milestones 2–3, untouched) → full-page redirect straight to Stripe Checkout.
   - Pending plan, role ≠ INSTRUCTOR → `flagInstructorOnlyBlock()` + normal role-based dashboard redirect → `Dashboard.jsx` shows the explanatory toast, plan stays saved (not cleared) in case the same browser logs in again as an Instructor.
3. "Create an account" from this flow → `Register.jsx` detects the pending plan, skips the role picker (Instructor assumed, with a note), and its final step also goes through `redirectAfterAuth`.
4. Backend enforcement is independent of all of the above: `instructorOnly` middleware rejects any non-Instructor JWT on `/billing/checkout|change-plan|cancel|resume` (403), and `BillingService`/`StripeService` (Milestone 2, untouched) reject any plan value that isn't one of the real configured plans (400) regardless of what the frontend sends.

**How to test it:**
- **Test A (existing Instructor):** Log out. On the Landing Page, click "Select Plan" on Professional. Confirm redirect to `/login` (not Checkout yet). Log in as an existing Instructor. Expect: no dashboard flash, straight to `checkout.stripe.com` showing "Subscribe to ExamFlow Professional — $79.00 per month" with your email prefilled. Pay with `4242 4242 4242 4242`, any future expiry, any CVC. Expect: redirected back to the Instructor Dashboard with a "Payment successful" toast, and the Billing page reflects Professional within a few seconds (webhook-driven).
- **Test B (existing Student):** Log out. Select any paid plan → `/login`. Log in as an existing Student. Expect: landed on the Student Dashboard (never Checkout, never `stripe.com`), with a toast reading "Instructor accounts only — Please sign in with an instructor account to subscribe." Confirm the toast's "Sign in with a different account" link logs out and lands back on the Landing Page with pricing cards visible again.
- **Test C (new Instructor via signup):** Log out. Select Professional → `/login` → click "Create an account." Expect: no Instructor/Student picker on Step 1, just a name form plus the note "Instructor plans are available for instructors only." Complete signup (through OTP verification if email verification is on). Expect: lands directly on Stripe Checkout for Professional, not the dashboard.
- **Test D (per-plan price mapping):** Repeat Test A's mechanism for Starter and Business, not just Professional. Confirm each shows its own correct price ($29 / $149) on the Stripe page — proves the plan survives the whole redirect chain and maps to the right Stripe Price ID, not just whichever one was tested first.
- **Test E (cancelled checkout):** Start a checkout as an Instructor (Test A up through landing on `checkout.stripe.com`), then click Stripe's own back arrow instead of paying. Expect: lands back on the Instructor Dashboard, no error, `GET /billing/status` unchanged (still the plan you were on before), and the app is otherwise fully usable (nothing left in a stuck/loading state).
- **Test F (backend security, bypassing the UI):** With a Student's JWT, `POST /billing/checkout` (or `/change-plan`, `/cancel`, `/resume`) directly — expect `403 {"error":"Forbidden: Instructor access only"}` every time, even with a well-formed valid plan value. With an Instructor's JWT, `POST /billing/checkout` with `{"plan":"NOT_A_REAL_PLAN"}` — expect `400 {"error":"Invalid plan: NOT_A_REAL_PLAN"}`. With no `Authorization` header at all — expect `401`.

**Important Notes:**
- **Debugging method for the query-param race:** direct instrumentation (temporary `console.log`s in `AuthContext.jsx`/`Dashboard.jsx`, plus a `history.pushState`/`replaceState` monkey-patch injected via Playwright's `page.addInitScript` that logged a stack trace on every call) was what actually found this — a `page.waitForSelector('text=...')` timeout alone only proves *that* something's wrong, not *why*; the stack traces were what pointed at React Router's own `<Navigate>` internals as the second, competing `pushState` call. All of this instrumentation was removed before committing; none of it shipped.
- **Verified locally via Playwright** end-to-end for: unauthenticated → paid plan → `/login` (plan persisted in `localStorage` across the navigation); existing Student blocked with the toast visible, no accidental Stripe redirect, plan still preserved after the block, and a clean logout back to pricing; existing Instructor going straight from login to a real `checkout.stripe.com` session for Starter, Professional, and Business individually (distinct Stripe session IDs and distinct displayed prices confirmed per plan); Create-Account-from-subscription hiding the role picker and showing the note while normal `/register` (no pending plan) still shows the picker exactly as before; a cancelled/abandoned checkout returning safely with the subscription unchanged; and the full backend security suite (Test F above) run directly against the API with real JWTs, independent of the frontend.
- **Did not automate an actual card payment through Stripe's hosted Checkout UI in this step** (Test A's "Pay with a test card" was verified visually — confirmed the correct plan/price render on the real Checkout page — rather than driving Stripe's own multi-iframe, hCaptcha-protected payment form via Playwright, which is fragile to automate reliably and was already proven end-to-end in Step 07 using a more direct technique: creating a real Stripe Customer + Subscription via the SDK and syncing it through a properly-signed webhook call). The manual test plan above (Test A) still calls for a human to actually complete one real test-card payment before considering this fully verified in production.
- Two throwaway DB rows (`flow.instructor@examflow-billingtest.local` / `flow.student@examflow-billingtest.local`, plus their `Subscriptions` rows) were created for this testing and deleted immediately after — hit the same transient Neon `ETIMEDOUT`/`ENETUNREACH` connectivity blip documented in Step 07's testing notes; retried after a short wait and it cleared on its own, unrelated to any code in this step.

**Rollback Instructions:**
- `backend/src/modules/billing/billing.routes.js`: remove the `instructorOnly` middleware from `POST /checkout`, `/change-plan`, `/cancel`, `/resume` (revert to `authMiddleware` only, matching Milestone 5).
- `frontend/src/pages/HomePage.jsx`: revert `handleSelectPlan` to its Milestone 4 form if paid plans should go straight to `/register` again (check that milestone's own log for the exact prior behavior).
- `frontend/src/store/AuthContext.jsx`: revert `redirectAfterAuth` to its Milestone 4 version (no instructor-only branch); drop `redirectAfterAuth` from the exposed context value if `Register.jsx` no longer needs it.
- `frontend/src/lib/pendingPlan.js`: remove `flagInstructorOnlyBlock`/`consumeInstructorOnlyFlag`.
- `frontend/src/pages/Dashboard.jsx`: remove the instructor-only-flag effect and its toast.
- `frontend/src/pages/Login.jsx`: remove the `blockedInstructorOnly` check in `handleSubmit` (always show the "Welcome back" toast on success).
- `frontend/src/pages/Register.jsx`: remove `isSubscriptionSignup` and revert Step 1 to always show the role picker; revert `handleComplete()` to `navigate('/dashboard')` if the direct-to-checkout continuation is no longer wanted (not recommended — that was a pre-existing bug fix, independent of the rest of this milestone).
- No database rollback needed — nothing in this step altered the schema.

**Milestone 9 status: ✅ implemented and verified locally (frontend flow, backend security enforcement, and per-plan Stripe price mapping all confirmed via Playwright + direct API calls), deployed, and confirmed working in production (Railway needed a full disconnect/reconnect of its GitHub source plus an empty trigger commit before it picked up the new commits — the reconnect-only fix from Steps 02/05/07 was insufficient this time; Vercel built and aliased correctly on the first push but its edge CDN served a stale cached copy at `X-Vercel-Cache: HIT` for an extended period afterward before resolving on its own — not a deploy failure, just slow cache invalidation, confirmed via the deployment's own "Ready"/"Production Current" status in the Vercel dashboard while the edge was still stale). Manual production verification (Tests A–C of the plan below) confirmed working by the account owner directly.**

---

# Step 10

**Date:** 2026-08-17

**Goal:** Pause the user-facing paid-subscription rollout (Landing Page paid plans return to "Coming Soon") while keeping every piece of the billing implementation built in Steps 01–09 fully intact, so it can be switched back on later with a one-line config change instead of re-implementing anything. Triggered by two things the account owner surfaced after manually testing Step 09's flow end-to-end: (1) all testing so far has used Stripe **test mode** — no real money has ever moved, and a real cardholder's payment would only work once the app is switched to Stripe **live** API keys, which involves account/business verification the owner hasn't completed yet; (2) Egypt is not currently a Stripe-supported country for a Stripe Payments account, so the actual live-mode payment provider is still an open decision — not something to implement today.

**Files Modified:**
- `frontend/src/pages/HomePage.jsx` — Reason: `PricingSection`'s paid-plan buttons (Starter/Professional/Business) now render disabled with the label "Coming Soon" instead of "Select Plan" whenever billing is off, using the exact same button element/classes/sizing as before (only the color/label/disabled state change) so the card design, spacing, and copy are pixel-identical to Step 09 — nothing about the pricing cards themselves (features lists, prices, the Professional "Most Popular" styling) was touched. `handleSelectPlan` also short-circuits before `savePendingPlan`/`navigate('/login')` for paid plans when billing is off, as a second layer behind the disabled button (defense in depth, not strictly required since a disabled button can't fire `onClick`, but cheap insurance against any future change to the button that accidentally drops the `disabled` prop). Free plan behavior (`Get Started Free` → `/register`) is completely unchanged.
- `frontend/src/store/AuthContext.jsx` — Reason: `redirectAfterAuth` now reads `getPendingPlan()` only when billing is on; when it's off, it behaves as if no plan were ever pending, falling straight through to the normal role-based dashboard redirect. This is the safety net for anyone who saved a plan to `localStorage` *before* this change shipped (e.g. mid-testing) and logs in *after* — without this, Step 09's Login→Checkout logic would still fire for that one stale value even though the Landing Page can no longer create new ones. Nothing else in the function changed; when billing is re-enabled this line reads the same as it did in Step 09.
- `frontend/.env` / `frontend/.env.production` — Reason: added `VITE_BILLING_ENABLED=false` to both, with an inline comment pointing back to this log for reactivation. No other variables touched — `VITE_STRIPE_PUBLISHABLE_KEY` and `VITE_API_URL` are untouched and still test-mode/production values respectively.

**New Files:**
- `frontend/src/lib/featureFlags.js` — a single exported constant, `BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true'`. Defaults to **disabled** if the env var is ever missing (fails closed, not open) — deliberate, since the cost of accidentally leaving paid checkout reachable is much higher than the cost of accidentally hiding it. This is the only feature-flag mechanism introduced; no config/admin-panel/database-flag system was built since the project doesn't already have one and the request was explicit about not adding unnecessary complexity.

**Deleted Files:** None. **No billing code, route, service, database table/column, or Stripe configuration was removed or altered.**

**Database Changes:** None.

**Environment Variables Added:** `VITE_BILLING_ENABLED` (frontend-only; see above). No backend environment variables changed — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and every Stripe Price ID stay exactly as configured, still pointing at Stripe **test mode**.

**Routes Added/Removed:** None. Every `/api/billing/*` route (`GET /status`, `POST /checkout`, `POST /change-plan`, `POST /cancel`, `POST /resume`, `GET /invoices`, `POST /webhook`) is untouched and still fully functional — this pause is a frontend-only gate. An authenticated Instructor calling these directly (e.g. via the Billing page in Profile Settings, or a raw API call) can still open a test-mode Checkout session exactly as before; the only thing removed is the Landing Page's ability to *start* that journey for a new visitor. This was a deliberate scope decision — the request's own goal statement was specifically "Landing Page → Paid Plans → Coming Soon," and the existing Billing/Profile page falls under "existing users should continue using ExamFlow normally" rather than the paused flow.

**Components Added:** None.

**Services Added:** None.

**Bug Fixes:** None.

**Preserved Billing Infrastructure (confirmed untouched):**
Stripe SDK integration (`StripeService.js`), all billing API routes and controller logic, Checkout session creation, subscription change/cancel/resume logic, webhook signature verification and handling, the `Subscriptions`/`Invoices` database tables and their `COLUMN_MAP` entries, plan-to-Stripe-Price-ID configuration, the `GET /billing/status` and `GET /billing/invoices` endpoints, `instructorOnly` middleware enforcement on all billing-mutation routes (Step 09), the full selected-plan-survives-login/register flow in `AuthContext.redirectAfterAuth` and `Register.jsx` (Step 09), and the entire environment variable structure for both test-mode and future live-mode keys.

**How it works now:**
- Landing Page: paid plan buttons show "Coming Soon," disabled, no click handler fires. Free plan works exactly as before.
- `AuthContext.redirectAfterAuth`: ignores any pending plan while `BILLING_ENABLED` is false, so login/register always falls through to the normal dashboard redirect.
- Login page, Register page, Instructor/Student dashboards, exam creation/grading/everything non-billing: **completely unaffected**, since none of that code path touches `featureFlags.js` at all.
- Billing/Profile page (`BillingCard.jsx`) for an already-existing subscriber: unaffected, still fully functional (see the routes note above for why this was kept in scope).

**How to test it:**
1. Open the Landing Page logged out. The three paid plan cards show a greyed-out "Coming Soon" button; Free still shows an active "Get Started Free" button with the same styling as before.
2. Click a paid plan's "Coming Soon" button. Expect: nothing happens — no navigation, no `localStorage` write (`examflow_pending_plan` stays unset), no console error.
3. Click "Get Started Free." Expect: normal registration flow, unchanged from Step 09.
4. Log in as an existing Instructor with no pending plan. Expect: normal Instructor Dashboard, exactly as before.
5. (Optional, confirms the safety net) In DevTools, manually run `localStorage.setItem('examflow_pending_plan', 'PROFESSIONAL')`, then log in. Expect: still lands on the normal dashboard, **not** Stripe Checkout — proves `redirectAfterAuth`'s billing check is working, not just the button being disabled.

**Deployment:**
- Tested locally first (Vite dev server + local backend) via Playwright: confirmed all three paid buttons render "Coming Soon" and are truly `disabled` (not just styled to look disabled), confirmed clicking one does not write to `localStorage` or navigate, confirmed the Free plan button is unaffected and still routes to `/register`, and confirmed normal registration (role picker, etc.) renders identically to Step 09.
- Committed and pushed to `main`.
- Deployed to Vercel (frontend-only change — Railway/backend required no redeploy since no backend file changed) and verified live.

**Rollback Instructions (to fully revert Step 10 and go back to Step 09's always-on paid flow):**
- Set `VITE_BILLING_ENABLED=true` in `frontend/.env.production` (and `frontend/.env` for local dev) and redeploy — this alone restores Step 09's exact behavior with no code changes needed.
- If removing the flag mechanism entirely is ever wanted instead of just flipping it: delete `frontend/src/lib/featureFlags.js`, remove its import and the `disabled`/label conditionals in `HomePage.jsx`'s `PricingSection` (revert the button to the Step 09 version), remove the `BILLING_ENABLED` check in `AuthContext.redirectAfterAuth` (revert to `const plan = getPendingPlan();`), and remove the `VITE_BILLING_ENABLED` lines from both `.env` files. Not recommended over just flipping the flag, but documented for completeness.

**Billing Status: IMPLEMENTED IN TEST MODE — TEMPORARILY DISABLED FOR PRODUCTION (user-facing paid flow only; backend and infrastructure remain fully live and testable directly).**

**No real money was processed at any point during the Test Mode phase (Steps 01–10).** Every Checkout session, subscription, and payment used Stripe's test-mode API keys and Stripe's standard test card (`4242 4242 4242 4242`); none of it touches a real bank account or a real customer's real card.

**Where we stopped — remaining steps before going Live:**
1. Decide on the production payment provider (see "Production Payment Provider Decision" below).
2. If Stripe is selected, determine the legally/business-eligible Stripe account setup for the chosen provider path.
3. Complete Stripe account/business verification (or the equivalent for whichever provider is chosen).
4. Configure Live-mode products/prices in Stripe (or the equivalent plan/price setup for the chosen provider).
5. Configure Live API keys (backend `STRIPE_SECRET_KEY`, frontend `VITE_STRIPE_PUBLISHABLE_KEY`) — replacing, not merging with, the current test-mode keys.
6. Configure the production webhook endpoint and its live-mode signing secret (`STRIPE_WEBHOOK_SECRET`).
7. Configure any other production environment variables the chosen provider requires.
8. Set `VITE_BILLING_ENABLED=true` to re-enable the user-facing flow.
9. Perform a complete live-mode verification pass (Tests A–F from Step 09's manual test plan, repeated against live keys with a real low-value card if possible, or at minimum a full dry run of the Checkout UI).
10. Confirm payout/bank settlement is configured (business/individual verification + bank account linked in the payment provider's dashboard) before considering the rollout complete.

**Production Payment Provider Decision:**
- Stripe is currently implemented and working in **Test Mode** — this is the architecture we're keeping.
- **Egypt is not currently listed by Stripe as a directly supported country** for opening a Stripe Payments account, so a direct live-mode Stripe account is not immediately available as-is.
- **Stripe Atlas** (forming a US company, then opening Stripe through that entity) is one possible route, but it carries real legal, business-registration, and tax implications that need to be evaluated deliberately — **not implemented, purchased, or started as part of this step.**
- **Egyptian payment providers** such as **Fawry** or **Paymob** are possible alternatives worth evaluating later for a more direct local-market fit.
- No assumption has been made about which provider will ultimately be used — this is purely a documented open decision for a future step, and no integration work toward any specific alternative provider has been started.

**Milestone 10 status: ✅ complete — paid rollout paused, all billing infrastructure preserved and confirmed still functional, deployed and verified live.**


