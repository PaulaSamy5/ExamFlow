# ExamFlow Billing/Subscription — Complete Testing Guide

This is a step-by-step checklist for manually verifying the entire Stripe billing integration (Milestones 1–5), covering the backend API, the frontend user flows, the database, the Stripe Dashboard, edge cases, and deployment. It reflects exactly what's implemented today — nothing aspirational.

**Production URLs:**
- Frontend: `https://exam-flow-psi-one.vercel.app`
- Backend: `https://examflow-production-7689.up.railway.app`
- Stripe Dashboard (test mode): `https://dashboard.stripe.com/test/dashboard`

For the full change history and per-milestone rollback instructions, see [`DevelopmentLogs/StripeIntegration.md`](./StripeIntegration.md) — this guide doesn't duplicate that; Phase 7 below points back to it.

---

## Phase 1 — Backend Verification

All routes are mounted at `/api/billing`. Get a bearer token by logging in through the UI and running `localStorage.getItem('token')` in the browser console, or via `POST /api/auth/login`.

### `GET /api/billing/status` (authenticated)
- **No token** → `401 {"error":"Unauthorized: No token provided"}`
- **Valid token, no subscription yet** → `200 {"plan":"FREE","status":"ACTIVE","currentPeriodEnd":null,"cancelAtPeriodEnd":false,"hasActiveSubscription":false}`
- **Valid token, active paid subscription** → `200 {"plan":"STARTER"|"PROFESSIONAL"|"BUSINESS","status":"ACTIVE","currentPeriodEnd":"<ISO date ~30 days out>","cancelAtPeriodEnd":false,"hasActiveSubscription":true}`
- **Valid token, canceled subscription (pending, not yet ended)** → `cancelAtPeriodEnd:true`, `status` still `"ACTIVE"` until the period actually ends

### `POST /api/billing/checkout` — body `{ "plan": "STARTER" }`
- **No token** → `401`
- **Invalid plan** (e.g. `"NOT_A_PLAN"` or `"FREE"`) → `400 {"error":"Invalid plan: ..."}`
- **Valid plan** → `200 {"url":"https://checkout.stripe.com/c/pay/cs_test_..."}`
- Common error: if this 500s with `"No Stripe price configured for plan..."`, the `STRIPE_PRICE_ID_*` env var for that plan is missing or wrong in whichever environment you're hitting.

### `POST /api/billing/change-plan` — body `{ "plan": "PROFESSIONAL" }`
- **User has no active subscription yet** → behaves like `/checkout`: `200 {"type":"checkout","url":"..."}`
- **User already on that exact plan** → `400 {"error":"Already on the PROFESSIONAL plan"}`
- **User has an active subscription on a different plan** → `200 {"type":"updated"}` (Stripe prorates immediately; the actual plan/status update lands moments later via webhook, not in this response)

### `POST /api/billing/cancel` (no body)
- **No active subscription** → `400 {"error":"No active subscription to cancel"}`
- **Active subscription** → `200 {"type":"canceled"}` — this sets `cancel_at_period_end`, it does **not** end the subscription immediately

### `POST /api/billing/resume` (no body)
- **No pending cancellation** → `400 {"error":"No pending cancellation to undo"}`
- **Subscription set to cancel at period end** → `200 {"type":"resumed"}`

### `GET /api/billing/invoices` (authenticated)
- Always `200 [...]` (empty array if no payments yet), sorted newest first. Each item: `{ id, stripeInvoiceId, amountPaid, currency, status, invoicePdfUrl, hostedInvoiceUrl, periodStart, periodEnd, createdAt }`.

### `POST /api/billing/webhook` (Stripe only — not for manual testing via curl unless you sign the payload)
- **No/bad `Stripe-Signature` header** → `400 {"error":"Webhook Error: ..."}`
- **Valid signature, new event** → `200 {"received":true,"duplicate":false,"type":"...","handled":true|false}` (`handled:false` means the event type isn't one we act on — still fine, still returns 200 so Stripe doesn't retry it forever)
- **Valid signature, event already processed before** (retried delivery) → `200 {"received":true,"duplicate":true,"type":"..."}`, no double-processing

### Common errors and what they mean
| Symptom | Meaning |
|---|---|
| `404 Cannot GET/POST ...` on a route that should exist | Railway hasn't deployed the latest commit yet — **this has happened repeatedly**, see Phase 6 |
| `500 Failed to ...` | Check server logs — usually a Stripe API error (bad price ID, expired test key) or a DB constraint violation |
| Whole API unreachable (`000`/timeout from curl) | Either Railway's free-tier "sleeping" cold start (wait ~30–60s, it wakes on request) or a genuine crash — check deploy logs for a clean `🚀 System Online` vs. an error partway through boot |
| `401` on a route you're sure you're logged in for | Token expired (1 day expiry) — log in again |

