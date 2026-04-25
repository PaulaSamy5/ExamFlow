import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash, Clock, Calendar, CheckSquare, Code, Layout, AlignLeft, Info, List, Save, ArrowLeft, ChevronRight, XCircle } from 'lucide-react';

interface Question {
  id: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANKS' | 'MATCHING' | 'DEFINITION' | 'ESSAY' | 'CODING' | 'UML';
  content: string;
  score: number;
  options?: string[]; // Internal array
  correctAnswer?: string; // Internal value
  language?: string; // For coding
  hiddenTestCases?: { input: string; expectedOutput: string }[];
}

const CreateExam: React.FC = () => {
  const navigate = useNavigate();
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    totalGrade: 100,
    duration: 60,
    startTime: '',
    endTime: ''
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addQuestion = (type: Question['type']) => {
    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      score: 10,
      options: type === 'MCQ' ? ['', '', '', ''] : undefined,
      language: type === 'CODING' ? 'javascript' : undefined,
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sumScores = questions.reduce((a, b) => a + b.score, 0);
    if (sumScores > examData.totalGrade) {
       setError(`Total question scores (${sumScores}) exceed exam grade (${examData.totalGrade})`);
       setLoading(false);
       return;
    }

    try {
      const payload = {
        ...examData,
        questions: questions.map(q => ({
           ...q,
           options: q.options && q.options.length > 0 ? q.options.filter(o => !!o) : undefined
        }))
      };
      await api.post('/exams', payload);
      navigate('/instructor');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-12">
            <button onClick={() => navigate('/instructor')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-all font-bold">
               <ArrowLeft size={20} /> Back to Dashboard
            </button>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Create Assessment</h1>
            <div className="w-40" />
        </header>

        <form onSubmit={handleSubmit} className="space-y-12 pb-24">
           {/* Section 1: Basic Info */}
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="premium-card space-y-8">
              <div className="flex items-center gap-3 text-primary-600 mb-2 font-black uppercase tracking-widest text-sm">
                 <Info size={18} /> Basic Information
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="col-span-full">
                    <label className="block text-sm font-bold mb-2">Exam Title</label>
                    <input 
                       type="text" 
                       required
                       className="w-full px-6 py-4 rounded-2xl border-2 focus:border-primary-500 outline-none text-xl font-bold transition-all"
                       placeholder="e.g., Data Structures Mid-Term"
                       value={examData.title}
                       onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                    />
                 </div>
                 <div className="col-span-full">
                    <label className="block text-sm font-bold mb-2">Description</label>
                    <textarea 
                       className="w-full px-6 py-4 rounded-2xl border-2 focus:border-primary-500 outline-none transition-all"
                       placeholder="Instructions for students..."
                       rows={3}
                       value={examData.description}
                       onChange={(e) => setExamData({ ...examData, description: e.target.value })}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2"><Clock size={16} /> Duration (mins)</label>
                    <input 
                       type="number" 
                       required
                       className="w-full px-6 py-4 rounded-2xl border-2 focus:border-primary-500 outline-none transition-all"
                       value={examData.duration}
                       onChange={(e) => setExamData({ ...examData, duration: parseInt(e.target.value) })}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2"><CheckSquare size={16} /> Total Grade</label>
                    <input 
                       type="number" 
                       required
                       className="w-full px-6 py-4 rounded-2xl border-2 focus:border-primary-500 outline-none transition-all"
                       value={examData.totalGrade}
                       onChange={(e) => setExamData({ ...examData, totalGrade: parseInt(e.target.value) })}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2"><Calendar size={16} /> Start Window</label>
                    <input 
                       type="datetime-local" 
                       required
                       className="w-full px-6 py-4 rounded-2xl border-2 focus:border-primary-500 outline-none transition-all"
                       value={examData.startTime}
                       onChange={(e) => setExamData({ ...examData, startTime: e.target.value })}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2"><Calendar size={16} /> End Window</label>
                    <input 
                       type="datetime-local" 
                       required
                       className="w-full px-6 py-4 rounded-2xl border-2 focus:border-primary-500 outline-none transition-all"
                       value={examData.endTime}
                       onChange={(e) => setExamData({ ...examData, endTime: e.target.value })}
                    />
                 </div>
              </div>
           </motion.div>

           {/* Section 2: Questions */}
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-primary-600 font-black uppercase tracking-widest text-sm">
                   <List size={18} /> Experience Questions ({questions.length})
                </div>
                 <div className="text-sm font-bold opacity-50">
                    Remaining Scores: {examData.totalGrade - questions.reduce((a, b) => a + b.score, 0)} Pts
                 </div>
              </div>

              <div className="space-y-8">
                 <AnimatePresence>
                    {questions.map((q, idx) => (
                       <motion.div 
                          key={q.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 shadow-sm relative group"
                       >
                          <div className="absolute -left-3 top-8 h-12 w-1.5 bg-primary-600 rounded-full" />
                          <button 
                             type="button" 
                             onClick={() => removeQuestion(q.id)}
                             className="absolute top-8 right-8 text-slate-300 hover:text-red-500 transition-all"
                          >
                             <Trash size={20} />
                          </button>
                          
                          <div className="mb-6 flex gap-4 items-center">
                             <div className="text-xl font-black text-slate-300">#{(idx + 1).toString().padStart(2, '0')}</div>
                             <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest">{q.type}</div>
                          </div>

                          <div className="space-y-6">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Prompt</label>
                                <textarea 
                                   className="w-full px-5 py-4 rounded-xl border bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                   placeholder="Enter the question text here..."
                                   value={q.content}
                                   onChange={(e) => updateQuestion(q.id, { content: e.target.value })}
                                   rows={2}
                                />
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                   <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Assigned Score</label>
                                   <input 
                                      type="number"
                                      className="w-full px-5 py-3 rounded-xl border bg-slate-50 focus:bg-white outline-none"
                                      value={q.score}
                                      onChange={(e) => updateQuestion(q.id, { score: parseInt(e.target.value) })}
                                   />
                                </div>
                                {q.type === 'CODING' && (
                                   <div>
                                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Programming Language</label>
                                      <select 
                                         className="w-full px-5 py-3 rounded-xl border bg-slate-50 focus:bg-white outline-none"
                                         value={q.language}
                                         onChange={(e) => updateQuestion(q.id, { language: e.target.value })}
                                      >
                                         {['python', 'javascript', 'cpp', 'java', 'html'].map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                                      </select>
                                   </div>
                                )}
                             </div>

                             {q.type === 'MCQ' && (
                                <div className="space-y-3">
                                   <label className="block text-xs font-bold uppercase text-slate-400 tracking-widest">Options</label>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {q.options?.map((opt, i) => (
                                         <div key={i} className="flex gap-2 items-center">
                                            <div className="h-4 w-4 rounded-full border-2 shrink-0 border-slate-200" />
                                            <input 
                                               type="text" 
                                               placeholder={`Option ${i+1}`}
                                               className="flex-1 px-4 py-2 rounded-lg border bg-slate-50 focus:bg-white outline-none"
                                               value={opt}
                                               onChange={(e) => {
                                                  const newOpts = [...(q.options || [])];
                                                  newOpts[i] = e.target.value;
                                                  updateQuestion(q.id, { options: newOpts });
                                               }}
                                            />
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             )}
                          </div>
                       </motion.div>
                    ))}
                 </AnimatePresence>
                 
                 {/* Empty State / Add Suggestion */}
                 {questions.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed rounded-3xl border-slate-200">
                       <p className="text-slate-400 font-bold">Start building your assessment by selecting a question type below</p>
                    </div>
                 )}
              </div>
           </div>

           {/* Toolbar: Fixed at Bottom Area */}
           <div className="sticky bottom-8 z-30 flex flex-col items-center gap-4">
              <div className="glass-morphism rounded-full p-2 flex items-center gap-2 shadow-2xl border-white/50 backdrop-blur-2xl">
                 <div className="px-4 text-xs font-black uppercase text-slate-500 tracking-tighter">Add Quest:</div>
                 <button type="button" onClick={() => addQuestion('MCQ')} className="p-3 hover:bg-primary-50 text-primary-600 rounded-full transition-all group" title="Add MCQ">
                    <List size={22} /><span className="text-[8px] block font-black group-hover:opacity-100 opacity-0 transition-opacity">MCQ</span>
                 </button>
                 <button type="button" onClick={() => addQuestion('TRUE_FALSE')} className="p-3 hover:bg-primary-50 text-primary-600 rounded-full transition-all group" title="Add True/False">
                    <CheckSquare size={22} /><span className="text-[8px] block font-black group-hover:opacity-100 opacity-0 transition-opacity">T/F</span>
                 </button>
                 <button type="button" onClick={() => addQuestion('ESSAY')} className="p-3 hover:bg-primary-50 text-primary-600 rounded-full transition-all group" title="Add Essay">
                    <AlignLeft size={22} /><span className="text-[8px] block font-black group-hover:opacity-100 opacity-0 transition-opacity">ESSAY</span>
                 </button>
                 <button type="button" onClick={() => addQuestion('CODING')} className="p-3 hover:bg-primary-50 text-primary-600 rounded-full transition-all group" title="Add Code Runner">
                    <Code size={22} /><span className="text-[8px] block font-black group-hover:opacity-100 opacity-0 transition-opacity">CODE</span>
                 </button>
                 <button type="button" onClick={() => addQuestion('UML')} className="p-3 hover:bg-primary-50 text-primary-600 rounded-full transition-all group" title="Add Diagram (UML)">
                    <Layout size={22} /><span className="text-[8px] block font-black group-hover:opacity-100 opacity-0 transition-opacity">UML</span>
                 </button>
              </div>

              <div className="w-full max-w-sm">
                 {error && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4 p-4 bg-red-100 text-red-700 rounded-2xl flex items-center gap-2 text-sm font-bold border border-red-200">
                       <XCircle size={18} /> {error}
                    </motion.div>
                 )}
                 <button 
                   type="submit" 
                   disabled={loading || questions.length === 0}
                   className="w-full py-5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                 >
                    {loading ? 'Creating...' : <>Publish Assessment <ChevronRight className="group-hover:translate-x-1 transition-transform" /></>}
                 </button>
              </div>
           </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExam;
