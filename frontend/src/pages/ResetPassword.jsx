import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Lock, Loader2, KeyRound, CheckCircle2, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';

const ResetPassword = () => {
  const location = useLocation();
  const tokenFromQuery = new URLSearchParams(location.search).get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Validation State
  const [criteria, setCriteria] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    const checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };
    setCriteria(checks);
    
    // Strength Calculation (matches Register logic approximately)
    let score = 0;
    if (checks.length) score++;
    if (checks.upper || checks.lower) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    setStrength(score);
  }, [password]);

  const isValidPassword = Object.values(criteria).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tokenFromQuery) {
      return toast.error('Missing reset token. Please request a new link.');
    }
    if (!isValidPassword) {
      return toast.error('Please meet all password requirements.');
    }
    if (!passwordsMatch) {
      return toast.error('Passwords do not match.');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: tokenFromQuery, newPassword: password });
      setIsSuccess(true);
      toast.success('Password updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Missing Token State ───
  if (!tokenFromQuery && !isSuccess) {
    return (
      <div className="min-h-[calc(100dvh-72px)] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="flex justify-center mb-4">
            <div className="bg-red-500/10 p-4 rounded-2xl">
              <KeyRound className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invalid Reset Link</h2>
          <p className="text-slate-600 dark:text-slate-400">
            This password reset link is invalid or missing the required security token.
          </p>
          <Link 
            to="/forgot-password" 
            className="block w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold flex items-center justify-center transition-all shadow-lg shadow-indigo-600/20"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  // ─── Success State ───
  if (isSuccess) {
    return (
      <div className="min-h-[calc(100dvh-72px)] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[440px] space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-emerald-500 p-3 rounded-2xl shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Password Updated</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your password has been changed successfully.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              You can now sign in with your new password.
            </p>
            <Link 
              to="/login" 
              className="block w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Reset Form ───
  return (
    <div className="min-h-[calc(100dvh-72px)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[440px] space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-500/20">
              <KeyRound className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Create New Password
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Please enter your secure new password below.
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              
            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">New Password</label>
              <div className="relative group">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                  password && isValidPassword ? 'text-emerald-500' : 'text-slate-500 group-focus-within:text-indigo-400'
                }`}>
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full h-12 bg-white dark:bg-slate-950/40 border rounded-2xl pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none transition-all ${
                    password && isValidPassword 
                      ? 'border-emerald-500/50 focus:border-emerald-500' 
                      : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'
                  }`}
                  placeholder="••••••••"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              <div className="flex gap-1.5 mt-2.5 px-1">
                {[1, 2, 3, 4].map((level) => (
                  <div 
                    key={level} 
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      strength >= level 
                        ? strength <= 2 ? 'bg-rose-500' : strength === 3 ? 'bg-amber-500' : 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`} 
                  />
                ))}
              </div>

              {/* Password Criteria Checklist */}
              <div className="mt-4 p-4 rounded-xl bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50">
                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Requirements</p>
                <ul className="space-y-1.5">
                  <CriterionItem label="At least 8 characters" met={criteria.length} />
                  <CriterionItem label="One uppercase letter" met={criteria.upper} />
                  <CriterionItem label="One lowercase letter" met={criteria.lower} />
                  <CriterionItem label="One number" met={criteria.number} />
                  <CriterionItem label="One special character" met={criteria.special} />
                </ul>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Confirm Password</label>
              <div className="relative group">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                  confirmPassword ? (passwordsMatch ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-500 group-focus-within:text-indigo-400'
                }`}>
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`w-full h-12 bg-white dark:bg-slate-950/40 border rounded-2xl pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none transition-all ${
                    confirmPassword 
                      ? (passwordsMatch ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-rose-500/50 focus:border-rose-500') 
                      : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'
                  }`}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                  tabIndex="-1"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Confirm Password Feedback */}
              {confirmPassword && (
                <p className={`text-xs ml-1 mt-1 font-medium transition-colors ${passwordsMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !isValidPassword || !passwordsMatch}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 mt-2"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Updating...</>
              ) : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Helper component for criteria list items
const CriterionItem = ({ label, met }) => (
  <li className="flex items-center gap-2 text-sm transition-colors duration-300">
    <div className={`flex items-center justify-center w-4 h-4 rounded-full border ${
      met 
        ? 'bg-emerald-500 border-emerald-500 text-white' 
        : 'border-slate-300 dark:border-slate-600 text-transparent'
    }`}>
      <Check className="w-3 h-3" />
    </div>
    <span className={met ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}>
      {label}
    </span>
  </li>
);

export default ResetPassword;
