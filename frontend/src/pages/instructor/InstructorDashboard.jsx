import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { Plus, BookOpen, Clock, Award, Calendar, Trash2, TrendingUp, Users, Search, ChevronRight, QrCode, Copy, X, Eye, EyeOff, Edit, Download, Check } from 'lucide-react';
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
        className="relative bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-700/50 rounded-3xl p-7 max-w-sm w-full text-center shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]" 
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
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 h-14 rounded-2xl flex items-center justify-between px-5">
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
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs font-semibold active:scale-[0.98]"
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
        className="relative bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-700/50 rounded-3xl p-7 max-w-sm w-full text-center shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="h-14 w-14 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <Trash2 className="h-6 w-6 text-rose-500" />
        </div>
        
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Exam?</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          This will permanently delete <span className="text-rose-400 font-semibold">"{exam?.title}"</span> and all associated questions and student data.
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-slate-700/50"
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
     e.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalQuestions = exams.reduce((acc, curr) => acc + (curr._count?.questions || 0), 0);

  return (
    <div className="space-y-8 pb-20 max-w-5xl mx-auto animate-fade-in">

      {/* ─── Header Banner ─── */}
      <section className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700/80 transition-colors rounded-[1.5rem] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
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
          <div className="flex items-center gap-4 bg-white dark:bg-slate-950/40 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner w-full sm:w-auto justify-center">
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Exams</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{exams.length}</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
            
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

          <Link to="/exams/new" className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 w-full sm:w-auto shrink-0">
            <Plus className="h-5 w-5" />
            Create Exam
          </Link>
        </div>
      </section>

      {/* ─── Search ─── */}
      {exams.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search exams by name..." 
            className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-300 dark:border-slate-700 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* ─── Exam Cards ─── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-slate-50 dark:bg-slate-900/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const isArchived = new Date(exam.endTime) < new Date();
            const isManual = exam.showResults === 0;
            const isDelayed = exam.showResults === 2;
            const isPending = isDelayed && new Date() < new Date(exam.endTime);

            return (
              <div key={exam.id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all group">
                
                {/* Top Section */}
                <div className="space-y-3 mb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug truncate group-hover:text-indigo-300 transition-colors">
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
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isArchived ? 'Closed' : 'Active'}
                    </span>
                  </div>

                  {/* Questions count */}
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{exam._count?.questions || 0}</span> questions
                    {/* Results visibility indicator */}
                    <span className="mx-1 text-slate-800">·</span>
                    <span className={`flex items-center gap-1 ${
                      isManual ? 'text-rose-400' : isPending ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {isManual ? <EyeOff className="h-3 w-3" /> : isPending ? <Clock className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {isManual ? 'Results hidden' : isPending ? 'After deadline' : 'Results visible'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-800/50 pt-4">
                  <Link 
                    to={`/exams/${exam.id}/submissions`}
                    className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-white text-xs font-medium transition-all border border-slate-300 dark:border-slate-700 hover:border-indigo-500"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Grades
                  </Link>
                  <Link 
                    to={`/exams/${exam.id}/edit`}
                    className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-white text-xs font-medium transition-all border border-slate-300 dark:border-slate-700"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button 
                    onClick={() => setSelectedExamForQR(exam)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-all border border-slate-300 dark:border-slate-700 shrink-0"
                    title="Share Code & QR"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => handleToggleResults(exam.id, exam.title)}
                    className={`h-9 w-9 flex items-center justify-center rounded-lg transition-all border shrink-0 ${
                      isManual 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-slate-900 dark:text-white hover:border-rose-500' 
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-slate-900 dark:text-white hover:border-emerald-500'
                    }`}
                    title={isManual ? 'Publish Results' : 'Hide Results'}
                  >
                    {isManual ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button 
                    onClick={() => setExamToDelete(exam)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all shrink-0"
                    title="Delete Exam"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-14 text-center">
          <BookOpen className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {searchTerm ? 'No matches found' : 'No exams yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {searchTerm 
              ? 'Try adjusting your search term.' 
              : 'Create your first exam to get started.'
            }
          </p>
          {!searchTerm && (
            <Link to="/exams/new" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
              <Plus className="h-4 w-4" />
              Create Exam
            </Link>
          )}
        </div>
      )}

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
