// Remembers a plan selected on the Landing Page pricing cards across the
// login/register/OTP-verify flow, so the user lands on Stripe Checkout
// automatically right after authenticating instead of the dashboard.
const KEY = 'examflow_pending_plan';

export const savePendingPlan = (plan) => localStorage.setItem(KEY, plan);
export const getPendingPlan = () => localStorage.getItem(KEY);
export const clearPendingPlan = () => localStorage.removeItem(KEY);

// One-shot marker read by Dashboard.jsx to show the "instructors only" toast
// after a non-instructor logs in with a plan pending. sessionStorage (not a
// ?billing= query param) on purpose: the redirect that follows login races
// against App.jsx's own /login route guard (both fire a SPA navigation to the
// dashboard within the same tick), and whichever wins last drops any query
// string the other one attached. A storage flag survives that race since
// neither navigation touches it.
const INSTRUCTOR_ONLY_FLAG_KEY = 'examflow_billing_instructor_only_flag';

export const flagInstructorOnlyBlock = () => sessionStorage.setItem(INSTRUCTOR_ONLY_FLAG_KEY, '1');
export const consumeInstructorOnlyFlag = () => {
  const flagged = sessionStorage.getItem(INSTRUCTOR_ONLY_FLAG_KEY) === '1';
  if (flagged) sessionStorage.removeItem(INSTRUCTOR_ONLY_FLAG_KEY);
  return flagged;
};
