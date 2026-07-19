import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { 
  ChevronLeft, ChevronRight, Save, Send, AlertTriangle, 
  Clock, CheckCircle2, Circle, XCircle, LayoutList, Loader2, Sparkles, BookOpen, ShieldCheck, Timer, Code, AlertCircle, Info, CircleX, CheckSquare, Sigma
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import UMLCanvas from '../../components/UMLCanvas';
import MathEditor from '../../components/MathEditor';
import FormattedText from '../../components/FormattedText';

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/30' },
  { id: 'python', label: 'Python', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/30' },
  { id: 'cpp', label: 'C++', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-500/30' },
];

const detectCodeLanguage = (code) => {
  if (!code || code.trim().length < 5) return null;
  const c = code.toLowerCase();
  
  const patterns = {
    javascript: [
      'console.log', 'const ', 'let ', 'require(', 'await ', 'function', '=>',
      'import {', 'document.get', 'export ', 'Object.keys'
    ],
    python: [
      'print(', 'def ', 'import ', 'if __name__', 'elif ', 'class ', 'range(', 
      'for i in', 'lambda ', 'try:', 'except ', 'with open'
    ],
    cpp: [
      '#include', 'iostream', 'std::', 'using namespace', 'cout <<', 'cin >>', 
      'int main()', 'vector<', 'template <', 'public:', 'private:', 'endl;'
    ]
  };

  let counts = { javascript: 0, python: 0, cpp: 0 };
  
  for (const [lang, ps] of Object.entries(patterns)) {
    ps.forEach(p => {
      if (c.includes(p.toLowerCase())) counts[lang]++;
    });
  }

  const maxVal = Math.max(...Object.values(counts));
  if (maxVal === 0) return null;
  
  // Return the first one with max matches if more than 0
  return Object.keys(counts).find(lang => counts[lang] === maxVal);
};

const parseOptions = (options) => {
  if (!options) return {};
  if (typeof options === 'object') return options;
  try {
    return JSON.parse(options);
  } catch (e) {
    return {};
  }
};

const ExamSession = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState({}); 
  const [timeLeft, setTimeLeft] = useState(0); 
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState({}); // Stores selected language per coding question
  const [tabViolations, setTabViolations] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [terminationReason, setTerminationReason] = useState(null);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);

  const handleLaunch = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
    setHasLaunched(true);
  };
  const autoSaveTimerRef = useRef(null);
  const answersRef = useRef({});
  const submissionRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const selectedLangsRef = useRef({});
  const autoSubmitTriggeredRef = useRef(false);
  const intentionalExitRef = useRef(false);
  const MAX_TAB_VIOLATIONS = 3;

  // ── Prevent back-button re-entry after exam submission ──
  useEffect(() => {
    // Push a guard state so pressing back triggers popstate instead of leaving
    const guardBackNavigation = () => {
      window.history.pushState({ examGuard: true }, '');
    };

    const handlePopState = (e) => {
      // If user presses back while in exam, push state again to trap them
      // They can only leave via the submit flow
      if (!submission || submission.status === 'IN_PROGRESS') {
        guardBackNavigation();
      }
    };

    guardBackNavigation();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [submission]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data } = await api.get(`/submissions/${id}`);

        // ── CRITICAL: Block re-entry if exam is already submitted ──
        if (data.status === 'SUBMITTED') {
          toast('You have already submitted this exam.', { icon: '🔒', duration: 4000 });
          navigate('/', { replace: true });
          return;
        }

        setSubmission(data);
        
        const initialAnswers = {};
        const initialLangs = {};
        data.answers.forEach(a => {
            try {
              const parsed = JSON.parse(a.studentAnswer);
              if (parsed && typeof parsed === 'object' && 'code' in parsed) {
                initialAnswers[a.questionId] = parsed.code;
                initialLangs[a.questionId] = parsed.language;
              } else {
                initialAnswers[a.questionId] = a.studentAnswer;
              }
            } catch(e) {
              initialAnswers[a.questionId] = a.studentAnswer;
            }
        });

        // Set mandatory languages based on question requirements
        data.exam.questions.forEach(q => {
          if (q.type === 'CODING') {
            const ops = parseOptions(q.options);
            if (ops.requiredLanguage && ops.requiredLanguage !== 'any') {
              initialLangs[q.id] = ops.requiredLanguage;
            }
          }
        });

        setAnswers(initialAnswers);
        setSelectedLangs(initialLangs);

        const examDate = new Date(data.createdAt);
        const serverNowDate = new Date(data.serverNow);
        const durationSeconds = data.exam.duration * 60;
        
        // Use EXACT backend timeline to bypass any Windows/Browser timezone differences 
        // (SQL Server GETDATE() diff against the specific GETDATE() it used on creation)
        const elapsed = Math.floor((serverNowDate - examDate) / 1000);
        let remainingTime = durationSeconds - elapsed;

        // If the exam has a globally set end time, ensure the session cannot exceed it
        if (data.exam.endTime) {
            const closingDate = new Date(data.exam.endTime);
            const timeUntilClose = Math.floor((closingDate - serverNowDate) / 1000);
            if (timeUntilClose > 0) {
               remainingTime = Math.min(remainingTime, timeUntilClose);
            } else {
               remainingTime = 0; // Exam has ended entirely
            }
        }

        setTimeLeft(Math.max(0, remainingTime));

        setLoading(false);
      } catch (err) {
        toast.error('Session access denied');
        navigate('/', { replace: true });
      }
    };
    initSession();
    return () => clearInterval(autoSaveTimerRef.current);
  }, [id, navigate]);

  // ── Keep refs synced with state for stale-closure-safe callbacks ──
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { submissionRef.current = submission; }, [submission]);
  useEffect(() => { isSubmittingRef.current = isSubmitting; }, [isSubmitting]);
  useEffect(() => { selectedLangsRef.current = selectedLangs; }, [selectedLangs]);

  // ── Countdown timer ──
  useEffect(() => {
    if (timeLeft <= 0 || loading) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Defer auto-submit out of setState updater to avoid stale closure
          setTimeout(() => handleAutoSubmit(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, loading]);

  // ── Tab/Window focus detection (anti-cheat) ──
  useEffect(() => {
    if (loading || !submission || submission.status !== 'IN_PROGRESS' || !hasLaunched || terminationReason) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations(prev => {
          const next = prev + 1;
          if (next >= MAX_TAB_VIOLATIONS) {
            const reason = 'You switched to another browser tab.';
            setTerminationReason(reason);
            toast.error('Maximum tab switches reached. Auto-submitting your exam.', { duration: 5000, icon: '🚫' });
            setTimeout(() => {
              if (!autoSubmitTriggeredRef.current) {
                autoSubmitTriggeredRef.current = true;
                processSubmission(true, reason);
              }
            }, 800);
          } else {
            setShowTabWarning(true);
            toast(`Tab switch detected (${next}/${MAX_TAB_VIOLATIONS}). Please stay on the exam.`, {
              icon: '⚠️', duration: 4000
            });
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading, submission, hasLaunched, terminationReason]);

  // ── Fullscreen protection (anti-cheat) ──
  useEffect(() => {
    if (loading || !submission || submission.status !== 'IN_PROGRESS' || !hasLaunched || terminationReason) return;

    const reenterFullscreen = () => {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      return fn ? fn.call(el) : Promise.reject(new Error('API unavailable'));
    };

    // Intercept Escape in capture phase — browsers ignore preventDefault() for fullscreen
    // exit so we immediately re-enter fullscreen, then show the dialog once we're back inside.
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !autoSubmitTriggeredRef.current && !isSubmittingRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Re-enter fullscreen (Escape already fired, browser will exit momentarily)
        // then show dialog inside fullscreen
        reenterFullscreen()
          .catch(() => {})
          .finally(() => setShowFullscreenWarning(true));
      }
    };

    // Safety net for other exit paths (browser UI button, F11, etc.)
    // Awaits the re-enter promise so the dialog renders inside fullscreen, not outside.
    const handleFullscreenChange = async () => {
      if (!document.fullscreenElement && !autoSubmitTriggeredRef.current && !isSubmittingRef.current) {
        if (intentionalExitRef.current) {
          intentionalExitRef.current = false;
          return;
        }
        // Re-enter first, show dialog only after fullscreen is (re-)established
        await reenterFullscreen().catch(() => {});
        setShowFullscreenWarning(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // capture phase
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [loading, submission, hasLaunched, terminationReason]);

  // ── Copy/Paste/Cut/Right-click prevention ──
  // UX-001: paste is allowed in textarea/input so students can paste their code answers
  useEffect(() => {
    if (loading || !submission || submission.status !== 'IN_PROGRESS' || terminationReason) return;

    const isAnswerField = (target) => {
      const tag = target?.tagName?.toLowerCase();
      return tag === 'textarea' || tag === 'input';
    };

    const preventCopyOrCut = (e) => {
      e.preventDefault();
      toast('Copying is disabled during the exam.', { icon: '🔒', id: 'anti-cheat-block', duration: 2000 });
    };

    const preventPasteOutsideInputs = (e) => {
      if (isAnswerField(e.target)) return; // allow paste in answer fields
      e.preventDefault();
      toast('This action is disabled during the exam.', { icon: '🔒', id: 'anti-cheat-block', duration: 2000 });
    };

    const preventContextMenu = (e) => { e.preventDefault(); };

    const preventKeyShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        toast('Copying is disabled during the exam.', { icon: '🔒', id: 'anti-cheat-key', duration: 2000 });
      }
      // Allow Ctrl+V inside answer textarea/input fields
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (isAnswerField(e.target)) return;
        e.preventDefault();
        toast('Pasting outside answer fields is disabled.', { icon: '🔒', id: 'anti-cheat-key', duration: 2000 });
      }
    };

    document.addEventListener('copy', preventCopyOrCut);
    document.addEventListener('cut', preventCopyOrCut);
    document.addEventListener('paste', preventPasteOutsideInputs);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeyShortcuts, true);

    return () => {
      document.removeEventListener('copy', preventCopyOrCut);
      document.removeEventListener('cut', preventCopyOrCut);
      document.removeEventListener('paste', preventPasteOutsideInputs);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeyShortcuts, true);
    };
  }, [loading, submission]);

  // ── Prevent accidental page close/refresh ──
  useEffect(() => {
    if (loading || !submission || submission.status !== 'IN_PROGRESS' || terminationReason) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Your exam is still in progress. Leaving may result in lost answers.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, submission]);

  // ── Auto-save interval — BUG-007: use refs so the interval is not reset on every keystroke ──
  const handleSave = useCallback(async (isAuto = false) => {
    const sub = submissionRef.current;
    if (!sub) return;
    setSaving(true);
    try {
      const currentAnswers = answersRef.current;
      const currentLangs = selectedLangsRef.current;
      const answerArray = Object.entries(currentAnswers).map(([qId, ans]) => {
        const q = sub.exam.questions.find(x => x.id === parseInt(qId));
        let studentAnswer = ans;
        if (q?.type === 'CODING') {
           studentAnswer = JSON.stringify({
             code: ans,
             language: currentLangs[qId] || 'javascript'
           });
        }
        if (q?.type === 'UML' || q?.type === 'MATH') {
           studentAnswer = ans;
        }
        return {
          questionId: parseInt(qId),
          studentAnswer
        };
      });
      await api.patch(`/submissions/${sub.id}/save`, { answers: answerArray });
      if (!isAuto) toast.success('Progress cached');
    } catch (err) {
      if (!isAuto) toast.error('Sync failed');
    } finally {
      setSaving(false);
    }
  }, []); // stable — reads state through refs, no deps needed

  // Auto-save interval — BUG-007: depends only on [loading, handleSave] so timer never resets on keystroke
  useEffect(() => {
    if (loading) return;
    autoSaveTimerRef.current = setInterval(() => {
      handleSave(true);
    }, 30000);
    return () => clearInterval(autoSaveTimerRef.current);
  }, [loading, handleSave]);

  const handleUpdateAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleAutoSubmit = async () => {
    // Guard: prevent double auto-submit
    if (autoSubmitTriggeredRef.current) return;
    autoSubmitTriggeredRef.current = true;
    toast('Time is up! Submitting your exam...', { icon: '⏳', duration: 5000 });
    await processSubmission(true);
  };

  const processSubmission = async (force = false, termReason = null) => {
    // Use refs for force-mode (timer/anti-cheat) to guarantee latest data
    const sub = force ? submissionRef.current : submission;
    const currentAnswers = force ? answersRef.current : answers;
    const currentLangs = force ? selectedLangsRef.current : selectedLangs;

    if (!sub) return;
    // Prevent double submission via ref (works across stale closures)
    if (isSubmittingRef.current) return;

    // Language check only for manual submissions — auto-submit always goes through
    if (!force) {
      const codingQs = (sub.exam?.questions || []).filter(q => q.type === 'CODING');
      for (let q of codingQs) {
         const codingOpts = parseOptions(q.options);
         const studentCode = currentAnswers[q.id] || '';

         const detected = detectCodeLanguage(studentCode);
         const req = (codingOpts.requiredLanguage || 'any').toLowerCase();

         if (req !== 'any') {
            if (detected && detected.toLowerCase() !== req) {
               toast.error(`SUBMISSION BLOCKED! You used ${detected.toUpperCase()} syntax but this question REQUIRES ${req.toUpperCase()}.`, {
                 duration: 6000,
                 icon: '🚫'
               });
               return;
            }
         }
      }
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      // Build answer payload from the correct data source
      const answerArray = Object.entries(currentAnswers).map(([qId, ans]) => {
        const q = sub.exam.questions.find(x => x.id === parseInt(qId));
        let studentAnswer = ans;
        if (q?.type === 'CODING') {
           studentAnswer = JSON.stringify({
             code: ans,
             language: currentLangs[qId] || 'javascript'
           });
        }
        if (q?.type === 'UML' || q?.type === 'MATH') {
           studentAnswer = ans;
        }
        return { questionId: parseInt(qId), studentAnswer };
      });

      // Save first, then submit — ensures no answer loss
      await api.patch(`/submissions/${sub.id}/save`, { answers: answerArray });
      await api.post(`/submissions/${sub.id}/submit`, { terminationReason: termReason });

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (termReason) {
        setTerminationReason(termReason);
        return;
      }

      const showResults = parseInt(sub.exam.showResults); // FLOW-002: coerce to int (API may return string)

      // ── Use replace: true to remove the exam session from browser history ──
      if (showResults === 1) {
        toast.success('Assessment submitted! View your results.');
        navigate(`/submissions/${sub.id}`, { replace: true });
      } else {
        const message = showResults === 2
          ? 'Exam submitted! Results will be available at the scheduled time.'
          : 'Exam submitted! Your instructor will release the results soon.';
        toast.success(message, { duration: 6000 });
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.error('Submission failed. Retrying...');
      // Retry once for critical auto-submit
      if (force) {
        try {
          await api.post(`/submissions/${sub.id}/submit`);
          toast.success('Exam submitted on retry.');
          navigate('/', { replace: true });
        } catch (retryErr) {
          toast.error('Submission failed after retry. Please contact your instructor.');
        }
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // ── The global submit handler (called by header button) ──
  const handleSubmit = () => {
    setShowConfirmModal(true);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-6">
      <div className="relative">
        <div className="h-24 w-24 rounded-full border-4 border-slate-900 border-t-indigo-600 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-indigo-500 animate-pulse" />
        </div>
      </div>
      <p className="text-slate-500 font-black uppercase tracking-widest text-xs animate-pulse">Establishing Secure Socket...</p>
    </div>
  );

  const questions = submission?.exam?.questions || [];
  if (questions.length === 0 && !loading) return (
     <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <AlertTriangle className="h-12 w-12 mb-4 text-rose-500" />
        <h2 className="text-xl font-black uppercase tracking-widest">Assessment Empty</h2>
        <p className="text-sm opacity-60">No questions found in this assessment.</p>
        <button onClick={() => navigate('/')} className="mt-8 px-6 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold hover:text-slate-900 dark:text-white transition-all">Return to Dashboard</button>
     </div>
  );

  const currentQuestion = questions[activeIdx] || questions[0] || {};

  // Parse section metadata from exam if the instructor organized questions into sections
  const sectionsMeta = (() => {
    try {
      const m = submission?.exam?.examMeta;
      const meta = typeof m === 'string' ? JSON.parse(m) : m;
      return Array.isArray(meta?.sections) && meta.sections.length > 1 ? meta.sections : null;
    } catch(e) { return null; }
  })();

  const getSectionForIdx = (idx) => {
    if (!sectionsMeta) return null;
    return sectionsMeta.find(s => idx >= s.start && idx < s.start + s.count) || null;
  };

  const currentSection = getSectionForIdx(activeIdx);

  // Helper to check if any question has a language mismatch
  const hasLanguageError = questions.some(q => {
    if (q.type !== 'CODING') return false;
    const ops = parseOptions(q.options);
    const req = ops.requiredLanguage || 'any';
    if (req === 'any') return false;
    const sel = selectedLangs[q.id] || 'javascript';
    return sel !== req;
  });
  const answeredCount = Object.keys(answers).filter(id => answers[id] !== '').length;
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  // ── Termination Screen View ──
  if (terminationReason) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center font-outfit select-none p-6 text-center animate-fade-in relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-rose-500/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="w-full max-w-[500px] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-rose-500/20 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(239,68,68,0.1)] backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex flex-col items-center space-y-6">
            <div className="h-20 w-20 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 rounded-3xl flex items-center justify-center text-rose-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse">
              <XCircle size={40} className="stroke-[1.5]" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                Exam Session Terminated
              </h2>
              <p className="text-[10px] font-black tracking-[0.2em] text-rose-500 uppercase">
                Security Policy Enforcement
              </p>
            </div>

            <div className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 text-left space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-none">
                Violation Reason:
              </p>
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 leading-snug">
                {terminationReason}
              </p>
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your exam progress has been safely saved and automatically submitted. No further edits or submissions can be made for this session.
              </p>
            </div>

            <button
              onClick={() => navigate('/student/dashboard')}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-slate-950/10 dark:shadow-none flex items-center justify-center gap-2"
            >
              <ChevronLeft size={16} /> Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Launch Gate Instruction Screen View ──
  if (!hasLaunched) {
    const isMock = submission?.exam?.isMock;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center font-outfit select-none p-6 text-center animate-fade-in relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="w-full max-w-[520px] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex flex-col items-center space-y-7">
            <div className="h-16 w-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-500 shadow-md">
              <ShieldCheck size={32} className="stroke-[1.5]" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {submission?.exam?.title || 'Exam Session'}
              </h2>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Secure Proctoring Mode
                </span>
              </div>
            </div>

            <div className="w-full text-left space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Security Regulations:</h4>
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-500">
                    <CheckSquare size={14} />
                  </div>
                  <p className="leading-relaxed">Fullscreen mode will be locked upon entry. Exiting fullscreen will terminate your exam.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-500">
                    <CheckSquare size={14} />
                  </div>
                  <p className="leading-relaxed">Switching browser tabs or minimizing the window is restricted and tracked.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-500">
                    <CheckSquare size={14} />
                  </div>
                  <p className="leading-relaxed">Right-clicking, copying, or pasting text outside answer textareas is completely disabled.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLaunch}
              className="w-full h-13 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider text-xs rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 group"
            >
              Start Exam &amp; Enter Fullscreen
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-700 dark:text-slate-200 fixed inset-0 z-[100]">

      {/* ── Fullscreen exit confirmation dialog ── */}
      {showFullscreenWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-8 shadow-2xl mx-4 space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug">Leaving fullscreen?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed">
                  Exiting fullscreen mode will <span className="text-rose-500 font-bold">immediately terminate</span> your exam and auto-submit your answers.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  // Escape was intercepted — fullscreen was never exited, just close the dialog
                  setShowFullscreenWarning(false);
                }}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/25"
              >
                Stay in Exam
              </button>
              <button
                onClick={() => {
                  setShowFullscreenWarning(false);
                  if (!autoSubmitTriggeredRef.current) {
                    autoSubmitTriggeredRef.current = true;
                    intentionalExitRef.current = true; // tell fullscreenchange handler to ignore this exit
                    const reason = 'Student chose to exit fullscreen mode.';
                    setTerminationReason(reason);
                    toast.error('Exam terminated.', { duration: 4000, icon: '\uD83D\uDEAB' });
                    // Exit fullscreen ourselves, then submit
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {}).finally(() => processSubmission(true, reason));
                    } else {
                      processSubmission(true, reason);
                    }
                  }
                }}
                className="w-full py-3 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-sm uppercase tracking-widest transition-all hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-[0.98]"
              >
                Leave &amp; Terminate Exam
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar - Navigation Hub */}
      <aside className="hidden lg:flex flex-col w-[320px] glass border-r border-slate-200 dark:border-slate-800/40 relative z-20">
        <div className="p-8 border-b border-slate-200 dark:border-slate-800/40 bg-slate-50 dark:bg-slate-900/40">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                 <BookOpen className="h-5 w-5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <h4 className="font-black text-sm tracking-tighter text-slate-900 dark:text-white uppercase italic">Assessment Map</h4>
                <p className="text-[10px] font-bold text-slate-500 tracking-widest">Question {(activeIdx || 0) + 1} of {(questions || []).length}</p>
              </div>
           </div>

           <div className="space-y-3">
              {sectionsMeta ? (
                sectionsMeta.map((sec, secIdx) => (
                  <div key={secIdx} className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate px-0.5">
                      {sec.title || `Section ${secIdx + 1}`}
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {(questions || []).slice(sec.start, sec.start + sec.count).map((q, relIdx) => {
                        const idx = sec.start + relIdx;
                        if (!q) return null;
                        const isAnswered = answers[q.id] && answers[q.id] !== '';
                        const isActive = activeIdx === idx;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
                            className={`h-10 w-10 flex items-center justify-center rounded-xl font-black text-xs transition-all duration-300 border ${
                              isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-110' :
                              isAnswered ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                              'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-5 gap-2.5">
                  {(questions || []).map((q, idx) => {
                    if (!q) return null;
                    const isAnswered = answers[q.id] && answers[q.id] !== '';
                    const isActive = activeIdx === idx;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
                        className={`h-11 w-11 flex items-center justify-center rounded-xl font-black text-xs transition-all duration-300 border ${
                          isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30 scale-110' :
                          isAnswered ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                          'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              )}
           </div>
        </div>

        <div className="p-8 flex-1 flex flex-col justify-end space-y-8">
           <div className="space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Completion Progress</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{progress}%</p>
              </div>
              <div className="h-2 w-full bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                 <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
              </div>
           </div>

           <div className={`p-6 rounded-[2rem] border transition-all duration-300 ${timeLeft < 300 ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-400'}`}>
              <div className="flex items-center gap-4">
                 <Timer className="h-8 w-8" />
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">System Countdown</p>
                    <p className="text-3xl font-black tabular-nums leading-none tracking-tighter">{formatTime(timeLeft)}</p>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Experience Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Floating Header */}
         <header className="glass border-b border-slate-200 dark:border-slate-800/50 px-4 sm:px-8 py-3 sm:py-5 flex items-center justify-between backdrop-blur-3xl z-30">
           <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 sm:h-10 sm:w-10 glass rounded-full flex items-center justify-center border-slate-200 dark:border-slate-800 shrink-0">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-widest uppercase truncate max-w-[130px] sm:max-w-xs lg:max-w-sm">{submission?.exam?.title || 'Assessment'}</h1>
                <div className="hidden sm:flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secure Active Tunnel</p>
                </div>
              </div>
           </div>

            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
               <div className={`hidden sm:flex items-center gap-2 text-[10px] font-black transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
                  <Save className="h-3 w-3 animate-bounce" /> AUTO-CACHING...
               </div>
               <button
                 type="button"
                 onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                 disabled={isSubmitting}
                 className="px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs font-black uppercase tracking-tighter shadow-2xl transition-all active:scale-95 bg-white hover:bg-indigo-50 text-indigo-950"
               >
                 {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Final Submit'}
               </button>
            </div>
        </header>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-12 md:px-20 lg:py-20 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto space-y-12"
            >
               <div className="space-y-8 relative">
                  {/* Section label — only shown when exam has named sections */}
                  {currentSection && (
                    <div className="flex items-center gap-2 -mb-2">
                      <div className="h-5 w-1 rounded-full bg-indigo-500/40" />
                      <span className="text-[10px] font-bold text-indigo-400/70 dark:text-indigo-400/60 uppercase tracking-widest">
                        {currentSection.title}
                        {currentSection.description && <span className="ml-2 font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">— {currentSection.description}</span>}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                     <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]">
                           {activeIdx + 1}
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1">Question {activeIdx + 1}</span>
                           <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{currentQuestion?.type}</span>
                              <span className="text-slate-700 font-medium opacity-50 px-1">|</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Weight: {currentQuestion?.points} pts</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="relative pl-0 md:pl-8 group">
                     {/* Decorative line */}
                     <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-fuchsia-500 to-transparent rounded-full opacity-30 group-hover:opacity-100 transition-opacity" />
                     
                     <div className="space-y-8">
                        <div className="space-y-4">
                           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest shadow-lg shadow-black/20">
                              <Sparkles size={10} className="text-indigo-400" />
                              Primary Objective
                           </div>
                           
                           {(() => {
                              const text = currentQuestion?.text || 'Untitled Question Requirement';
                              let umlTitle = '';
                              if (currentQuestion.type === 'UML') {
                                 try {
                                    const opts = typeof currentQuestion.options === 'string' ? JSON.parse(currentQuestion.options) : currentQuestion.options;
                                    umlTitle = opts?.title || '';
                                 } catch(e) {}
                              }

                              return (
                                 <div className="space-y-8">
                                    {umlTitle && (
                                       <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-700">
                                          <div className="h-6 w-1 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                                          <h3 className="text-xl font-black text-cyan-400 tracking-wider uppercase drop-shadow-md">
                                             {umlTitle}
                                          </h3>
                                       </div>
                                    )}

                                    <div className="relative group/text">
                                       {/* Vertical accent for the paragraph */}
                                       <div className="absolute -left-6 top-0 bottom-0 w-0.5 bg-indigo-500/20 group-hover/text:bg-indigo-500 transition-colors hidden md:block" />
                                       
                                       <FormattedText 
                                          text={text}
                                          className="text-xl md:text-2xl font-medium text-slate-850 dark:text-slate-100 leading-[1.8] tracking-tight !font-outfit animate-in fade-in slide-in-from-left duration-700 whitespace-pre-wrap"
                                       />
                                    </div>
                                 </div>
                              );
                           })()}
                        </div>
                     </div>
                  </div>
               </div>

              {/* Interaction Elements */}
              <div className="space-y-4 pt-4">
                {currentQuestion.type === 'MCQ' && (
                  <div className="grid grid-cols-1 gap-4">
                    {currentQuestion.isMultiple === 1 && (
                      <div className="flex items-center gap-3 mb-2 animate-bounce">
                         <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2">
                           <Sparkles className="h-3 w-3 text-amber-500" />
                           <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Multiple Choices Allowed</span>
                         </div>
                      </div>
                    )}
                    {Array.isArray(currentQuestion.options) && currentQuestion.options.map((option, idx) => {
                      const ans = answers[currentQuestion.id];
                      const isSelected = (() => {
                        if (currentQuestion.isMultiple !== 1) return ans === option;
                        try { return JSON.parse(ans || '[]').includes(option); } 
                        catch(e) { return ans === option; }
                      })();

                      return (
                        <button
                          key={idx}
                          type="button"
                          role={currentQuestion.isMultiple === 1 ? 'checkbox' : 'radio'}
                          aria-checked={isSelected}
                          aria-label={`Option ${String.fromCharCode(65 + idx)}: ${option}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (currentQuestion.isMultiple === 1) {
                              let current = [];
                              try { current = JSON.parse(ans || '[]'); }
                              catch(e) { if (ans) current = [ans]; }
                              if (!Array.isArray(current)) current = [];

                              const next = current.includes(option) ? current.filter(x => x !== option) : [...current, option];
                              handleUpdateAnswer(currentQuestion.id, JSON.stringify(next));
                            } else {
                              handleUpdateAnswer(currentQuestion.id, option);
                            }
                          }}
                          className={`group flex items-center justify-between w-full p-6 h-20 rounded-[1.8rem] border-2 transition-all duration-500 ${
                            isSelected 
                              ? 'bg-indigo-600/10 border-indigo-600 text-slate-955 dark:text-white shadow-2xl scale-[1.02]' 
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-350 dark:hover:border-slate-700 hover:text-slate-950 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-6">
                            <div className={`h-8 w-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'bg-indigo-600 border-indigo-500 rotate-[360deg]' : 'border-slate-200 dark:border-slate-800/50 group-hover:border-slate-300 dark:border-slate-700'
                            }`}>
                              {isSelected ? <CheckSquare className="h-4 w-4 text-white" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />}
                            </div>
                            <span className="text-lg font-bold tracking-tight leading-none">{option}</span>
                          </div>
                          {isSelected && (
                            <div className="h-7 w-7 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                               <Sparkles className="h-3 w-3 text-indigo-400" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'TRUE_FALSE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {['True', 'False'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUpdateAnswer(currentQuestion.id, val); }}
                        className={`flex flex-col items-center justify-center p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border-2 group transition-all duration-500 ${
                          answers[currentQuestion.id] === val
                            ? 'bg-indigo-600/10 border-indigo-600 text-indigo-600 dark:text-indigo-450 shadow-2xl'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700 hover:text-slate-955 dark:hover:text-white'
                        }`}
                      >
                        {val === 'True' ? <CheckCircle2 className="h-10 w-10 sm:h-16 sm:w-16 mb-3 sm:mb-4 group-hover:scale-110 transition-transform" /> : <XCircle className="h-10 w-10 sm:h-16 sm:w-16 mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />}
                        <span className="text-sm font-black uppercase tracking-[0.3em] font-sans">{val} Selection</span>
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'FILL_BLANKS' && (
                  <div className="space-y-4">
                     <label className="text-[10px] font-bold uppercase text-slate-600 tracking-widest ml-2">Text Input Response</label>
                     <input 
                       autoFocus
                       className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800/80 rounded-2xl px-6 py-4 text-lg font-bold text-slate-850 dark:text-indigo-450 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                       placeholder="Submit Answer Pattern..."
                       value={answers[currentQuestion.id] || ''}
                       onChange={(e) => handleUpdateAnswer(currentQuestion.id, e.target.value)}
                     />
                  </div>
                )}

                {currentQuestion.type === 'ESSAY' && (
                  <div className="space-y-4">
                     <label className="text-xs font-black uppercase text-slate-600 tracking-widest ml-2">Open Response Lab</label>
                     <textarea
                       className="w-full bg-slate-50 dark:bg-slate-900/50 border-4 border-slate-200 dark:border-slate-800/80 rounded-2xl sm:rounded-[2.5rem] px-4 sm:px-10 py-4 sm:py-10 min-h-[250px] sm:min-h-[350px] text-base sm:text-lg font-medium leading-relaxed text-slate-850 dark:text-slate-100 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                       placeholder="Synthesize your comprehensive response..."
                       value={answers[currentQuestion.id] || ''}
                       onChange={(e) => handleUpdateAnswer(currentQuestion.id, e.target.value)}
                     />
                  </div>
                )}

                {currentQuestion.type === 'UML' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <p className="text-xs text-slate-500 italic flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                         <Info className="h-4 w-4 text-cyan-400" />
                         Complete the <strong>{parseOptions(currentQuestion.options).diagramType || 'UML'}</strong> diagram below.
                       </p>
                       {parseOptions(currentQuestion.options).useAI && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl animate-pulse">
                             <Sparkles className="h-4 w-4 text-cyan-400" />
                             <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">AI Grading Active</span>
                          </div>
                       )}
                    </div>
                    
                      <div className="bg-slate-50 dark:bg-slate-900 h-[550px] rounded-[2.5rem] border-4 border-slate-200 dark:border-slate-800/80 overflow-hidden relative shadow-inner">
                       <UMLCanvas 
                         value={answers[currentQuestion.id]} 
                         onChange={(val) => handleUpdateAnswer(currentQuestion.id, val)}
                         diagramType={parseOptions(currentQuestion.options).diagramType}
                         isEditable={true}
                       />
                     </div>
                   </div>
                 )}

                 {currentQuestion.type === 'MATH' && (
                    <div className="animate-fade-in">
                       <MathEditor 
                         value={answers[currentQuestion.id] || ""} 
                         onChange={(val) => handleUpdateAnswer(currentQuestion.id, val)} 
                       />
                    </div>
                 )}

                 {currentQuestion.type === 'CODING' && (() => {
                   const codingOpts = parseOptions(currentQuestion.options);
                   return (
                     <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                           <div className="flex flex-col gap-1 mb-6 border-b border-slate-200 dark:border-slate-800/50 pb-5">
                               <div className="flex items-center gap-3">
                                  <Code className="h-5 w-5 text-fuchsia-400" />
                                  <h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">
                                     {codingOpts.title || 'Coding Challenge'}
                                  </h3>
                               </div>
                               <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-8">Problem Configuration Overview</span>
                           </div>
                           
                           {codingOpts.inputDescription && (
                             <div>
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Input Format</h4>
                               <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{codingOpts.inputDescription}</p>
                             </div>
                           )}
                           
                           {codingOpts.outputDescription && (
                             <div>
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Output Format</h4>
                               <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{codingOpts.outputDescription}</p>
                             </div>
                           )}

                           {(codingOpts.sampleInput || codingOpts.sampleOutput) && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {codingOpts.sampleInput && (
                                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Sample Input</h4>
                                     <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{codingOpts.sampleInput}</pre>
                                  </div>
                                )}
                                {codingOpts.sampleOutput && (
                                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Sample Output</h4>
                                     <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{codingOpts.sampleOutput}</pre>
                                  </div>
                                )}
                             </div>
                           )}
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between px-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-fuchsia-500 flex items-center gap-2">
                                 <Code className="h-4 w-4" /> Code Architecture Editor
                             </label>
                             
                             <div className="flex items-center gap-3">
                                {(() => {
                                    const requiredLangId = codingOpts.requiredLanguage || 'any';
                                    const selectedLangId = selectedLangs[currentQuestion.id] || 'javascript';
                                    const isLocked = requiredLangId !== 'any';
                                    
                                    if (isLocked) {
                                      const lang = LANGUAGES.find(l => l.id === requiredLangId) || LANGUAGES[0];
                                      return (
                                        <div className={`flex items-center gap-2 px-4 py-2 ${lang?.bg || 'bg-slate-100 dark:bg-slate-800'} ${lang?.color || 'text-slate-900 dark:text-white'} rounded-xl border ${lang?.border || 'border-slate-300 dark:border-slate-700'} shadow-lg shadow-indigo-500/10`}>
                                           <div className="flex flex-col">
                                              <span className="text-[8px] font-black uppercase text-slate-900 dark:text-white/50 tracking-widest leading-none mb-1">Mandatory Language</span>
                                              <span className="text-[11px] font-black uppercase tracking-tighter">{(lang?.label || requiredLangId).toUpperCase()} ONLY</span>
                                           </div>
                                           <ShieldCheck className="h-4 w-4 opacity-80" />
                                        </div>
                                      );
                                    }

                                    return (
                                       <div className="flex items-center gap-2">
                                          <div className="flex bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-inner">
                                             {LANGUAGES.map(l => (
                                               <button
                                                  key={l.id}
                                                  type="button"
                                                  onClick={() => setSelectedLangs(prev => ({...prev, [currentQuestion.id]: l.id}))}
                                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${selectedLangId === l.id ? `${l.bg} ${l.color} shadow-lg shadow-${l.id}/10` : 'text-slate-600 hover:text-slate-500 dark:text-slate-400'}`}
                                               >
                                                  {l.label}
                                               </button>
                                             ))}
                                          </div>
                                       </div>
                                    );
                                 })()}
                             </div>
                          </div>

                          {(() => {
                              const code = answers[currentQuestion.id] || '';
                              const detected = detectCodeLanguage(code);
                              const requiredLangId = codingOpts.requiredLanguage || 'any';
                              const selectedLangId = selectedLangs[currentQuestion.id] || 'javascript';
                              const requiredLang = LANGUAGES.find(l => l.id === requiredLangId);
                              
                              const isLocked = requiredLangId !== 'any';
                              const mismatchWithRequired = isLocked && selectedLangId !== requiredLangId;
                              
                              return (
                                <div className="space-y-3">
                                   {/* Real-time Requirement Banner */}
                                   <div className={`flex items-center justify-between px-6 py-4 rounded-2xl border transition-all ${mismatchWithRequired ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>
                                      <div className="flex items-center gap-3">
                                         {mismatchWithRequired ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                                         <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">
                                               Requirement: {isLocked ? (requiredLang?.label || requiredLangId) : 'Any Language'}
                                            </p>
                                            <p className="text-[10px] opacity-70 font-medium">
                                               {mismatchWithRequired 
                                                 ? `⚠️ Submissions using ${LANGUAGES.find(l=>l.id===selectedLangId)?.label} will be rejected.`
                                                 : isLocked 
                                                   ? `✅ Language policy compliance verified.`
                                                   : `✅ Students can choose their preferred compiler.`}
                                            </p>
                                         </div>
                                      </div>
                                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${mismatchWithRequired ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
                                         {requiredLangId.toUpperCase()} MODE
                                      </div>
                                   </div>

                                  {/* AI Smart Detection Hint - STRICT ENFORCEMENT */}
                                  {detected && (
                                    <motion.div 
                                      initial={{opacity:0, scale:0.95}} 
                                      animate={{opacity:1, scale:1}} 
                                      className={`flex items-center justify-between gap-3 border-2 rounded-2xl px-6 py-4 transition-all shadow-lg ${
                                        isLocked && detected !== requiredLangId 
                                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse' 
                                          : detected !== selectedLangId 
                                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                      }`}
                                    >
                                       <div className="flex items-center gap-4">
                                          {isLocked && detected !== requiredLangId ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <Sparkles className="h-5 w-5 shrink-0" />}
                                          <div>
                                             <p className="text-[12px] font-black uppercase tracking-widest leading-none mb-1">
                                                {isLocked && detected !== requiredLangId ? 'Verification Sync' : 'Syntax Recognition'}
                                             </p>
                                             <p className="text-[10px] font-bold opacity-80">
                                                Identified Profile: <span className="uppercase text-slate-900 dark:text-white underline">{detected}</span>
                                                {isLocked && detected !== requiredLangId && (
                                                  <span> — Please use <span className="uppercase text-slate-900 dark:text-white">{requiredLangId}</span> for this task.</span>
                                                )}
                                              </p>
                                          </div>
                                       </div>
                                       {detected === (isLocked ? requiredLangId : selectedLangId) && (
                                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg">
                                             <ShieldCheck className="h-3.5 w-3.5" /> Validated
                                          </span>
                                       )}
                                    </motion.div>
                                  )}

                                  <div className="relative group">
                                     <textarea 
                                       className={`w-full bg-[#1e1e1e] border-4 rounded-[2.5rem] px-10 py-12 min-h-[450px] text-lg font-mono text-slate-100 outline-none transition-all placeholder:text-slate-600 shadow-2xl ${isLocked && detected && detected !== requiredLangId ? 'border-rose-600 focus:border-rose-400' : 'border-slate-200 dark:border-slate-800/80 focus:border-fuchsia-600'}`}
                                       placeholder={`// Write your ${selectedLangId} solution here...`}
                                       spellCheck="false"
                                       value={answers[currentQuestion.id] || ''}
                                       onChange={(e) => {
                                           const newVal = e.target.value;
                                           handleUpdateAnswer(currentQuestion.id, newVal);
                                           // Quick check for toast alert
                                           const newDetected = detectCodeLanguage(newVal);
                                           if (isLocked && newDetected && newDetected !== requiredLangId) {
                                              toast.error(`Wrong Language! Detected ${newDetected.toUpperCase()} instead of ${requiredLangId.toUpperCase()}.`, { id: 'lang-mismatch' });
                                           }
                                       }}
                                     />
                                     
                                     {mismatchWithRequired && (
                                       <div className="absolute inset-0 bg-rose-950/20 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-rose-500/20" />
                                     )}

                                     <div className="absolute bottom-6 right-8 flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/80 backdrop-blur border border-slate-300 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        {mismatchWithRequired ? <CircleX className="h-3 w-3 text-rose-500" /> : <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                                        {mismatchWithRequired ? 'Invalid Syntax Mode' : 'Validated Protocol'}
                                     </div>
                                  </div>
                               </div>
                             );
                          })()}
                        </div>
                     </div>
                   );
                 })()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Question Navigation — UX-004: visible only below lg breakpoint */}
        <div className="lg:hidden glass border-t border-slate-200 dark:border-slate-800/60 px-4 py-2.5 z-30">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] && answers[q.id] !== '';
              const isActive = activeIdx === idx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  aria-label={`Question ${idx + 1}${isAnswered ? ' — answered' : ''}`}
                  className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-lg font-black text-[10px] transition-all border ${
                    isActive
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : isAnswered
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Control Bar */}
         <footer className="glass border-t border-slate-200 dark:border-slate-800/50 px-4 sm:px-8 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-3 z-30">
            <button 
              type="button"
              disabled={activeIdx === 0}
              onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => prev - 1); }}
              className="h-11 px-4 sm:px-6 rounded-xl glass glass-hover text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white disabled:opacity-40 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            
            <div className="flex lg:hidden items-center gap-2 px-3.5 h-11 glass rounded-xl text-slate-850 dark:text-slate-200 shrink-0 border border-slate-200 dark:border-slate-800/40">
               <Timer className="h-4.5 w-4.5 text-indigo-650 dark:text-indigo-400 animate-pulse" />
               <span className="text-base font-extrabold tabular-nums leading-none tracking-tight">{formatTime(timeLeft)}</span>
            </div>

            {activeIdx >= questions.length - 1 ? (
              <button 
                key="submit-btn"
                type="button"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  setShowConfirmModal(true);
                }}
                className="h-11 px-4 sm:px-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider transition-all active:scale-95 group shadow-lg shadow-emerald-600/20 disabled:opacity-50 shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Send className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                )}
                <span>Final Submit</span>
              </button>
            ) : (
              <button 
                key="next-btn"
                type="button"
                onClick={() => {
                  setActiveIdx(prev => prev + 1);
                  handleSave(true);
                }}
                className="h-11 px-4 sm:px-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-600/20 shrink-0"
              >
                <span>Next Step</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
         </footer>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
           <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#0b1328]/95 border border-slate-200 dark:border-emerald-500/20 shadow-[-10px_-10px_30px_4px_rgba(0,0,0,0.05),_10px_10px_30px_4px_rgba(16,185,129,0.05)] rounded-3xl p-8 max-w-md w-full relative overflow-hidden backdrop-blur-xl"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
              
              <div className="flex flex-col items-center text-center space-y-5 relative z-10">
                <div className="h-16 w-16 bg-gradient-to-br from-emerald-500/10 to-emerald-900/20 dark:from-emerald-500/20 dark:to-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]">
                  <CheckSquare size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Confirm Submission</h3>
                  <p className="text-[13px] text-slate-600 dark:text-slate-300/80 leading-relaxed font-medium">
                    Are you ready to finalize your work? Once submitted, your answers will be evaluated and further modifications will be disabled.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3 relative z-10">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-white/[0.03] hover:bg-white/[0.08] hover:text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700/50 transition-all outline-none"
                >
                  Review Again
                </button>
                <button 
                  onClick={() => {
                     setShowConfirmModal(false);
                     processSubmission();
                  }}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] transition-all outline-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tab Switch Warning Modal */}
      <AnimatePresence>
        {showTabWarning && (
           <div className="fixed inset-0 z-[99998] flex items-center justify-center px-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowTabWarning(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0b1328]/95 border border-slate-200 dark:border-amber-500/30 shadow-[0_0_40px_-10px_rgba(245,158,11,0.15)] rounded-3xl p-8 max-w-md w-full relative overflow-hidden backdrop-blur-xl"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-5 relative z-10">
                <div className="h-16 w-16 bg-gradient-to-br from-amber-500/10 to-red-900/20 dark:from-amber-500/20 dark:to-red-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 shadow-[0_0_30px_-5px_rgba(245,158,11,0.2)] animate-pulse">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Stay on This Tab</h3>
                  <p className="text-[13px] text-slate-600 dark:text-slate-300/80 leading-relaxed font-medium">
                    Leaving the exam tab has been detected. Repeated violations will result in automatic submission of your exam.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="flex gap-1.5">
                      {Array.from({ length: MAX_TAB_VIOLATIONS }).map((_, i) => (
                        <div key={i} className={`h-2.5 w-8 rounded-full transition-all duration-500 ${i < tabViolations ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest ml-2">
                      {tabViolations}/{MAX_TAB_VIOLATIONS}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 relative z-10">
                <button
                  onClick={() => setShowTabWarning(false)}
                  className="w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)] transition-all outline-none"
                >
                  I Understand — Return to Exam
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ExamSession;
