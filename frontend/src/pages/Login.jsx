import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { Link } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, User, Layout, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FieldError, inputStateClass } from '../components/FieldError';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const { login } = useAuth();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const clearError = (field) => setErrors(prev => ({ ...prev, [field]: '' }));

  const validateEmailOnBlur = (value) => {
    if (!value.trim()) return; // don't flag "required" on an untouched field
    if (!emailRegex.test(value.trim())) setErrors(p => ({ ...p, email: 'Please enter a valid email address.' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = { email: '', password: '' };

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      newErrors.password = 'Password is required.';
    }

    if (newErrors.email || newErrors.password) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    if (result && result.success) {
      const firstName = result.user?.name ? result.user.name.trim().split(/\s+/)[0] : '';
      if (firstName) {
        toast.success(`Welcome back, ${firstName}!`);
      } else {
        toast.success('Welcome back!');
      }
    } else {
      toast.error((result && result.error) || 'Login failed. Please check your credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4" style={{ minHeight: 'calc(100dvh - 120px)' }}>

      <div className="w-full max-w-[400px] space-y-6">

        {/* Header Section */}
        <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
                <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
                    <Layout className="h-6 w-6 text-white" />
                </div>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome Back</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to your ExamFlow account</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-[0_8px_32px_-4px_rgba(99,102,241,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-xl">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group">
                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${errors.email ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  className={`w-full h-11 bg-slate-50 dark:bg-slate-950/40 border rounded-xl pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${errors.email ? inputStateClass(true) : 'border-slate-200 dark:border-slate-800 focus:border-indigo-400 focus:ring-indigo-500/12'}`}
                  placeholder="name@example.com"
                  autoFocus
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError('email'); }}
                  onBlur={e => validateEmailOnBlur(e.target.value)}
                />
              </div>
              <FieldError message={errors.email} />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label htmlFor="login-password" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" state={{ email }} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-widest">
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${errors.password ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className={`w-full h-11 bg-white dark:bg-slate-950/40 border rounded-xl pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${errors.password ? inputStateClass(true) : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 focus:ring-indigo-500/10'}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError('password'); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-indigo-600/20 mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>Sign In <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
