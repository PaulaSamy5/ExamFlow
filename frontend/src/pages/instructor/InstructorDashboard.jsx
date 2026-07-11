import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { Plus, BookOpen, Clock, Award, Calendar, Trash2, TrendingUp, Users, Search, ChevronRight, QrCode, Copy, X, Eye, EyeOff, Edit, Download, Check, Printer, Globe, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const QRModal = ({ exam, onClose }) => {
  const [copied, setCopied] = useState(false);
  const qrData = `${window.location.origin}/exams/join/${exam.accessCode}`;
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => document.body.style.overflow = 'unset';
  }, []);

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm p-4" 
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/50 rounded-3xl p-7 max-w-sm w-full text-center shadow-[0_16px_48px_-8px_rgba(99,102,241,0.18),0_8px_24px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Top gradient accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 opacity-80" />

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90">
          <X className="h-4 w-4" />
        </button>
        
        <div className="space-y-5 pt-1">
          <div>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1.5">Share Access</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate leading-tight">{exam.title}</h2>
          </div>

          <div className="bg-white p-4 rounded-2xl mx-auto w-fit shadow-sm border border-slate-100 dark:border-slate-200/10 flex items-center justify-center min-h-[208px] min-w-[208px]">
            <QRCodeCanvas 
              id="qr-canvas"
              value={qrData} 
              size={176} 
              level="H" 
            />
          </div>

          <div className="space-y-2.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Access Code</p>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 h-14 rounded-2xl flex items-center justify-between px-5 shadow-inner shadow-slate-100/80 dark:shadow-none">
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-[0.35em] leading-none select-all font-mono">{exam.accessCode || '000000'}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(exam.accessCode);
                  setCopied(true);
                  toast.success('Code copied');
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                  copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
                }`}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <button 
            onClick={() => {
              const canvas = document.getElementById('qr-canvas');
              if (canvas) {
                const url = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = url;
                a.download = `QR_${exam.title.replace(/\s+/g, '_')}.png`;
                a.click();
                toast.success('QR downloaded');
              } else {
                toast.error('Could not generate QR download');
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-xs font-semibold active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Download QR
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body

  );
};


const DeleteModal = ({ exam, onConfirm, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => document.body.style.overflow = 'unset';
  }, []);

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[1001] flex flex-col items-center justify-center w-full h-[100dvh] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm p-4" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/50 rounded-3xl p-7 max-w-sm w-full text-center shadow-[0_16px_48px_-8px_rgba(99,102,241,0.18),0_8px_24px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
          <Trash2 className="h-6 w-6 text-rose-600 dark:text-rose-500" />
        </div>
        
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Exam?</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          This will permanently delete <span className="text-rose-400 font-semibold">"{exam?.title}"</span> and all associated questions and student data.
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition-all border border-slate-200 dark:border-slate-700/50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-[0.98] shadow-lg shadow-rose-600/20"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};


const InstructorDashboard = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'online', 'printable'
  const [selectedExamForQR, setSelectedExamForQR] = useState(null);
  const [examToDelete, setExamToDelete] = useState(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const { data } = await api.get('/exams');
        setExams(data || []);
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.message || 'Unknown network error';
        toast.error(`Failed to load exams: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const confirmDelete = async () => {
    if (!examToDelete) return;
    
    try {
      await api.delete(`/exams/${examToDelete.id}`);
      toast.success('Exam deleted successfully');
      setExams(exams.filter(e => e.id !== examToDelete.id));
    } catch (err) {
      toast.error('Failed to delete exam');
    } finally {
      setExamToDelete(null);
    }
  };

  const handleToggleResults = async (id, title) => {
    try {
      const { data } = await api.patch(`/exams/${id}/toggle-results`);
      if (data.showResults) {
        toast.success(`Results published for "${title}"`, { icon: '📢' });
      } else {
        toast.success(`Results hidden for "${title}"`, { icon: '🔒' });
      }
      setExams(exams.map(e => e.id === id ? { ...e, showResults: data.showResults } : e));
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to toggle';
      toast.error(msg);
    }
  };

  const filteredExams = (exams || []).filter(e => 
     e.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const totalQuestions = exams.reduce((acc, curr) => acc + (curr._count?.questions || 0), 0);

  return (
    <div className="space-y-8 pb-20 max-w-5xl mx-auto animate-fade-in">

      {/* ─── Header Banner ─── */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_2px_12px_-2px_rgba(99,102,241,0.09),0_1px_4px_-1px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="absolute -top-12 -right-12 opacity-5 pointer-events-none">
          <BookOpen className="h-56 w-56 text-indigo-500 transform -rotate-12" />
        </div>
        
        <div className="relative z-10">
          <p className="text-sm text-indigo-400 font-semibold mb-1 uppercase tracking-widest">Instructor Dashboard</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Your Exams</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-sm">Manage your curriculum assessments and track student progress.</p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row md:flex-col lg:flex-row items-center gap-4">
          {/* Quick stats framed */}
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto justify-center">
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Exams</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{exams.length}</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Questions</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{totalQuestions}</p>
              </div>
            </div>
          </div>

          <Link to="/exams/new" className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 w-full sm:w-auto shrink-0 btn-lift">
            <Plus className="h-5 w-5" />
            Create Exam
          </Link>
        </div>
      </section>

      {/* ─── Search & Tabs ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Controls */}
        <div className="flex bg-slate-100/80 dark:bg-slate-900 p-1 rounded-2xl w-fit border border-slate-200 dark:border-slate-800/80 shadow-sm">
          {[
            { id: 'all', label: 'All Exams', count: exams.length },
            { id: 'online', label: 'Online Exams', count: exams.filter(e => e.examType !== 'PRINTABLE_ONLY').length },
            { id: 'printable', label: 'Printable Exams', count: exams.filter(e => e.examType === 'PRINTABLE_ONLY').length }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-white shadow-sm ring-1 ring-indigo-100 dark:ring-slate-700/30'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                activeTab === tab.id
                  ? 'bg-indigo-50 dark:bg-slate-700/60 text-indigo-600 dark:text-slate-300'
                  : 'bg-slate-200/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        {exams.length > 0 && (
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search exams by name..." 
              className="w-full h-11 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-10 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:focus:border-slate-700 shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Exam Cards ─── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-slate-50 dark:bg-slate-900/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (() => {
        const onlineExams = filteredExams.filter(e => e.examType !== 'PRINTABLE_ONLY');
        const printableExams = filteredExams.filter(e => e.examType === 'PRINTABLE_ONLY');

        const checkPrintableStatus = (exam) => {
          const meta = exam.examMeta || {};
          const questionCount = exam._count?.questions || 0;
          const hasMeta = (
            meta.institutionName?.trim() &&
            meta.departmentName?.trim() &&
            meta.courseName?.trim() &&
            meta.instructorName?.trim() &&
            meta.academicYear?.trim() &&
            meta.examDate &&
            meta.examCategory
          );
          if (!hasMeta) return 'MISSING_INFO';
          if (questionCount === 0) return 'VALIDATION_ERRORS';
          return 'READY';
        };

        return (
          <div className="space-y-10">
            {/* Online Exams Section */}
            {(activeTab === 'all' || activeTab === 'online') && (
              <div>
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                  <Globe className="h-5 w-5 text-indigo-500" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Online Exams</h2>
                  <span className="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-200 dark:border-indigo-500/20">
                    {onlineExams.length}
                  </span>
                </div>
                
                {onlineExams.length === 0 ? (
                  searchTerm.trim() ? (
                    /* Search returned no results */
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 shadow-sm dark:shadow-none">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No online exams match your search</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">No results for &ldquo;<span className="font-medium text-slate-600 dark:text-slate-400">{searchTerm}</span>&rdquo;</p>
                      </div>
                      <button
                        onClick={() => setSearchTerm('')}
                        className="shrink-0 text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    /* No exams exist at all */
                    <div className="flex items-center gap-4 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 shadow-sm dark:shadow-none">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Globe className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No online exams yet</p>
                        <p className="text-xs text-slate-500 mt-0.5">You haven&rsquo;t created any online exams yet.</p>
                      </div>
                      <Link
                        to="/exams/new"
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                        Create
                      </Link>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {onlineExams.map((exam) => {
                      const isArchived = new Date(exam.endTime) < new Date();
                      const isManual = exam.showResults === 0;
                      const isDelayed = exam.showResults === 2;
                      const isPending = isDelayed && new Date() < new Date(exam.endTime);

                      return (
                        <div key={exam.id} className={`bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60 dark:hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between group card-interactive shadow-[0_1px_4px_rgba(99,102,241,0.06),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none ${isArchived ? 'exam-closed' : ''}`}>
                          {/* Top Section */}
                          <div className="space-y-3 mb-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    <Globe className="h-2.5 w-2.5" />
                                    Online Exam
                                  </span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                  {exam.title}
                                </h3>
                                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {exam.startTime ? format(new Date(exam.startTime), 'MMM dd, yyyy') : 'No date'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {exam.duration}m
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Award className="h-3 w-3" />
                                    {exam.totalGrade} pts
                                  </span>
                                </div>
                              </div>
                              <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                                isArchived
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                              }`}>
                                {isArchived ? 'Closed' : 'Active'}
                              </span>
                            </div>

                            {/* Questions count */}
                            <div className="flex items-center gap-2 text-[12px] text-slate-500">
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{exam._count?.questions || 0}</span> questions
                              {/* Results visibility indicator */}
                              <span className="mx-1 text-slate-805">·</span>
                              <span className={`flex items-center gap-1 ${
                                isManual ? 'text-rose-450' : isPending ? 'text-amber-400' : 'text-emerald-405'
                              }`}>
                                {isManual ? <EyeOff className="h-3 w-3" /> : isPending ? <Clock className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {isManual ? 'Results hidden' : isPending ? 'After deadline' : 'Results visible'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                            <Link
                              to={`/exams/${exam.id}/submissions`}
                              className="flex-1 min-w-[70px] h-9 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-600 text-slate-600 dark:text-slate-300 hover:text-white text-xs font-medium transition-all border border-slate-200 dark:border-slate-700 hover:border-indigo-500 btn-lift"
                            >
                              <Users className="h-3.5 w-3.5" />
                              Grades
                            </Link>
                            <Link
                              to={`/exams/${exam.id}/edit`}
                              className="flex-1 min-w-[60px] h-9 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white text-xs font-medium transition-all border border-slate-200 dark:border-slate-700 btn-lift"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                            {!isArchived ? (
                              <>
                                <button
                                  onClick={() => setSelectedExamForQR(exam)}
                                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-white transition-all border border-slate-200 dark:border-slate-700 shrink-0 btn-lift"
                                  title="Share Code & QR"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleToggleResults(exam.id, exam.title)}
                                  className={`h-9 w-9 flex items-center justify-center rounded-lg transition-all border shrink-0 btn-lift ${
                                    isManual 
                                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-500' 
                                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500'
                                  }`}
                                  title={isManual ? 'Publish Results' : 'Hide Results'}
                                >
                                  {isManual ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 shrink-0 opacity-50 cursor-not-allowed" title="Closed">
                                  <QrCode className="h-3.5 w-3.5 text-slate-400" />
                                </div>
                                <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 shrink-0 opacity-50 cursor-not-allowed" title="Closed">
                                  <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                                </div>
                              </>
                            )}
                            <button
                              onClick={() => setExamToDelete(exam)}
                              className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/20 transition-all shrink-0 btn-lift cursor-pointer"
                              title="Delete Exam"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Printable Exams Section */}
            {(activeTab === 'all' || activeTab === 'printable') && (
              <div>
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                  <Printer className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Printable Exams</h2>
                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-500/20">
                    {printableExams.length}
                  </span>
                </div>

                {printableExams.length === 0 ? (
                  searchTerm.trim() ? (
                    /* Search returned no results */
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 shadow-sm dark:shadow-none">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No printable exams match your search</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">No results for &ldquo;<span className="font-medium text-slate-600 dark:text-slate-400">{searchTerm}</span>&rdquo;</p>
                      </div>
                      <button
                        onClick={() => setSearchTerm('')}
                        className="shrink-0 text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    /* No exams exist at all */
                    <div className="flex items-center gap-4 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 shadow-sm dark:shadow-none">
                      <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center shrink-0">
                        <Printer className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No printable exams yet</p>
                        <p className="text-xs text-slate-500 mt-0.5">Create a paper-based exam for classroom printing.</p>
                      </div>
                      <Link
                        to="/exams/new"
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                        Create
                      </Link>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {printableExams.map((exam) => {
                      const status = checkPrintableStatus(exam);

                      return (
                        <div 
                          key={exam.id} 
                          className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60 border-l-4 border-l-emerald-400 dark:border-l-emerald-500 dark:hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between group card-interactive shadow-[0_1px_4px_rgba(99,102,241,0.06),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none transition-all"
                        >
                          {/* Top Section */}
                          <div className="space-y-4 mb-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    <Printer className="h-2.5 w-2.5" />
                                    Printable Exam
                                  </span>
                                  {status === 'READY' ? (
                                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                      Ready for PDF
                                    </span>
                                  ) : status === 'MISSING_INFO' ? (
                                    <span className="flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                                      Missing Info
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                                      Validation Errors
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                  {exam.title}
                                </h3>
                              </div>
                              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-500 shrink-0">
                                <FileText className="h-5 w-5" />
                              </div>
                            </div>

                            {/* Metadata grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/40">
                              <div className="truncate">
                                <strong className="text-slate-400">Course:</strong> {exam.examMeta?.courseName || '—'}
                              </div>
                              <div className="truncate">
                                <strong className="text-slate-400">Category:</strong> {exam.examMeta?.examCategory || '—'}
                              </div>
                              <div className="truncate">
                                <strong className="text-slate-400">Inst:</strong> {exam.examMeta?.institutionName || '—'}
                              </div>
                              <div className="truncate">
                                <strong className="text-slate-400">Date:</strong> {exam.examMeta?.examDate ? format(new Date(exam.examMeta.examDate), 'MMM dd, yyyy') : '—'}
                              </div>
                            </div>

                            {/* Info footer */}
                            <div className="flex items-center gap-3 text-[12px] text-slate-500">
                              <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                                <FileText className="h-3.5 w-3.5 text-slate-405" />
                                {exam._count?.questions || 0} Questions
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Award className="h-3.5 w-3.5 text-slate-405" />
                                {exam.totalGrade} pts
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                            <Link
                              to={`/exams/${exam.id}/print`}
                              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tracking-wide transition-all btn-lift cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Preview & Print
                            </Link>
                            <Link
                              to={`/exams/${exam.id}/edit`}
                              className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white text-xs font-medium transition-all border border-slate-200 dark:border-slate-700 btn-lift"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              onClick={() => setExamToDelete(exam)}
                              className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/20 transition-all shrink-0 btn-lift cursor-pointer"
                              title="Delete Exam"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Overlays */}
      <AnimatePresence>
        {selectedExamForQR && (
          <QRModal 
            key="qr-modal"
            exam={selectedExamForQR} 
            onClose={() => setSelectedExamForQR(null)} 
          />
        )}
        
        {examToDelete && (
          <DeleteModal
            key="delete-modal"
            exam={examToDelete}
            onClose={() => setExamToDelete(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </div>

  );
};

export default InstructorDashboard;
