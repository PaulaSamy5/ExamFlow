import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { Link } from 'react-router-dom';
import { Loader2, ArrowRight, GraduationCap, ShieldCheck, KeyRound, ArrowLeft, Mail, User, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState(0);

  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const { register, verifyOTP } = useAuth();

  useEffect(() => {
    let score = 0;
    if (password.length > 7) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    setStrength(score);
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (strength < 2) return toast.error('Password is too weak. Please use at least 8 characters.');
    if (password !== confirmPassword) return toast.error('Passwords do not match.');
    
    setLoading(true);
    const fullName = `${firstName} ${lastName}`.trim();

    const result = await register(email, password, fullName, role);
    if (result.success && result.verificationRequired) {
      toast.success('Verification code dispatched to your email');
      setIsVerifying(true);
    } else if (result.success) {
      toast.success(`Welcome, ${firstName}! Your account is ready.`);
    } else {
      toast.error(result.error || 'Unable to create account. Please try again.');
    }
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) return toast.error('Please enter the 6-digit code');
    setLoading(true);
    const result = await verifyOTP(email, otpCode);
    if (result.success) {
      toast.success('Email verified! Redirecting...');
    } else {
      toast.error(result.error || 'Invalid verification code');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-[calc(100dvh-72px)] flex flex-col items-center justify-center p-4">
      {/* Container - widened slightly for comfortable grid layout */}
      <div className="w-full max-w-[500px] space-y-6">

        {!isVerifying ? (
          <>
            <div className="text-center space-y-1">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Create Account</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Sign up and get started in seconds</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <form className="space-y-6" onSubmit={handleSubmit}>
                
                {/* Clean Role Switch - No heavy borders */}
                <div className="bg-white dark:bg-slate-950/60 p-1.5 rounded-2xl flex relative">
                  <button
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all z-10 ${
                      role === 'STUDENT' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <GraduationCap className="h-4.5 w-4.5" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('INSTRUCTOR')}
                    className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all z-10 ${
                      role === 'INSTRUCTOR' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <ShieldCheck className="h-4.5 w-4.5" />
                    Instructor
                  </button>
                </div>

                {/* Name Grid - side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">First Name</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <input
                        type="text"
                        className="w-full h-12 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                        placeholder="John"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Last Name</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <input
                        type="text"
                        className="w-full h-12 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                        placeholder="Doe"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <input
                      type="email"
                      className="w-full h-12 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Passwords Grid - side by side on desktop! */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Password</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                        <Lock className="h-4.5 w-4.5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="w-full h-12 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                        placeholder="••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
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
                              : 'bg-slate-100 dark:bg-slate-800'
                          }`} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Confirm Password</label>
                    <div className="relative group">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                        confirmPassword ? (password === confirmPassword ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-500 group-focus-within:text-indigo-400'
                      }`}>
                        <Lock className="h-4.5 w-4.5" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className={`w-full h-12 bg-white dark:bg-slate-950/40 border rounded-2xl pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none transition-all ${
                          confirmPassword 
                            ? (password === confirmPassword ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-rose-500/50 focus:border-rose-500') 
                            : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'
                        }`}
                        placeholder="••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
                        tabIndex="-1"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-slate-900 dark:text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 shadow-lg shadow-indigo-600/20"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      Create Account
                      <ArrowRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                Log in
              </Link>
            </p>
          </>
        ) : (
          /* Verification Step */
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="space-y-3">
              <div className="h-14 w-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20">
                <KeyRound className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Check your email</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  We sent a 6-digit code to:<br/>
                  <span className="text-slate-900 dark:text-white font-medium mt-1 block">{email}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                className="w-full h-14 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-2xl font-bold tracking-[0.5em] text-slate-900 dark:text-white focus:border-indigo-500/50 outline-none transition-all placeholder:tracking-normal placeholder:text-slate-600"
                placeholder="000000"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-slate-900 dark:text-white font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Complete Setup'}
              </button>
            </form>

            <button 
              onClick={() => setIsVerifying(false)}
              className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors mx-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to registration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
