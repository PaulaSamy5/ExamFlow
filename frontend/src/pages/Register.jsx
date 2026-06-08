import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2, ArrowRight, GraduationCap, ShieldCheck, ArrowLeft,
  Mail, User, Lock, Eye, EyeOff, Check, Camera, ImagePlus, KeyRound, Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FieldError, inputStateClass } from '../components/FieldError';

const Register = () => {
  const { register, verifyOTP, updateProfile, setOnboardingInProgress } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

  // Form Data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmBlurred, setConfirmBlurred] = useState(false);
  const [profileImage, setProfileImage] = useState('');
  const [otpCodes, setOtpCodes] = useState(Array(6).fill(''));

  // Inline validation errors
  const [errors, setErrors] = useState({});

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef(null);
  const otpRefs = useRef([]);

  // Password Validation
  const [criteria, setCriteria] = useState({ length: false, upper: false, lower: false, number: false, special: false });
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
    let score = 0;
    if (checks.length) score++;
    if (checks.upper || checks.lower) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    setStrength(score);
    if (Object.values(checks).every(Boolean)) {
      setErrors(p => p.password ? { ...p, password: '' } : p);
    }
  }, [password]);

  const isValidPassword = Object.values(criteria).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  // Show error only when the user has diverged (typed something that can't become a match)
  // or when they left the field without completing a match.
  const confirmDiverged = confirmPassword.length > 0 && !password.startsWith(confirmPassword);
  const showConfirmError = confirmDiverged || (confirmBlurred && confirmPassword.length > 0 && !passwordsMatch);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return toast.error("Image must be smaller than 2MB");
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const submitStep2 = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email address is required.';
    else if (!emailRegex.test(email.trim())) newErrors.email = 'Please enter a valid email address.';
    if (!isValidPassword) newErrors.password = 'Please meet all password requirements above.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (!passwordsMatch) { setConfirmBlurred(true); return; }
    setErrors({});

    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const result = await register(email, password, fullName, role, null, null); 
    
    if (result.success && result.verificationRequired) {
      setDirection(1);
      setStep(3);
    } else if (result.success) {
      // Very rare fallback if no verification required
      setDirection(1);
      setStep(4); 
    } else {
      toast.error(result.error || 'Unable to create account. Please try again.');
    }
    setLoading(false);
  };

  const nextStep = () => {
    if (step === 1) {
      const newErrors = {};
      if (!role) newErrors.role = 'Please select an account type.';
      if (!firstName.trim()) newErrors.firstName = 'First name is required.';
      if (!lastName.trim()) newErrors.lastName = 'Last name is required.';
      if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
      setErrors({});
      setDirection(1);
      setStep(2);
    } else if (step === 2) {
      submitStep2();
    } else if (step === 3) {
      handleVerify();
    } else if (step === 4) {
      handleComplete();
    }
  };

  const prevStep = () => {
    setDirection(-1);
    setStep(prev => prev - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextStep();
    }
  };

  // OTP Handling
  const handleOtpChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return;
    const newOtp = [...otpCodes];
    newOtp[index] = value;
    setOtpCodes(newOtp);
    if (value && index < 5) otpRefs.current[index + 1].focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCodes[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (otpCodes.every(v => v !== '')) handleVerify();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    if (pasteData) {
      const newOtp = [...otpCodes];
      for (let i = 0; i < pasteData.length; i++) newOtp[i] = pasteData[i];
      setOtpCodes(newOtp);
      if (pasteData.length === 6) otpRefs.current[5].focus();
      else otpRefs.current[pasteData.length].focus();
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const result = await register(email, password, fullName, role, null, null);
    if (result.success) {
      setOtpCodes(Array(6).fill(''));
      otpRefs.current[0]?.focus();
      toast.success('A new verification code has been sent to your email.');
    } else {
      toast.error(result.error || 'Failed to resend code. Please try again.');
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    const code = otpCodes.join('');
    if (code.length !== 6) return toast.error('Please enter the 6-digit code');
    setLoading(true);
    // Mark onboarding in progress BEFORE verify so route guard doesn't redirect
    setOnboardingInProgress(true);
    const result = await verifyOTP(email, code, true);
    if (result.success) {
      setDirection(1);
      setStep(4);
    } else {
      setOnboardingInProgress(false);
      toast.error(result.error || 'Invalid verification code');
    }
    setLoading(false);
  };

  const handleComplete = async () => {
    setLoading(true);
    await updateProfile(
      `${firstName.trim()} ${lastName.trim()}`,
      null,
      profileImage || null,
      null
    );
    setLoading(false);
    // Onboarding is done — clear the flag so route guard works normally
    setOnboardingInProgress(false);
    toast.success('Setup Complete! Welcome aboard. ✨');
    navigate('/dashboard');
  };

  const animationClass = direction === 1 ? 'animate-in fade-in slide-in-from-right-8' : 'animate-in fade-in slide-in-from-left-8';

  return (
    <div className="flex flex-col items-center justify-center p-4 overflow-hidden" style={{ minHeight: 'calc(100dvh - 120px)' }}>
      <div className="w-full max-w-[480px]">
        
        {/* Header */}
        <div className="text-center mb-6 space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {step === 1 && "Join ExamFlow"}
            {step === 2 && "Secure Account"}
            {step === 3 && "Verify Identity"}
            {step === 4 && "Final Polish"}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step === s ? 'w-8 bg-indigo-600 dark:bg-indigo-500' : step > s ? 'w-4 bg-emerald-500' : 'w-4 bg-slate-200 dark:bg-slate-800'}`} />
            ))}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_-4px_rgba(99,102,241,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-2xl relative overflow-hidden">
          
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className={`space-y-6 ${animationClass} duration-500`}>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">I am a</label>
                <div className={`grid grid-cols-2 gap-3 ${errors.role ? 'ring-2 ring-rose-500/30 rounded-2xl p-1' : ''}`}>
                  <button
                    type="button"
                    onClick={() => { setRole('STUDENT'); setErrors(p => ({ ...p, role: '' })); }}
                    className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all duration-300 ${
                      role === 'STUDENT'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:bg-white dark:hover:bg-slate-800/50 text-slate-500 scale-100'
                    }`}
                  >
                    <GraduationCap className={`w-8 h-8 transition-colors ${role === 'STUDENT' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="font-bold text-sm">Student</span>
                    {role === 'STUDENT' && <CheckCircleIcon />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRole('INSTRUCTOR'); setErrors(p => ({ ...p, role: '' })); }}
                    className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all duration-300 ${
                      role === 'INSTRUCTOR'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:bg-white dark:hover:bg-slate-800/50 text-slate-500 scale-100'
                    }`}
                  >
                    <ShieldCheck className={`w-8 h-8 transition-colors ${role === 'INSTRUCTOR' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="font-bold text-sm">Instructor</span>
                    {role === 'INSTRUCTOR' && <CheckCircleIcon />}
                  </button>
                </div>
                <FieldError message={errors.role} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${errors.firstName ? 'text-rose-500' : 'text-slate-500'}`}>First Name</label>
                  <div className="relative group">
                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${errors.firstName ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <input
                      autoFocus
                      type="text"
                      className={`w-full h-12 rounded-2xl pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all font-medium ${errors.firstName ? inputStateClass(true) + ' border' : 'bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 focus:border-indigo-400 focus:ring-indigo-500/10'}`}
                      placeholder="Jane"
                      value={firstName}
                      onChange={e => { setFirstName(e.target.value); if (errors.firstName) setErrors(p => ({ ...p, firstName: '' })); }}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <FieldError message={errors.firstName} />
                </div>
                <div className="space-y-1.5">
                  <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${errors.lastName ? 'text-rose-500' : 'text-slate-500'}`}>Last Name</label>
                  <div className="relative group">
                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${errors.lastName ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <input
                      type="text"
                      className={`w-full h-12 rounded-2xl pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all font-medium ${errors.lastName ? inputStateClass(true) + ' border' : 'bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 focus:border-indigo-400 focus:ring-indigo-500/10'}`}
                      placeholder="Doe"
                      value={lastName}
                      onChange={e => { setLastName(e.target.value); if (errors.lastName) setErrors(p => ({ ...p, lastName: '' })); }}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <FieldError message={errors.lastName} />
                </div>
              </div>

              <button
                onClick={nextStep}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/25 mt-4"
              >
                Continue <ArrowRight className="h-4.5 w-4.5" />
              </button>
            </div>
          )}

          {/* STEP 2: Account Info */}
          {step === 2 && (
            <div className={`space-y-5 ${animationClass} duration-500`}>
              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${errors.email ? 'text-rose-500' : 'text-slate-500'}`}>Email Address</label>
                <div className="relative group">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${errors.email ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    autoFocus
                    type="email"
                    className={`w-full h-12 rounded-2xl pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all font-medium ${errors.email ? inputStateClass(true) + ' border' : 'bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 focus:border-indigo-400 focus:ring-indigo-500/10'}`}
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                    onBlur={() => {
                      if (!email.trim()) return; // don't flag "required" on an untouched field
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(email.trim())) setErrors(p => ({ ...p, email: 'Please enter a valid email address.' }));
                    }}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <FieldError message={errors.email} />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${password && isValidPassword ? 'text-emerald-500' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                    <Lock className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`w-full h-12 bg-slate-50 dark:bg-slate-950/40 border rounded-2xl pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all font-medium ${password && isValidPassword ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10'}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                
                {/* Visual Strength Indicator */}
                <div className="flex gap-1.5 px-1 pt-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div key={level} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${strength >= level ? strength <= 2 ? 'bg-rose-500' : strength === 3 ? 'bg-amber-500' : 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  ))}
                </div>
                <FieldError message={errors.password} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
                <div className="relative group">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                    passwordsMatch ? 'text-emerald-500' : showConfirmError ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-indigo-500'
                  }`}>
                    <Lock className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className={`w-full h-12 bg-slate-50 dark:bg-slate-950/40 border rounded-2xl pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all font-medium ${
                      passwordsMatch
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                        : showConfirmError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 dark:border-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10'
                    }`}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmBlurred(true)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                {confirmPassword && (passwordsMatch || showConfirmError) && (
                  <p className={`text-xs ml-1 mt-1 font-medium transition-colors ${passwordsMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match.'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button onClick={prevStep} className="w-14 h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm">
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <button onClick={nextStep} disabled={loading} className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/25 disabled:opacity-50">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue <ArrowRight className="h-4.5 w-4.5" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: OTP Verification */}
          {step === 3 && (
            <div className={`space-y-8 text-center ${animationClass} duration-500`}>
              <div className="space-y-3">
                <div className="h-16 w-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
                  <KeyRound className="h-7 w-7 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Enter Verification Code</h2>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                    Sent to <strong className="text-slate-900 dark:text-white">{email}</strong>
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                {otpCodes.map((code, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    maxLength={1}
                    value={code}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-14 sm:w-12 sm:h-16 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xl font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
                  />
                ))}
              </div>

              <div className="flex gap-3">
                 <button onClick={prevStep} className="w-14 h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm">
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={handleVerify}
                  disabled={loading || otpCodes.some(c => !c)}
                  className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-bold flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-indigo-600/25"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify Code'}
                </button>
              </div>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Didn't receive it or code expired?{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors disabled:opacity-50"
                >
                  Resend code
                </button>
              </p>
            </div>
          )}

          {/* STEP 4: Profile Setup */}
          {step === 4 && (
            <div className={`space-y-8 ${animationClass} duration-500`}>
              
              <div className="flex flex-col items-center justify-center pt-4">
                <div className="relative group cursor-pointer mb-6" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-32 h-32 rounded-full border-4 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:border-indigo-500/50 transition-all">
                    {profileImage ? (
                      <img src={profileImage} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors flex flex-col items-center">
                        <Camera className="w-10 h-10 mb-1.5" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Upload Photo</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 group-hover:scale-110 transition-transform">
                    <ImagePlus className="w-4.5 h-4.5" />
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </div>

                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none text-center">
                  Welcome, {firstName.trim()}!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
                  Add a profile picture to personalize your account, or skip this step for now.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-bold flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-emerald-600/25 text-[15px]"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finish Setup"}
                </button>
                
                {!profileImage ? (
                  <button 
                    onClick={handleComplete} 
                    disabled={loading}
                    className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all text-sm"
                  >
                    Skip for now
                  </button>
                ) : (
                  <button 
                    onClick={() => setProfileImage('')} 
                    disabled={loading}
                    className="w-full h-12 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-rose-500 dark:text-rose-400 font-bold hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {step < 3 && (
          <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-wide">
              Log in instead
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

const CheckCircleIcon = () => (
  <div className="absolute top-2 right-2 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-full shadow-sm">
    <Check className="w-4 h-4 p-0.5 font-bold" />
  </div>
);

export default Register;