---

## Phase 2 — Frontend Verification

Test in an actual browser, ideally a fresh/incognito session for the logged-out steps.

1. **Visit the Landing Page** (`/`) logged out — Pricing section shows 4 real plan cards, buttons say "Get Started Free" / "Select Plan" (never "Coming Soon").
2. **Select each pricing plan:**
   - Free → goes straight to `/register`, no plan is remembered (Free never touches Stripe).
   - Starter / Professional / Business → goes to `/register`, and `localStorage.getItem('examflow_pending_plan')` should show the plan key.
3. **Redirect to Login if not authenticated** — this is implicit: selecting a plan sends you to `/register`, but if you instead manually go to `/login` and sign in with an *existing* account, the pending plan is still picked up (both `login()` and `verifyOTP()` check for it).
4. **Automatic redirect back to Stripe Checkout after login** — complete either the register/OTP flow or a plain login while a plan is pending in `localStorage` → you should land on a real `checkout.stripe.com` page, not the dashboard, and the pending plan should be cleared from `localStorage` afterward.
5. **Successful Checkout** — on Stripe's page, use test card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP → redirects to your dashboard with `?billing=success` briefly in the URL, a "Payment successful! Your plan will update in a moment" toast appears, then the param disappears from the URL bar.
6. **Cancelled Checkout** — on Stripe's page, click the back arrow (top-left) → redirects to your dashboard with a "Checkout canceled — your plan is unchanged" toast; your plan should be whatever it was before (unaffected).
7. **Failed Payment** — use decline test card `4000 0000 0000 0002` → Stripe shows the decline **on its own page**, you never leave Checkout; you can correct the card and retry, or back out (counts as a cancel).
8. **Returning from Stripe** — confirm in both the success and cancel cases that refreshing the dashboard afterward does *not* re-show the toast (the query param was stripped, not just hidden).
9. **Refreshing the page** — on `/profile`, refresh after any billing action; the Billing card re-fetches from the backend every mount, so it should always reflect the true current state, never a stale cached one.
10. **Logging out and back in** — plan/status should read identically after re-login (it's server state, not tied to the session).
11. **Upgrading plans** — from `/profile`, with an active paid subscription, click a higher plan in "Switch plan" → toast "Switched to the X plan", card updates within a couple seconds (webhook round-trip).
12. **Downgrading plans** — same mechanism, pick a lower plan — same toast/update behavior. (Note: Stripe prorates by default; it does not block or specially warn about downgrades.)
13. **Cancelling a subscription** — click "Cancel Subscription" → toast confirms, an amber "set to cancel" banner appears, the button becomes "Resume Subscription".
14. **Billing page updates** — every action above should update the card in place (no manual refresh needed) since each handler calls `load()` again on success.
15. **Profile badge updates** — ⚠️ **not applicable today.** There is no separate plan badge elsewhere (e.g. navbar) — plan/status is only shown on the Billing card itself. Don't expect anything to change outside `/profile`.
16. **Landing page plan updates** — ⚠️ **not applicable today.** Logged-in users never see the Landing Page at all (`HomePage` redirects them straight to their dashboard), so there's no "current plan" state to reflect there.

---

## Phase 3 — Database Verification

Tables: `Subscriptions` (one row per user, created on first plan change — no row means FREE), `Invoices` (one row per Stripe invoice), `SubscriptionEvents` (append-only webhook audit log, `stripeEventId` is `UNIQUE`).

### After creating a checkout session
Nothing new in `Subscriptions` yet beyond `stripeCustomerId` (set the *first* time any user starts a checkout, via `saveStripeCustomerId` — independent of whether they complete payment). No `Invoices`/`SubscriptionEvents` rows yet — those only appear once Stripe actually sends a webhook.

### After completing a payment (real test-card checkout)
- `Subscriptions`: `plan` = the purchased plan, `status = 'ACTIVE'`, `stripeSubscriptionId` and `stripePriceId` populated, `currentPeriodStart`/`currentPeriodEnd` ~30 days apart, `cancelAtPeriodEnd = 0`.
- `Invoices`: one new row, `amountPaid` matching the plan price, `status = 'paid'`, `hostedInvoiceUrl`/`invoicePdfUrl` populated.
- `SubscriptionEvents`: at least one row with `eventType IN ('checkout.session.completed','invoice.paid')`.

### After cancelling a subscription
- `Subscriptions`: `cancelAtPeriodEnd = 1`, `plan`/`status` **unchanged** (still `ACTIVE` — access continues until period end), `canceledAt` may be null until Stripe actually processes it depending on timing.
- `SubscriptionEvents`: new row, `eventType = 'customer.subscription.updated'`.

### After the subscription actually ends (period end reached, or immediate test cancellation)
- `Subscriptions`: `plan = 'FREE'`, `status = 'CANCELED'`, `stripePriceId = NULL`, `currentPeriodStart`/`End = NULL`, `canceledAt` populated.
- `SubscriptionEvents`: new row, `eventType = 'customer.subscription.deleted'`.

### After renewing (next billing cycle, or in test mode via Stripe's "advance test clock" feature if you set one up)
- `Subscriptions`: `currentPeriodStart`/`currentPeriodEnd` both advance by one period, `status` stays `ACTIVE`.
- `Invoices`: another new row for the new period's charge.
- `SubscriptionEvents`: new rows for `invoice.paid` and `customer.subscription.updated`.

### After any webhook execution, in general
Every processed event — handled or not — leaves exactly one row in `SubscriptionEvents`. If you re-send the exact same `event.id` (Stripe retries do this), **no second row appears** and no other table changes — that's the idempotency check working, not a bug.

**Quick query to check a specific user:**
```sql
SELECT * FROM Subscriptions WHERE userId = <id>;
SELECT * FROM Invoices WHERE userId = <id> ORDER BY createdAt DESC;
SELECT eventType, stripeEventId, createdAt FROM SubscriptionEvents WHERE userId = <id> ORDER BY createdAt DESC;
```

---

## Phase 4 — Stripe Dashboard Verification

Everything below is under **test mode** (`https://dashboard.stripe.com/test/...`).

| Where | What to expect |
|---|---|
| **Customers** (`/test/customers`) | One customer per user who has ever started a checkout, `email` matches the ExamFlow account, metadata has `userId` |
| **Product catalog** (`/test/products`) | Exactly 3 products: "ExamFlow Starter", "ExamFlow Professional", "ExamFlow Business" |
| **Prices** (inside each product) | One recurring monthly price each: $29 / $79 / $149 |
| **Subscriptions** (`/test/subscriptions`) | One per active (or previously active) paid user; status matches what's in your `Subscriptions` table; clicking in shows the current price/plan and next billing date |
| **Checkout Sessions** (`/test/payments` → filter, or via a subscription's history) | `mode: subscription`, `payment_status: paid` after a successful test-card checkout, `client_reference_id` = the ExamFlow user ID |
| **Events** (`/test/events`) | Full raw log of every Stripe event, including ones that failed delivery — use this to see the *exact* payload if a webhook handler behaves unexpectedly |
| **Webhooks** (`/test/webhooks`) | One endpoint registered at `.../api/billing/webhook`, listening for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` — click into it to see delivery attempts and their response codes (should be `200` for everything actually reaching your server) |

If a webhook delivery shows a non-200 response in the Stripe Dashboard, click it to see the exact error message ExamFlow's server returned — this is the fastest way to debug a webhook problem without needing server log access.

---

## Phase 5 — Edge Cases

| Scenario | Expected behavior |
|---|---|
| User closes the Stripe tab before paying | Nothing happens — no webhook ever fires, no `Subscriptions` row is created/changed, user is still on whatever plan they were on before |
| Refresh during checkout | Harmless — Checkout is Stripe's own page; refreshing reloads it, the session stays valid until it naturally expires (~24h) |
| Double-clicking "Subscribe"/"Select Plan" | On the Billing page, all plan buttons disable while one request is in flight (`actionPlan` state) — a second click can't fire. On the *logged-out* Landing Page, the click just saves to `localStorage` and navigates (no network call), so double-clicking is harmless there too |
| Opening multiple checkout tabs | Each click creates an independent Stripe Checkout Session — completing one doesn't invalidate the others, they just become unused/expired if not completed |
| Expired checkout session | Stripe shows its own "This link is no longer valid" page — the user needs to click the plan again from ExamFlow to get a fresh session |
| Logging in with another account (same browser) | ⚠️ Known limitation: `examflow_pending_plan` is a single `localStorage` key, not scoped per-user. If Account A selects a plan and then Account B logs in on the *same browser* before Account A ever authenticates, Account B will be the one who gets redirected to checkout for that plan. This mirrors how a single browser session naturally works and isn't a data leak (no billing changes happen without an explicit successful payment), but is worth being aware of on a shared/public computer |
| Browser refresh (general) | Every page re-fetches billing state from the server on mount — there is no client-side billing cache to go stale |
| Network interruption during a billing API call | The request fails, a toast shows the error, no partial state is written (each backend action is a single Stripe API call + the DB write only happens later via webhook) — safe to just retry |
| Webhook delay | The success toast is deliberately worded "will update in a moment," not "is now active" — if you check the Billing page in the first second or two after a successful payment, it may still briefly show the old plan until the webhook lands |
| Invalid webhook signature | Rejected with `400`, nothing is processed or written — verified directly with a deliberately bogus `Stripe-Signature` header |
| Duplicate webhook events (Stripe retries) | Detected via the `UNIQUE stripeEventId` constraint on `SubscriptionEvents` — the event is acknowledged but not reprocessed, confirmed with an identical-event-ID resend test both locally and in production |

---

## Phase 6 — Deployment Verification

### Before deploying (local)
- [ ] Backend boots cleanly (`node backend/server.js`) — watch for `✨ PostgreSQL Schema Ready.` with no errors
- [ ] Hit the changed/new endpoint(s) locally with curl or the browser console and confirm the expected response
- [ ] If a new required env var was added, confirm it's set in **both** `backend/.env` (or `frontend/.env`) locally **and** already added to Railway/Vercel's dashboard **before** pushing — this is the exact mistake that caused a full crash-loop in Milestone 2 (see `StripeIntegration.md` Step 04). Never push code that requires an env var Railway/Vercel doesn't have yet.

### Immediately after deploying
- [ ] Check GitHub's commit status checks (or just wait ~30–60s) for both Vercel and Railway
- [ ] **Proactively check for Railway's known webhook-staleness issue**: compare the commit shown as "ACTIVE" in Railway's Deployments tab against `git log -1` — if it's not the same commit, don't wait it out, go straight to Settings → Source → Disconnect → reconnect, then push an empty trigger commit (`git commit --allow-empty -m "..." && git push`). This has now happened on 3 separate milestones; treat it as expected, not exceptional.
- [ ] Hit a pre-existing, unrelated route (e.g. `GET /api/exams`) to confirm the server is up at all, separately from confirming the new route specifically

### On the production deployment
- [ ] Full authenticated round-trip through whichever endpoint(s) changed, with a throwaway test user — delete the test user and any rows it created immediately after
- [ ] Confirm the frontend bundle actually contains the new code (fetch the deployed `assets/index-*.js` and `grep` for a distinctive string from the change) — a successful Vercel build does not by itself prove the code you expect is what's live, since a stale cached bundle URL is possible in principle
- [ ] Re-run a couple of Phase 1 backend checks and a couple of Phase 2 frontend checks directly against production, not just locally

### Confirming correct environment variables
- Backend: Railway → service → **Variables** tab should have all of `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PROFESSIONAL`, `STRIPE_PRICE_ID_BUSINESS`, `STRIPE_WEBHOOK_SECRET` — compare against `backend/.env` locally to make sure they match (a stale/wrong value here fails silently as a Stripe API error, not a missing-var crash)
- Frontend: Vercel → project → **Settings → Environment Variables** should have `VITE_STRIPE_PUBLISHABLE_KEY` matching `frontend/.env.production`

### Confirming Stripe Webhooks work in the deployed environment
- Stripe Dashboard → **Webhooks** → the registered endpoint → check the "Recent deliveries" — every real checkout/cancel/etc. you test in production should show up here within a few seconds with a `200` response. A non-200 here means the deployed code isn't matching what you tested locally, or the deployed `STRIPE_WEBHOOK_SECRET` doesn't match what's registered.

---

## Phase 7 — Rollback Documentation

Per-change rollback instructions already live in [`DevelopmentLogs/StripeIntegration.md`](./StripeIntegration.md) — every "Step" entry there (one per prompt/milestone) has its own **Rollback Instructions** section listing exactly which files/routes/services to remove or revert, whether any database rollback is needed, and any Stripe-Dashboard-side cleanup (e.g. deleting a webhook endpoint). That file is the single source of truth for rollback — this testing guide intentionally doesn't duplicate it, to avoid the two documents drifting out of sync. If you need to roll back a specific milestone, find its "Step" entry there and follow its Rollback Instructions exactly.
