import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, LogOut, Layout, User, BookOpen, PlusCircle, Sparkles, Menu, X } from 'lucide-react'
import { useAuth } from './store/AuthContext'
import { useTheme } from './store/ThemeContext'
import { Toaster } from 'react-hot-toast'

import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import HomePage from './pages/HomePage'
import CreateExam from './pages/instructor/CreateExam'
import ExamDetail from './pages/student/ExamDetail'
import ExamSession from './pages/student/ExamSession'
import ExamResult from './pages/student/ExamResult'
import ExamSubmissions from './pages/instructor/ExamSubmissions'
import ExamJoin from './pages/student/ExamJoin'
import AdminDashboard from './pages/admin/AdminDashboard'
import ProfileSettings from './pages/ProfileSettings'
import PrintableExamView from './pages/instructor/PrintableExamView'
import ScrollToTopButton from './components/ScrollToTop'
import { trackPageView } from './lib/analytics'


function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
    // Track page view on route change
    trackPageView(pathname);
  }, [pathname]);

  return null;
}


function App() {
  const { user, logout, loading, onboardingInProgress } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isHomePage = location.pathname === '/';
  const isPrintPage = location.pathname.includes('/print');

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Delay clearing the session until after the animation finishes.
    setTimeout(() => {
      // Navigate to the public landing page first to avoid triggering protected route guards.
      navigate('/');
      // Clear the session on the next tick once navigation has initiated.
      setTimeout(() => {
        logout('/', true);
        setIsLoggingOut(false);
      }, 50);
    }, 800);
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500/30">
      <ScrollToTop />
      <Toaster position="top-right" reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: theme === 'dark' ? {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          } : {
            background: '#ffffff',
            color: '#1e1b4b',
            border: '1px solid hsl(237, 22%, 89%)',
            boxShadow: '0 4px 16px -2px rgba(99, 102, 241, 0.09), 0 2px 6px rgba(0,0,0,0.05)',
          },
        }}
      />
      
      {/* Top Navbar */}
      {!location.pathname.includes('/session') && !isPrintPage && (
        <nav className="sticky top-0 z-50 w-full bg-white/90 dark:bg-[#111827]/70 border-b border-slate-200/80 dark:border-indigo-500/10 backdrop-blur-xl shadow-[0_1px_0_0_rgba(99,102,241,0.06),0_2px_10px_-2px_rgba(0,0,0,0.05)] dark:shadow-none transition-all duration-300">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="bg-indigo-600 p-1.5 rounded-lg group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-indigo-500/20">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">ExamFlow</span>
            </Link>

            {/* Desktop Navigation Menu (md and up) */}
            <div className="hidden md:flex items-center gap-2 sm:gap-4 lg:gap-6">
              {user ? (
                <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
                  {/* Dashboard Link for logged-in users */}
                  <Link
                    to={user.role === 'ADMIN' ? '/admin' : user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard'}
                    className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all px-3 sm:px-4 py-2 rounded-xl border ${(location.pathname.includes('/dashboard') || location.pathname === '/admin') ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400' : 'text-slate-500 border-transparent hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/80 dark:hover:bg-slate-800'}`}
                  >
                    <span className="hidden sm:inline">{user.role === 'ADMIN' ? 'Admin Console' : 'Control Panel'}</span>
                    <span className="sm:hidden">{user.role === 'ADMIN' ? 'Admin' : 'Panel'}</span>
                  </Link>

                  {/* Role Indicator */}
                  <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 dark:bg-white/5 rounded-full border border-indigo-100 dark:border-white/5">
                    <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${user.role === 'ADMIN' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : user.role === 'INSTRUCTOR' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`}></div>
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {user.role}
                    </span>
                  </div>
                  
                  {/* Divider */}
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-1"></div>

                  {/* User Profile Hook */}
                  <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight uppercase tracking-wide">{user.name}</p>
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-tight">Verified Academic</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-slate-800 h-10 w-10 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-slate-800 shadow-sm transition-all overflow-hidden">
                      {user.profileImage ? (
                        <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4 sm:pl-6">
                    <button
                      onClick={toggleTheme}
                      className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-slate-700"
                    >
                      {theme === 'dark' ? <Sun className="h-5 w-5 transition-transform group-hover:rotate-45" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="p-2.5 rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-all group"
                      title="Secure Sign Out"
                    >
                      <LogOut className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                  <Link to="/login" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 px-3 py-2 rounded-lg transition-all">Log in</Link>
                  <Link to="/register" className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 px-5 py-2.5 rounded-full transition-all active:scale-95">
                    Get Started Free
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Navigation Controls (md:hidden) */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent dark:hover:border-slate-700"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent dark:hover:border-slate-700"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className={`hamburger-icon ${isMobileMenuOpen ? 'is-open' : ''}`}>
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Panel — always rendered, animated via CSS class */}
          <div className={`md:hidden mobile-nav-drawer border-t border-slate-200/80 dark:border-indigo-500/10 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl${isMobileMenuOpen ? ' open' : ''}`}>
            <div className="mobile-nav-drawer-inner">
              <div className="mobile-nav-drawer-content px-4 py-6 space-y-6">
                {user ? (
                  <div className="space-y-6">
                    {/* User Profile Card */}
                    <Link to="/profile" className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                      <div className="bg-indigo-50 dark:bg-slate-800 h-12 w-12 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-slate-800 overflow-hidden shrink-0">
                        {user.profileImage ? (
                          <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white leading-tight uppercase tracking-wide truncate">{user.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${user.role === 'ADMIN' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : user.role === 'INSTRUCTOR' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`} />
                          <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{user.role}</span>
                        </div>
                      </div>
                    </Link>

                    {/* Navigation Buttons */}
                    <div className="space-y-2">
                      <Link
                        to={user.role === 'ADMIN' ? '/admin' : user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard'}
                        className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        {user.role === 'ADMIN' ? 'Admin Console' : 'Control Panel'}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full h-12 rounded-2xl border border-rose-200/50 dark:border-rose-500/10 bg-rose-50 dark:bg-rose-500/15 text-xs font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 transition-all hover:bg-rose-100 dark:hover:bg-rose-500/25"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Log In */}
                    <Link
                      to="/login"
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      Log in
                    </Link>
                    {/* Get Started Free CTA */}
                    <Link
                      to="/register"
                      className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white flex items-center justify-center transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20"
                    >
                      Get Started Free
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className={`flex-1 w-full ${isPrintPage ? '' : isHomePage ? 'pt-0 pb-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-24 sm:pb-32'}`}>




        <Routes>
          <Route path="/" element={!user ? <HomePage /> : <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard'} />} />
          <Route path="/dashboard" element={user ? <Navigate to={user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard'} replace /> : <Navigate to="/login" />} />
          <Route path="/student/dashboard" element={user && user.role === 'STUDENT' ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/instructor/dashboard" element={user && user.role === 'INSTRUCTOR' ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user && user.role === 'ADMIN' ? <AdminDashboard /> : <Navigate to="/login" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard'} />} />
          <Route path="/register" element={(!user || onboardingInProgress) ? <Register /> : <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : '/student/dashboard'} />} />
          <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
          <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/dashboard" />} />
          
          {/* Protected Routes */}
          <Route path="/exams/new" element={user && user.role === 'INSTRUCTOR' ? <CreateExam /> : <Navigate to="/login" />} />
          <Route path="/exams/:id/edit" element={user && user.role === 'INSTRUCTOR' ? <CreateExam /> : <Navigate to="/login" />} />
          <Route path="/exams/:id" element={user ? <ExamDetail /> : <Navigate to="/login" />} />
          <Route path="/session/:id" element={user ? <ExamSession /> : <Navigate to="/login" />} />
          <Route path="/exams/:id/submissions" element={user && user.role === 'INSTRUCTOR' ? <ExamSubmissions /> : <Navigate to="/login" />} />
          <Route path="/submissions/:id" element={user ? <ExamResult /> : <Navigate to="/login" />} />
          <Route path="/exams/join/:code" element={user ? <ExamJoin /> : <Navigate to="/login" />} />
          <Route path="/exams/:id/print" element={user && user.role === 'INSTRUCTOR' ? <PrintableExamView /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <ProfileSettings /> : <Navigate to="/login" />} />

          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>


      </main>
      
      {/* ─── Unified Premium Footer ─── */}
      {!location.pathname.includes('/session') && !isPrintPage && (
        <footer className="border-t border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-[#111827]/50 backdrop-blur-md mt-auto shadow-[0_-1px_0_0_rgba(99,102,241,0.05)] dark:shadow-none">
          <div className="max-w-7xl mx-auto px-6 py-12 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-10">
              
              <div className="flex flex-col items-center md:items-start gap-4 max-w-sm">
                <Link to="/" className="flex items-center gap-2.5 group">
                  <div className="bg-indigo-600 p-1.5 rounded-lg shadow-md shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
                    <Layout className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-extrabold tracking-tight text-xl text-slate-900 dark:text-white">ExamFlow</span>
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-left leading-relaxed">
                  Leading the future of academic evaluation with AI-powered semantic grading and seamless instructor workflows.
                </p>
              </div>

              <div className="flex flex-col items-center md:items-end gap-4 text-center md:text-right">
                <div className="flex items-center gap-1.5 text-indigo-500/80 dark:text-indigo-400/80">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Next-Gen Learning</span>
                </div>
                <div className="h-px w-12 bg-slate-200 dark:bg-white/10 hidden md:block" />
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px]">
                  Engineered for excellence in modern educational environments.
                </p>
              </div>

            </div>

            <div className="mt-12 pt-8 border-t border-slate-200/50 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              <p>© {new Date().getFullYear()} ExamFlow Platform. Developed by Paula Samy. All rights reserved.</p>
              <div className="flex gap-8">
                <a href="#" className="hover:text-indigo-500 transition-colors">Privacy</a>
                <a href="#" className="hover:text-indigo-500 transition-colors">Terms</a>
                <a href="#" className="hover:text-indigo-500 transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      )}

      {!isPrintPage && <ScrollToTopButton />}

      {/* Premium Fullscreen Logout Transition Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl animate-logout-fade">
          <div className="flex flex-col items-center space-y-7 animate-logout-scale text-center px-4">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-3xl blur-2xl opacity-30 animate-pulse" />
              <div className="h-20 w-20 rounded-[1.75rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center relative z-10 shadow-inner">
                <LogOut className="h-9 w-9 text-indigo-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white font-outfit tracking-tight leading-none">See you soon!</h2>
              <p className="text-[10px] font-black tracking-[0.2em] text-indigo-400/80 uppercase">
                Signing out securely...
              </p>
            </div>

            {/* Premium Linear Progress Loader */}
            <div className="h-[3px] w-36 bg-slate-800 rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full animate-loading-bar" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
