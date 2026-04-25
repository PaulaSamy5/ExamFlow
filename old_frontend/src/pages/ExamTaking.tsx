import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Send, ChevronLeft, ChevronRight, Save, Maximize, AlertTriangle, MonitorX, CheckCircle2 } from 'lucide-react';

interface Question {
  id: string;
  type: string;
  content: string;
  score: number;
  options?: string; // JSON string
  language?: string;
}

interface Exam {
  id: string;
  title: string;
  duration: number;
  questions: Question[];
}

const ExamTaking: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissionId, setSubmissionId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const initExam = async () => {
      try {
        const { data: sub } = await api.post('/submissions/start', { examId: id });
        setSubmissionId(sub.id);
        
        const { data: examData } = await api.get(`/exams/${id}`);
        setExam(examData);
        setTimeLeft(examData.duration * 60);

        // Load existing answers if any
        if (sub.answers) {
          const loadedAns: Record<string, any> = {};
          sub.answers.forEach((a: any) => {
            loadedAns[a.questionId] = a.content;
          });
          setAnswers(loadedAns);
        }
      } catch (err) {
        console.error('Failed to init exam');
      }
    };
    initExam();

    // Anti-cheating: Tab switch detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
        alert('Warning: Tab switching is monitored. Please stay on the exam page.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  useEffect(() => {
      if (timeLeft > 0 && !submitted) {
          timerRef.current = setInterval(() => {
             setTimeLeft(prev => {
                if (prev <= 1) {
                   clearInterval(timerRef.current);
                   handleSubmit();
                   return 0;
                }
                return prev - 1;
             });
          }, 1000);
      }
      return () => clearInterval(timerRef.current);
  }, [timeLeft, submitted]);

  // Periodic Auto-save
  useEffect(() => {
    const autoSave = setInterval(() => {
       if (Object.keys(answers).length > 0 && !submitted) {
          handleSave();
       }
    }, 30000); // every 30 seconds
    return () => clearInterval(autoSave);
  }, [answers, submitted]);

  const handleSave = async () => {
     if (saving || !submissionId) return;
     setSaving(true);
     try {
        const formattedAnswers = Object.entries(answers).map(([qId, content]) => ({ questionId: qId, content }));
        await api.post(`/submissions/${submissionId}/answers`, { answers: formattedAnswers });
     } catch (err) {
        console.error('Auto-save failed');
     } finally {
        setTimeout(() => setSaving(false), 1000);
     }
  };

  const handleSubmit = async () => {
     if (submitted) return;
     try {
        await handleSave();
        await api.post(`/submissions/${submissionId}/submit`);
        setSubmitted(true);
     } catch (err) {
        console.error('Submit failed');
     }
  };

  const formatTime = (seconds: number) => {
     const m = Math.floor(seconds / 60);
     const s = seconds % 60;
     return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAnswerChange = (questionId: string, val: any) => {
     setAnswers(prev => ({ ...prev, [questionId]: val }));
  };

  if (!exam) return <div className="h-screen flex items-center justify-center">Loading Exam...</div>;

  if (submitted) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-950">
           <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-12 premium-card max-w-lg">
               <CheckCircle2 size={80} className="text-green-500 mx-auto mb-6" />
               <h1 className="text-3xl font-bold mb-4">Exam Submitted Successfully!</h1>
               <p className="text-slate-500 mb-8">Thank you for participating. Your results will be processed by the instructor shortly.</p>
               <button onClick={() => navigate('/student')} className="btn-primary w-full py-4 text-xl">Back to Dashboard</button>
           </motion.div>
        </div>
     );
  }

  const currentQuestion = exam.questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Exam Header */}
      <header className="bg-white dark:bg-slate-900 border-b p-4 px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-all">
         <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold line-clamp-1">{exam.title}</h2>
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold ${timeLeft < 300 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
               <Clock size={18} /> {formatTime(timeLeft)}
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
                <AnimatePresence mode="wait">
                   {saving ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="saving" className="flex items-center gap-1.5 text-slate-400">
                         <Save size={14} className="animate-spin" /> Saving...
                      </motion.div>
                   ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="saved" className="text-green-500 flex items-center gap-1.5">
                         <Save size={14} /> Draft Saved
                      </motion.div>
                   )}
                </AnimatePresence>
            </div>
            <button 
                onClick={handleSubmit} 
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
               <Send size={18} /> Submit
            </button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
         {/* Navigation Sidebar */}
         <aside className="w-80 border-r bg-white dark:bg-slate-900 overflow-y-auto hidden lg:block p-6">
            <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Questions</h3>
                <div className="grid grid-cols-4 gap-3">
                    {exam.questions.map((q, idx) => (
                        <button 
                            key={q.id}
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold transition-all ${
                                currentIndex === idx ? 'bg-primary-600 text-white shadow-lg' : 
                                answers[q.id] ? 'bg-green-100 text-green-700 border-green-200 border' : 'bg-slate-50 border hover:bg-slate-100'
                            }`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100">
               <div className="flex gap-2 text-amber-700 font-bold mb-2 text-sm">
                  <AlertTriangle size={16} /> Activity Log
               </div>
               <p className="text-xs text-amber-600 leading-relaxed">
                  Tab Switches Detected: {tabSwitches}<br/>
                  Keep the window active to avoid disqualification.
               </p>
            </div>
         </aside>

         {/* Question Area */}
         <main className="flex-1 overflow-y-auto p-4 md:p-12">
            <div className="max-w-3xl mx-auto py-8">
               <motion.div 
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 dark:border-slate-800"
               >
                  <div className="flex items-center justify-between mb-8">
                     <span className="px-4 py-1.5 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">
                        Question {currentIndex + 1} of {exam.questions.length} — {currentQuestion.score} Pts
                     </span>
                     <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{currentQuestion.type}</span>
                  </div>

                  <h2 className="text-2xl font-bold mb-10 leading-snug">
                     {currentQuestion.content}
                  </h2>

                  {/* Question Types Logic */}
                  <div className="space-y-4">
                     {currentQuestion.type === 'MCQ' && currentQuestion.options && (
                        JSON.parse(currentQuestion.options).map((opt: string, i: number) => (
                           <button 
                              key={i}
                              onClick={() => handleAnswerChange(currentQuestion.id, opt)}
                              className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                                 answers[currentQuestion.id] === opt ? 'bg-primary-50 border-primary-500 shadow-md' : 'hover:bg-slate-50'
                              }`}
                           >
                              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${answers[currentQuestion.id] === opt ? 'border-primary-500 bg-primary-500' : ''}`}>
                                 {answers[currentQuestion.id] === opt && <div className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                              <span className={answers[currentQuestion.id] === opt ? 'font-bold text-primary-700' : ''}>{opt}</span>
                           </button>
                        ))
                     )}

                     {currentQuestion.type === 'TRUE_FALSE' && (
                        <div className="flex gap-4">
                           {['True', 'False'].map(opt => (
                              <button 
                                 key={opt}
                                 onClick={() => handleAnswerChange(currentQuestion.id, opt)}
                                 className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all ${
                                    answers[currentQuestion.id] === opt ? 'bg-primary-50 border-primary-500' : 'hover:bg-slate-50'
                                 }`}
                              >
                                 {opt}
                              </button>
                           ))}
                        </div>
                     )}

                     {(currentQuestion.type === 'FILL_BLANKS' || currentQuestion.type === 'DEFINITION' || currentQuestion.type === 'ESSAY') && (
                        <textarea 
                           className="w-full p-6 rounded-2xl border-2 focus:border-primary-500 outline-none transition-all bg-slate-50 dark:bg-slate-800"
                           placeholder="Type your answer here..."
                           rows={currentQuestion.type === 'ESSAY' ? 10 : 3}
                           value={answers[currentQuestion.id] || ''}
                           onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        />
                     )}

                     {currentQuestion.type === 'CODING' && (
                        <div className="rounded-2xl border-2 overflow-hidden">
                           <div className="bg-slate-800 text-slate-400 p-2 text-xs flex justify-between items-center px-4">
                              <span>{currentQuestion.language?.toUpperCase() || 'JAVASCRIPT'}</span>
                              <div className="flex gap-1.5">
                                 <div className="h-3 w-3 rounded-full bg-red-500" />
                                 <div className="h-3 w-3 rounded-full bg-yellow-500" />
                                 <div className="h-3 w-3 rounded-full bg-green-500" />
                              </div>
                           </div>
                           <textarea 
                              className="w-full p-4 font-mono text-sm bg-slate-900 text-white outline-none min-h-[300px]"
                              value={answers[currentQuestion.id] || ''}
                              placeholder={`// Write your ${currentQuestion.language || 'code'} here...`}
                              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                           />
                        </div>
                     )}
                  </div>
               </motion.div>

               <div className="flex items-center justify-between mt-12 px-2">
                  <button 
                     disabled={currentIndex === 0}
                     onClick={() => setCurrentIndex(prev => prev - 1)}
                     className="flex items-center gap-2 p-4 text-slate-500 hover:text-primary-600 disabled:opacity-30 transition-all font-bold"
                  >
                     <ChevronLeft size={24} /> Previous
                  </button>
                  
                  <div className="flex items-center gap-3">
                     <div className="h-1.5 w-40 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                           className="h-full bg-primary-600"
                           initial={{ width: 0 }}
                           animate={{ width: `${((currentIndex + 1)/exam.questions.length) * 100}%` }}
                        />
                     </div>
                  </div>

                  {currentIndex === exam.questions.length - 1 ? (
                     <button 
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-xl hover:scale-[1.05] transition-all"
                     >
                         Complete Exam <CheckCircle2 size={20} />
                     </button>
                  ) : (
                     <button 
                        onClick={() => setCurrentIndex(prev => prev + 1)}
                        className="flex items-center gap-2 p-4 text-slate-500 hover:text-primary-600 transition-all font-bold"
                     >
                        Next <ChevronRight size={24} />
                     </button>
                  )}
               </div>
            </div>
         </main>
      </div>
    </div>
  );
};

export default ExamTaking;
