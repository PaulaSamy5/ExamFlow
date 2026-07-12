import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingInProgress, setOnboardingInProgress] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // ─── Role-based redirect helper ───
  const getRedirectPath = (role) => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'INSTRUCTOR') return '/instructor/dashboard';
    return '/student/dashboard';
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.requiresVerification) {
        return { success: true, verificationRequired: true, email: data.email };
      }
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      navigate(getRedirectPath(data.user.role));
      return { success: true };
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
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      navigate(getRedirectPath(data.user.role));
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
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
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
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      if (!skipNavigation) {
        navigate(getRedirectPath(data.user.role));
      }
      return { success: true, user: data.user };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Verification Failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = (redirectTo = '/', skipNavigation = false) => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
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
