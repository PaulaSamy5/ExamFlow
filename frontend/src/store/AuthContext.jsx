import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import { authStorage } from '../lib/authStorage';
import { getPendingPlan, clearPendingPlan, flagInstructorOnlyBlock } from '../lib/pendingPlan';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingInProgress, setOnboardingInProgress] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = authStorage.getUser();
    const token = authStorage.getToken();
    if (savedUser && token) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  // ─── Role-based redirect helper ───
  const getRedirectPath = (role) => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'INSTRUCTOR') return '/instructor/dashboard';
    return '/student/dashboard';
  };

  // ─── Post-auth redirect: continue to Stripe Checkout if the user selected
  // a paid plan on the Landing Page before logging in/registering, otherwise
  // fall back to the normal role-based dashboard redirect. Called from every
  // point a user becomes authenticated (login, instant-register, OTP verify,
  // and the end of the registration wizard -- see Register.jsx).
  //
  // Subscriptions are instructor-only. A STUDENT (or any non-instructor) with
  // a pending plan gets sent to their normal dashboard, where Dashboard.jsx
  // shows a clear explanatory message -- NOT kept on the login page, because
  // App.jsx's own /login route guard (!user ? <Login/> : <Navigate/>)
  // redirects away the instant `user` is set, before any in-page "stay here"
  // state would ever render; fighting that guard isn't worth it when the
  // dashboard can carry the same message.
  //
  // That guard redirect and this function's own navigate() both fire off the
  // same `user` update, in a race that has no guaranteed winner -- so the
  // "show the instructor-only message" instruction is passed via a one-shot
  // sessionStorage flag (see pendingPlan.js) rather than a ?billing= query
  // param, since a query param attached by the loser of that race gets
  // silently dropped when the winner's bare-path navigation lands after it.
  //
  // The plan itself is NOT cleared, so it survives in case the same browser
  // later logs in with the correct instructor account. This is a UX nicety
  // only; the real enforcement is server-side (instructorOnly middleware on
  // the billing routes) since the frontend can never be trusted to gate this
  // on its own.
  const redirectAfterAuth = async (role) => {
    const plan = getPendingPlan();
    if (!plan) {
      navigate(getRedirectPath(role));
      return { blockedInstructorOnly: false };
    }
    if (role !== 'INSTRUCTOR') {
      flagInstructorOnlyBlock();
      navigate(getRedirectPath(role));
      return { blockedInstructorOnly: true };
    }
    clearPendingPlan();
    try {
      const { data } = await api.post('/billing/checkout', { plan });
      window.location.href = data.url; // external redirect to Stripe -- not a router navigation
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start checkout for the selected plan. You can try again from the Pricing page.');
      navigate(getRedirectPath(role));
    }
    return { blockedInstructorOnly: false };
  };

  const login = async (email, password, remember = true) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.requiresVerification) {
        return { success: true, verificationRequired: true, email: data.email };
      }
      setUser(data.user);
      authStorage.setSession(data.user, data.token, remember);
      const redirectResult = await redirectAfterAuth(data.user.role);
      return { success: true, user: data.user, ...redirectResult };
    } catch (err) {
      const errorMessage = err.response?.data?.error || (err.request ? 'Unable to reach the server. Please try again later.' : 'Login failed: ' + err.message);
      return { success: false, error: errorMessage, verificationRequired: err.response?.data?.requiresVerification, email: err.response?.data?.email };
    }
  };

  const register = async (email, password, name, role, username, profileImage) => {
    try {
      const { data } = await api.post('/auth/register', { email, password, name, role, username, profileImage });
      if (data.requiresVerification) {
        return { success: true, verificationRequired: true, email: data.email };
      }
      setUser(data.user);
      authStorage.setSession(data.user, data.token, true);
      const redirectResult = await redirectAfterAuth(data.user.role);
      return { success: true, ...redirectResult };
    } catch (err) {
      const errorMessage = err.response?.data?.error || (err.request ? 'Unable to reach the server. Please try again later.' : 'Registration failed: ' + err.message);
      return { success: false, error: errorMessage };
    }
  };

  const updateProfile = async (name, username, profileImage, newPassword) => {
    try {
      const { data } = await api.patch('/auth/profile', { name, username, profileImage, newPassword });
      setUser(data.user);
      authStorage.updateUser(data.user, data.token);
      return { success: true, user: data.user };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Profile update failed';
      return { success: false, error: errorMessage };
    }
  };

  const verifyOTP = async (email, code, skipNavigation = false) => {
    try {
      const { data } = await api.post('/auth/verify', { email, code });
      setUser(data.user);
      authStorage.setSession(data.user, data.token, true);
      if (!skipNavigation) {
        await redirectAfterAuth(data.user.role);
      }
      return { success: true, user: data.user };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Verification Failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = (redirectTo = '/', skipNavigation = false) => {
    setUser(null);
    authStorage.clearSession();
    if (!skipNavigation) {
      navigate(redirectTo);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, onboardingInProgress, setOnboardingInProgress, login, register, updateProfile, verifyOTP, logout, redirectAfterAuth }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
