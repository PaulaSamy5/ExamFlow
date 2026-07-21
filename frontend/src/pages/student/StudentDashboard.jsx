import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { PlayCircle, Clock, Award, History, TrendingUp, Search, GraduationCap, ChevronRight, FileCheck, ClipboardPaste, ScanLine, AlertCircle } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import QRScannerModal from '../../components/QRScannerModal';
import { AnimatePresence } from 'framer-motion';


const StudentDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode) return;
    setJoining(true);
    try {
      const { data } = await api.get(`/exams/access/${joinCode}`);
      toast.success(`Exam Found: ${data.title}`);
      navigate(`/exams/${data.id}`);
    } catch (err) {
      toast.error('Invalid access code. Please verify and try again.');
    } finally {
      setJoining(false);
    }
  };


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, subRes] = await Promise.all([
          api.get('/submissions/stats'),
          api.get('/submissions/my')
        ]);
        setStats(statsRes.data);
        setSubmissions(subRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const highlights = [
    { label: 'Exams Taken', value: stats?.examsTaken || 0, icon: History, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/20' },
    { label: 'Average Score', value: stats?.avgScore ? `${Math.round(stats.avgScore)}` : '—', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
    { label: 'Best Score', value: stats?.bestScore ? stats.bestScore : '—', icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
  ];

  const filteredSubmissions = (submissions || []).filter(s =>
    (s.examTitle || '').toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-5xl mx-auto">

      {/* ─── Greeting + Join Code ─── */}
      <section className="space-y-6">
        <div className="space-y-1 px-1">
          <p className="text-sm text-slate-500 font-medium">Welcome back,</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {user.name.split(' ')[0]} <span className="text-indigo-400">👋</span>
          </h1>
        </div>

        {/* Join Code Card */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 shadow-[0_2px_12px_-2px_rgba(99,102,241,0.08),0_1px_4px_-1px_rgba(0,0,0,0.04)] dark:shadow-none">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Enter your exam access code</p>
          <form onSubmit={handleJoinByCode} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowQRScanner(true)}
              className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 hover:bg-indigo-600 hover:border-indigo-500 active:scale-95 transition-all"
              title="Scan QR Code"
            >
              <ScanLine className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white" />
            </button>

            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Enter 6-digit code" 
                className="w-full h-11 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 pr-10 text-base font-semibold tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button 
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const clean = text.replace(/\D/g, '').slice(0, 6);
                    if (clean) {
                      setJoinCode(clean);
                      toast.success('Code pasted');
                    }
                  } catch (err) {
                    toast.error('Clipboard access denied');
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                title="Paste Code"
              >
                <ClipboardPaste className="h-4 w-4" />
              </button>
            </div>

            <button 
              type="submit" 
              disabled={joining || joinCode.length < 6}
              className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2 shrink-0 btn-lift"
            >
              <PlayCircle className="h-4 w-4" />
              {joining ? 'Joining...' : 'Join'}
            </button>
          </form>
        </div>
      </section>

      {/* ─── Stats Row ─── */}
      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        {highlights.map((item, i) => (
          <div key={i} className={`bg-white dark:bg-slate-900/50 border ${item.border} rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3.5 shadow-[0_1px_4px_rgba(99,102,241,0.06),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none`}>
            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
              <item.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.color}`} />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[9px] sm:text-[11px] font-medium text-slate-500 leading-none mb-1">{item.label}</p>
              <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-none">{item.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ─── History Section ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Exam History</h2>
          {submissions.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-32 sm:w-48 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 text-xs text-slate-600 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:focus:border-slate-700 shadow-sm dark:shadow-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 dark:bg-slate-900/40 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredSubmissions.length > 0 ? (
          <div className="space-y-2">
            {filteredSubmissions.map((sub) => {
              const releaseMode = sub.requireAIGradeApproval === 1 ? 'manual_review' 
                : (sub.showResults === 2 ? 'after_deadline' : (sub.showResults === 0 ? 'hidden' : 'immediate'));
              const resultsPending = releaseMode === 'after_deadline' && new Date() < new Date(sub.endTime);
              const isPendingGrading = sub.isPending || releaseMode === 'manual_review' || releaseMode === 'hidden' || resultsPending;
              const isTerminated = !!sub.terminationReason;

              return (
                <Link 
                  key={sub.id} 
                  to={`/submissions/${sub.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900/40 hover:bg-indigo-50/50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800/40 rounded-xl transition-all group card-interactive shadow-[0_1px_3px_rgba(99,102,241,0.05),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none gap-4"
                >
                  {/* Left Column: Icon + Title + Instructor */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                      isTerminated 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700/50 text-slate-500 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:text-white'
                    }`}>
                      {isTerminated ? (
                        <AlertCircle className="h-4.5 w-4.5" />
                      ) : (
                        <FileCheck className="h-4.5 w-4.5 transition-colors" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate group-hover:text-indigo-600 group-hover:text-indigo-300 transition-colors">
                        {sub.examTitle}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                        Instructor: <span className="text-slate-700 dark:text-slate-300 font-semibold">{sub.instructorName || 'Unknown'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Middle Column: Submission Date & Time */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-start gap-1.5 sm:gap-0.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {format(new Date(sub.submittedAt), 'MMM dd, yyyy')}
                    </span>
                    <span className="hidden sm:inline text-[10px] text-slate-400 font-medium">
                      at {format(new Date(sub.submittedAt), 'h:mm a')}
                    </span>
                    <span className="sm:hidden text-slate-300">·</span>
                    <span className="sm:hidden">
                      {format(new Date(sub.submittedAt), 'h:mm a')}
                    </span>
                  </div>

                  {/* Right Column: Grade + Status Badge + Chevron */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t border-slate-100 dark:border-slate-800/60 sm:border-0 pt-3 sm:pt-0">
                    <div className="flex items-center gap-3">
                      {/* Grade Info */}
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {isPendingGrading ? (
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Pending</span>
                          ) : (
                            <>
                              {sub.score} <span className="text-[10px] text-slate-500 font-medium">/ {sub.examTotalGrade} pts</span>
                            </>
                          )}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Final Grade</p>
                      </div>

                      {/* Status Badge */}
                      <div className="w-[90px] text-right">
                        {isTerminated ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                            Terminated
                          </span>
                        ) : isPendingGrading ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            Graded
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all hidden sm:block" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center shadow-sm dark:shadow-none">
            <AlertCircle className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No completed exams yet</p>
            <p className="text-xs text-slate-600 mt-1">Enter an access code above to start your first exam.</p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {showQRScanner && <QRScannerModal key="scanner" onClose={() => setShowQRScanner(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default StudentDashboard;
