// Central switch for pausing the user-facing paid-subscription rollout
// without touching any of the underlying billing implementation (Stripe
// Checkout, webhooks, instructor-only enforcement, plan preservation, etc.
// all stay fully intact -- this only gates whether the UI is allowed to
// start a new checkout). Flip VITE_BILLING_ENABLED=true in frontend/.env
// (local) or frontend/.env.production (deployed) to resume the paid
// rollout -- see DevelopmentLogs/StripeIntegration.md for the full
// reactivation checklist. Defaults to disabled if unset.
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
