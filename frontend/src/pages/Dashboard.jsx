import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../store/AuthContext';
import { clearPendingPlan, consumeInstructorOnlyFlag } from '../lib/pendingPlan';
import InstructorDashboard from './instructor/InstructorDashboard';
import StudentDashboard from './student/StudentDashboard';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Stripe Checkout's success_url/cancel_url both land here with a ?billing=
  // param. The Subscriptions row itself is only ever updated by the webhook
  // (never trusted from this redirect alone), so on success this just tells
  // the user payment went through -- the plan reflects moments later once
  // the webhook lands, visible on the Billing page.
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (billing === 'success') {
      toast.success('Payment successful! Your plan will update in a moment.');
      setSearchParams(prev => { prev.delete('billing'); prev.delete('session_id'); return prev; }, { replace: true });
    } else if (billing === 'canceled') {
      toast('Checkout canceled — your plan is unchanged. You can try again anytime.', { icon: 'ℹ️' });
      setSearchParams(prev => { prev.delete('billing'); return prev; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Landed here because a non-instructor account logged in with a paid plan
  // pending (AuthContext.redirectAfterAuth flags this via sessionStorage,
  // not a ?billing= query param -- see pendingPlan.js for why). The plan
  // itself is still saved, so "sign in with a different account" resumes it
  // automatically for whoever logs in next.
  useEffect(() => {
    if (!user || !consumeInstructorOnlyFlag()) return;
    toast(
      (t) => (
        <div className="text-sm">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Instructor accounts only</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
            These plans are available for instructors only. Please sign in with an instructor account to subscribe.
          </p>
          <button
            className="text-xs font-bold text-indigo-500 hover:text-indigo-400 underline"
            onClick={() => {
              clearPendingPlan();
              toast.dismiss(t.id);
              // Hard redirect instead of an SPA navigate: logging out flips
              // `user` to null, which races App.jsx's own route guards for
              // this same path (see AuthContext.redirectAfterAuth) and can
              // strand the user on /login instead of the pricing page. A
              // full reload sidesteps that race entirely.
              logout('/', true);
              window.location.href = '/';
            }}
          >
            Sign in with a different account
          </button>
        </div>
      ),
      { duration: 10000, icon: '🔒' }
    );
  }, [user, logout]);

  if (!user) return <Navigate to="/login" replace />;

  // Admin users are redirected to the dedicated admin route
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;

  return user.role === 'INSTRUCTOR' ? <InstructorDashboard /> : <StudentDashboard />;
};

export default Dashboard;
