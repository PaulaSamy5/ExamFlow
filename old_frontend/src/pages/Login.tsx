import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, UserPlus } from 'lucide-react';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const url = isLogin ? '/auth/login' : '/auth/register';
    const payload = isLogin ? { email, password } : { email, password, name, role };
    
    try {
      const { data } = await api.post(url, payload);
      login(data.token, data.user);
      navigate(data.user.role === 'INSTRUCTOR' ? '/instructor' : '/student');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md premium-card"
      >
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg">
             <LogIn className="text-white" size={24} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-slate-500 text-center mb-8">{isLogin ? 'Login to access your exams' : 'Join our exam platform today'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none" 
                  required
                />
              </div>
              <div className="flex gap-4 mb-2">
                <button 
                  type="button"
                  onClick={() => setRole('STUDENT')}
                  className={`flex-1 py-2 rounded-lg border transition-all ${role === 'STUDENT' ? 'bg-primary-50 border-primary-500 text-primary-700' : ''}`}
                >
                  Student
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('INSTRUCTOR')}
                  className={`flex-1 py-2 rounded-lg border transition-all ${role === 'INSTRUCTOR' ? 'bg-primary-50 border-primary-500 text-primary-700' : ''}`}
                >
                  Instructor
                </button>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none" 
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95">
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-primary-600 font-semibold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
