import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import { FieldError, inputStateClass } from '../components/FieldError';

const ForgotPassword = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email address is required.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setIsSent(true);
      toast.success('Password reset link sent (if account exists)');
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Forgot Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSent
              ? "Check your email for the reset link."
              : "Enter your email and we'll send you a secure reset link."}
          </p>
        </div>

        {/* Form or Success State */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
          {isSent ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-indigo-500" />
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                We've sent a reset link to <strong className="text-indigo-600 dark:text-indigo-400">{email}</strong>.
              </p>
              <p className="text-sm text-slate-500">
                Please check your inbox and spam folders. The link is valid for 15 minutes.
              </p>
              <Link to="/login" className="block w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20">
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Email Address</label>
                <div className="relative group">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${emailError ? 'text-rose-400' : 'text-slate-500 group-focus-within:text-indigo-500'}`}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    id="forgot-email"
                    className={`w-full h-12 bg-white dark:bg-slate-950/40 border rounded-2xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${emailError ? inputStateClass(true) : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 focus:ring-indigo-500/10'}`}
                    placeholder="name@example.com"
                    autoFocus
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                    onBlur={() => {
                      if (!email.trim()) return;
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(email.trim())) setEmailError('Please enter a valid email address.');
                    }}
                  />
                </div>
                <FieldError message={emailError} />
              </div>

              <button
                type="submit"
                id="send-reset-btn"
                disabled={loading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        {/* Back link */}
        {!isSent && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Link to="/login" className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
