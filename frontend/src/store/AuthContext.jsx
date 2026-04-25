import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.requiresVerification) {
        return { success: true, verificationRequired: true, email: data.email };
      }
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      navigate('/');
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || (err.request ? 'Connection refused. Ensure the backend on port 5000 is spinning.' : 'Login session failed: ' + err.message);
      return { success: false, error: errorMessage, verificationRequired: err.response?.data?.requiresVerification, email: err.response?.data?.email };
    }
  };

  const register = async (email, password, name, role) => {
    try {
      const { data } = await api.post('/auth/register', { email, password, name, role });
      if (data.requiresVerification) {
        return { success: true, verificationRequired: true, email: data.email };
      }
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      navigate('/');
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || (err.request ? 'Server is unreachable. Please check your connection or port 5000 status.' : 'Registration failed: ' + err.message);
      return { success: false, error: errorMessage };
    }
  };

  const verifyOTP = async (email, code) => {
    try {
      const { data } = await api.post('/auth/verify', { email, code });
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      navigate('/');
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Verification Failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const devLogin = async (role) => {
    if (!import.meta.env.DEV) return;
    
    const targetEmail = role === 'INSTRUCTOR' ? 'paulasamy52@gmail.com' : 'paulasamy344@gmail.com';
    
    try {
      const { data } = await api.post('/auth/dev-login', { email: targetEmail });
      
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      
      // Force a full reload to ensure app fully resets state for the new user
      window.location.href = '/';
    } catch (err) {
      alert('Dev login failed: ' + (err.response?.data?.error || err.message) + '. Is the user in the database?');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOTP, logout, devLogin }}>
      {!loading && children}
    </AuthContext.Provider>

  );
};

export const useAuth = () => useContext(AuthContext);
