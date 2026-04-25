import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { Link } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      toast.success(`Access Authorized. Welcome back!`);
    } else {
      toast.error(result.error || 'Identity Verification Failed. Check credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-[calc(100dvh-72px)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome Back</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Enter your credentials to access your account</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-6 sm:p-8 shadow-xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <input
                  type="email"
                  className="w-full h-11 bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-50 dark:bg-slate-900 transition-all"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Password</label>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full h-11 bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-12 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-50 dark:bg-slate-900 transition-all"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors rounded-lg"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 group-hover:border-slate-500'
                }`}>
                  {rememberMe && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-slate-900 dark:text-white"><path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:text-slate-300 transition-colors select-none">Remember me</span>
                <input type="checkbox" className="hidden" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
              </label>
              
              <button type="button" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-slate-900 dark:text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  Log In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Register
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Login;
