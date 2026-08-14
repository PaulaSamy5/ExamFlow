import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import { authStorage } from '../lib/authStorage';
import { getPendingPlan, clearPendingPlan } from '../lib/pendingPlan';

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
  // point a user becomes authenticated (login, instant-register, OTP verify).
  const redirectAfterAuth = async (role) => {
    const plan = getPendingPlan();
    if (!plan) {
      navigate(getRedirectPath(role));
      return;
    }
    clearPendingPlan();
    try {
      const { data } = await api.post('/billing/checkout', { plan });
      window.location.href = data.url; // external redirect to Stripe -- not a router navigation
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start checkout for the selected plan. You can try again from the Pricing page.');
      navigate(getRedirectPath(role));
    }
  };

  const login = async (email, password, remember = true) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.requiresVerification) {
        return { success: true, verificationRequired: true, email: data.email };
      }
      setUser(data.user);
      authStorage.setSession(data.user, data.token, remember);
      await redirectAfterAuth(data.user.role);
      return { success: true, user: data.user };
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
      await redirectAfterAuth(data.user.role);
      return { success: true };
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
    <AuthContext.Provider value={{ user, loading, onboardingInProgress, setOnboardingInProgress, login, register, updateProfile, verifyOTP, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
