import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import {
  User, Mail, Camera, Save, Lock, ImagePlus, Loader2, CheckCircle2, ShieldCheck, AtSign, Check, EyeOff, Eye, GraduationCap, Trash2, Play
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FieldError, inputStateClass } from '../components/FieldError';
import { useTour } from '../store/TourContext';

const ProfileSettings = () => {
  const { user, updateProfile } = useAuth();
  const { replayTour } = useTour();
  
  const [name, setName] = useState(user?.name || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  
  // Password Change State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const fileInputRef = useRef(null);

  // Validation State for Password
  const [criteria, setCriteria] = useState({ length: false, upper: false, lower: false, number: false, special: false });
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    if (!newPassword) {
      setStrength(0);
      return;
    }
    const checks = {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword)
    };
    setCriteria(checks);
    let score = 0;
    if (checks.length) score++;
    if (checks.upper || checks.lower) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    setStrength(score);
  }, [newPassword]);

  const isValidPassword = newPassword ? Object.values(criteria).every(Boolean) : true;
  const passwordsMatch = newPassword ? newPassword === confirmPassword : true;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return toast.error("Image must be smaller than 2MB");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Full name is required.');
      return;
    }
    if (showPasswordSection && (!isValidPassword || !passwordsMatch)) {
      return toast.error('Please resolve password errors before saving.');
    }

    setLoading(true);
    const result = await updateProfile(
      name.trim(),
      null, // Username removed
      profileImage,
      showPasswordSection && newPassword ? newPassword : null
    );

    if (result.success) {
      toast.success('Profile updated successfully!', { icon: '✨' });
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Profile Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your personal information, avatar, and security settings.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6" noValidate>
        
        {/* Main Grid container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Avatar Section - Left Column */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
            <div className="relative group cursor-pointer mt-4" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center transition-all group-hover:border-indigo-500/50">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <User className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border-4 border-white dark:border-slate-900">
                <Camera className="w-4 h-4" />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            
            <h3 className="mt-6 font-bold text-lg text-slate-900 dark:text-white">{name || 'Your Name'}</h3>
            <div className="flex items-center gap-1 mt-1 text-sm text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-3 py-1 rounded-full">
              {user?.role === 'INSTRUCTOR' ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> : <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />}
              <span className="font-medium tracking-wide uppercase text-[10px]">{user?.role}</span>
            </div>

            {profileImage && (
              <button 
                type="button"
                onClick={() => setProfileImage('')} 
                className="mt-4 text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Photo
              </button>
            )}
          </div>

          {/* Form Fields - Right Column */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Basic Info Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-3">Personal Details</h3>
              
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Email Address</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full h-12 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 text-sm text-slate-500 dark:text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 ml-2 mt-1">Email cannot be changed. This is your unique identifier.</p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">Full Name</label>
                  <div className="relative group">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${nameError ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <input
                      type="text"
                      className={`w-full h-12 bg-white dark:bg-slate-950/40 border rounded-2xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${nameError ? inputStateClass(true) : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 focus:ring-indigo-500/10'}`}
                      placeholder="Your Full Name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameError(''); }}
                    />
                  </div>
                  <FieldError message={nameError} />
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 transition-all">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Security</h3>
                <button 
                  type="button" 
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  {showPasswordSection ? 'Cancel Change' : 'Change Password'}
                </button>
              </div>

              {showPasswordSection && (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-slate-500 dark:text-slate-400 ml-1">New Password</label>
                      <div className="relative group">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                          newPassword && isValidPassword ? 'text-emerald-500' : 'text-slate-500 group-focus-within:text-indigo-400'
                        }`}>
                          <Lock className="h-4.5 w-4.5" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className={`w-full h-12 bg-white dark:bg-slate-950/40 border rounded-2xl pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none transition-all ${
                            newPassword && isValidPassword 
                              ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10' 
                              : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10'
                          }`}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
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
                      
                      {/* Password Checklist & Strength */}
                      {newPassword && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50">
                          <div className="flex gap-1.5 mb-3 px-1">
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
                          <ul className="space-y-1">
                            <CriterionItem label="8+ characters" met={criteria.length} />
                            <CriterionItem label="Uppercase letter" met={criteria.upper} />
                            <CriterionItem label="Lowercase letter" met={criteria.lower} />
                            <CriterionItem label="Number" met={criteria.number} />
                            <CriterionItem label="Special character" met={criteria.special} />
                          </ul>
                        </div>
                      )}
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
                              ? (passwordsMatch ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10' : 'border-rose-500/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10') 
                              : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10'
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
                      {confirmPassword && (
                        <p className={`text-[11px] ml-1 mt-1 font-medium transition-colors ${passwordsMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Replay Tour Card — Instructors only */}
            {user?.role === 'INSTRUCTOR' && (
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Onboarding Tour</h3>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Replay the getting-started walkthrough any time.</p>
                  </div>
                  <button
                    type="button"
                    onClick={replayTour}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all active:scale-95"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Replay Tour
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading || (showPasswordSection && (!isValidPassword || !passwordsMatch))}
                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

const CriterionItem = ({ label, met }) => (
  <li className="flex items-center gap-2 text-[12px] transition-colors duration-300">
    <div className={`flex items-center justify-center w-3.5 h-3.5 rounded-full border ${
      met 
        ? 'bg-emerald-500 border-emerald-500 text-white' 
        : 'border-slate-300 dark:border-slate-600 text-transparent'
    }`}>
      <Check className="w-2.5 h-2.5" />
    </div>
    <span className={met ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}>
      {label}
    </span>
  </li>
);

export default ProfileSettings;
