import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../store/AuthContext';
import InstructorDashboard from './instructor/InstructorDashboard';
import StudentDashboard from './student/StudentDashboard';

const Dashboard = () => {
  const { user } = useAuth();
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

  if (!user) return <Navigate to="/login" replace />;

  // Admin users are redirected to the dedicated admin route
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;

  return user.role === 'INSTRUCTOR' ? <InstructorDashboard /> : <StudentDashboard />;
};

export default Dashboard;
