// Remembers a plan selected on the Landing Page pricing cards across the
// login/register/OTP-verify flow, so the user lands on Stripe Checkout
// automatically right after authenticating instead of the dashboard.
const KEY = 'examflow_pending_plan';

export const savePendingPlan = (plan) => localStorage.setItem(KEY, plan);
export const getPendingPlan = () => localStorage.getItem(KEY);
export const clearPendingPlan = () => localStorage.removeItem(KEY);
