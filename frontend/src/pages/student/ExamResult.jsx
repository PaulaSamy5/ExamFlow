import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Award, CheckCircle2, XCircle, AlertCircle, ArrowLeft, Trophy, Sparkles, RefreshCw, Save, Download, Clock, Sigma } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { toast } from 'react-hot-toast';
import UMLCanvas from '../../components/UMLCanvas';
import FormattedText from '../../components/FormattedText';

const MathRenderer = ({ tex, displayMode = false }) => {
  const containerRef = React.useRef(null);
  React.useEffect(() => {
    if (containerRef.current && window.katex) {
      try {
        window.katex.render(tex || '', containerRef.current, {
          throwOnError: false,
          displayMode: displayMode
        });
      } catch (e) {}
    }
  }, [tex, displayMode]);
  return <div ref={containerRef} />;
};

const ExamResult = () => {
  const { id } = useParams(); // submission id
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState({});
  
  const formatScore = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val);
    // Remove .00 if it's an integer
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  const parseOptions = (options) => {
    if (!options) return {};
    if (typeof options === 'object') return options;
    try { return JSON.parse(options); } catch (e) { return {}; }
  };

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data } = await api.get(`/submissions/${id}`);
        setSubmission(data);
      } catch (err) {
        toast.error('Failed to load assessment report');
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [id]);

  const handleUpdateScore = async (answerId, newScore) => {
    try {
      setGrading(prev => ({ ...prev, [answerId]: true }));
      const { data } = await api.patch(`/submissions/${submission.id}/answers/${answerId}`, { 
        scoreEarned: newScore 
      });
      setSubmission(prev => ({ 
        ...prev, 
        score: data.totalScore,
        answers: prev.answers.map(a => a.id === answerId ? { ...a, scoreEarned: parseFloat(newScore) } : a)
      }));
      toast.success('Grade finalized successfully');
    } catch (err) {
      toast.error('Failed to commit Grade');
    } finally {
      setGrading(prev => ({ ...prev, [answerId]: false }));
    }
  };

  const handleApproveAIGrade = async (answerId, manualScore = null) => {
    try {
      setGrading(prev => ({ ...prev, [answerId]: true }));
      const { data } = await api.post(`/submissions/${submission.id}/answers/${answerId}/approve-ai`, { 
        scoreEarned: manualScore 
      });
      setSubmission(prev => ({ 
        ...prev, 
        score: data.totalScore,
        answers: prev.answers.map(a => a.id === answerId ? { ...a, isAIGradeApproved: 1, scoreEarned: manualScore !== null ? parseFloat(manualScore) : a.scoreEarned } : a)
      }));
      toast.success('AI Grade released to student');
    } catch (err) {
      toast.error('Approval failed');
    } finally {
      setGrading(prev => ({ ...prev, [answerId]: false }));
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
      <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Generating Analytics Report...</p>
    </div>
  );

  if (!submission) return null;

  const { exam, score, answers, serverNow, scoreVisible } = submission;
  const isInstructor = user?.role === 'INSTRUCTOR';
  const showScore = scoreVisible !== false || isInstructor;
  const percentage = (score && exam.totalGrade) ? Math.round((score / exam.totalGrade) * 100) : 0;
  const isPassed = percentage >= 50;

  // Unified exam-level release mode
  const releaseMode = exam.requireAIGradeApproval === 1 ? 'manual_review' 
    : (exam.showResults === 2 ? 'after_deadline' : (exam.showResults === 0 ? 'hidden' : 'immediate'));
  const isPendingClosure = releaseMode === 'after_deadline' && new Date(serverNow) < new Date(exam.endTime);
  const isManualReview = releaseMode === 'manual_review' && !showScore;
  const isHidden = releaseMode === 'hidden';

  if (!isInstructor && (isHidden || isPendingClosure || isManualReview)) {
      const config = isManualReview 
        ? { title: 'Review In Progress', desc: 'AI has evaluated your answers. Scores will be released once the instructor completes their review.', color: 'cyan', icon: <Sparkles className="h-16 w-16 text-cyan-500 mx-auto mb-6 animate-pulse" /> }
        : isPendingClosure
        ? { title: 'Scheduled Release', desc: `Results are scheduled for release on ${new Date(exam.endTime).toLocaleString()}.`, color: 'amber', icon: <Clock className="h-16 w-16 text-amber-500 mx-auto mb-6 animate-pulse" /> }
        : { title: 'Classified Results', desc: 'Scores are currently hidden by the instructor.', color: 'rose', icon: <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-6" /> };
      
      return (
         <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-24 text-center mt-20">
            <div className={`glass rounded-[3rem] p-16 inline-block w-full max-w-lg border-opacity-20 relative overflow-hidden shadow-2xl border-${config.color}-500`}>
               <div className={`absolute top-0 left-0 w-full h-1.5 bg-${config.color}-500`} />
               
               <div className="relative z-10">
                 {config.icon}
                 <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">{config.title}</h2>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed max-w-sm mx-auto">{config.desc}</p>
                 <button onClick={() => navigate('/')} className="mt-8 px-10 py-4 font-black uppercase tracking-widest text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 transition-all border border-slate-300 dark:border-slate-700/50 rounded-xl w-full">
                   Return to Dashboard
                 </button>
               </div>
            </div>
         </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-fade-in pb-24 mt-8 px-2">
      {/* Back Button */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-500 transition-all group w-fit">
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 group-hover:bg-indigo-500/10 border border-slate-200 dark:border-slate-800 group-hover:border-indigo-500/30 transition-all">
           <ArrowLeft className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 group-hover:text-indigo-500 group-hover:-translate-x-0.5 transition-all" />
        </div>
        Return to Dashboard
      </button>

      {/* Hero Result Section - Structured Summary Card */}
      <header className={`relative overflow-hidden rounded-[2.5rem] p-[2px] shadow-xl transition-all duration-700 ${!showScore ? 'bg-gradient-to-br from-indigo-500/30 to-transparent' : isPassed ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-900/10' : 'bg-gradient-to-br from-rose-500/30 to-rose-900/10'}`}>
        <div className={`absolute inset-0 blur-3xl opacity-40 ${!showScore ? 'bg-indigo-500/20' : isPassed ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
        
        <div className={`relative bg-white/95 dark:bg-slate-950/90 backdrop-blur-3xl rounded-[2.4rem] p-10 border-l-[8px] flex flex-col md:flex-row items-center justify-between gap-10 ${!showScore ? 'border-l-indigo-500 border-white/10 dark:border-slate-800/50' : isPassed ? 'border-l-emerald-500 border-emerald-500/10 dark:border-emerald-500/20' : 'border-l-rose-500 border-rose-500/10 dark:border-rose-500/20'}`}>
           
           <div className="relative z-10 w-full md:w-3/5 space-y-6">
             <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm ${!showScore ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400' : isPassed ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
               {showScore && isPassed ? <CheckCircle2 className="h-4 w-4" /> : showScore && !isPassed ? <XCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4 animate-pulse" />}
               {!showScore ? 'Security Gate' : isPassed ? 'Passed' : 'Needs Improvement'}
             </div>

             <div>
               <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                 {exam.title}
               </h1>
               <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold flex items-center gap-2">
                 <span>Candidate:</span>
                 <span className="text-slate-800 dark:text-slate-200">{submission.studentName || user.name}</span>
               </p>
             </div>
           </div>

           <div className="relative z-10 w-full md:w-auto shrink-0 flex items-center justify-center md:justify-end gap-6 md:gap-10 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-8 md:pt-0 md:pl-10">
             {!showScore ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl relative">
                    <AlertCircle className="h-10 w-10 text-indigo-500 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500">Pending Review</span>
                </div>
             ) : (
                <>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Percentage</span>
                    <span className={`text-4xl md:text-5xl font-black tracking-tighter ${isPassed ? 'text-emerald-500' : 'text-rose-500'}`}>{percentage}%</span>
                  </div>
                  
                  <div className="h-16 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Score</span>
                    <div className="flex flex-col items-center">
                       <span className={`text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white`}>{formatScore(score)}</span>
                       <span className="text-xs text-slate-400 font-bold">/ {formatScore(exam.totalGrade)}</span>
                    </div>
                  </div>
                </>
             )}
           </div>
        </div>
      </header>

      {/* Answer Review Section */}
      <section className="space-y-10 mt-16">
        <div className="px-4 border-l-4 border-indigo-500 pl-6 space-y-2">
           <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Detailed Submissions Analysis</h3>
           <p className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Categorized results per academic objective.</p>
        </div>

        <div className="space-y-8">
          {exam.questions.map((q, idx) => {
            const studentAns = answers.find(a => a.questionId === q.id);
            const isCorrect = studentAns?.scoreEarned >= q.points && q.points > 0;
            const isEssay = q.type === 'ESSAY';
            const isCoding = q.type === 'CODING';
            const isPartiallyCorrect = studentAns?.scoreEarned > 0 && studentAns?.scoreEarned < q.points;

            return (
              <div key={q.id} className="relative group/card">
                <div className="absolute -inset-2 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-800/40 dark:to-slate-800/10 rounded-[2.5rem] blur-xl opacity-0 group-hover/card:opacity-100 transition duration-700 -z-10" />
                <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800/60 shadow-xl transition-all duration-500 border-l-[6px] hover:border-l-indigo-500 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 relative z-10">
                     <div className="space-y-6 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                           <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-black text-sm text-indigo-500 border border-indigo-500/20 shadow-inner">
                             {idx + 1}
                           </div>
                           <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
                             {q.type} Assessment
                           </span>
                           {isEssay && (() => {
                              const hasModelAnswer = typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0;
                              const releaseMode = exam.requireAIGradeApproval === 1 ? 'manual_review' : (exam.showResults === 2 ? 'after_deadline' : 'immediate');
                              if (hasModelAnswer) {
                                const labels = {
                                  'immediate': { text: 'AI Graded · Instant', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
                                  'after_deadline': { text: 'AI Graded · After Deadline', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
                                  'manual_review': { text: 'AI Graded · Manual Review', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' }
                                };
                                const l = labels[releaseMode] || labels.immediate;
                                return <span className={`px-3 py-1.5 rounded-lg border ${l.color} text-[9px] font-black uppercase tracking-widest shadow-sm`}>{l.text}</span>;
                              }
                              return <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest shadow-sm">Manual Grading</span>;
                           })()}
                           {isCoding && <span className="px-3 py-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-500 border border-fuchsia-500/20 text-[9px] font-black uppercase tracking-widest shadow-sm">Auto Sandbox</span>}
                        </div>

                        <FormattedText 
                          text={q.text}
                          className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-100 leading-snug break-words"
                        />
                        
                        {isCoding ? (
                          <div className="md:col-span-2 mt-4 space-y-4">
                            <div className="flex items-center gap-3 mb-2 px-2">
                               <RefreshCw className="h-4 w-4 text-fuchsia-400 opacity-50" />
                               <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-400">Automated Sandbox Diagnostics</h5>
                            </div>
                            
                            {(() => {
                               let testResults = [];
                               try { testResults = studentAns?.testResults ? (typeof studentAns.testResults === 'string' ? JSON.parse(studentAns.testResults) : studentAns.testResults) : []; } catch(e){}
                               
                               if (!testResults || testResults.length === 0) {
                                  return (
                                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 italic text-xs text-center">
                                       No diagnostic data available for this execution.
                                    </div>
                                  );
                               }

                               // Check for non-standard results (manual pending, mismatch, etc)
                               if (testResults[0]?.message) {
                                  const isLangError = testResults[0].message.toLowerCase().includes('language') || testResults[0].message.toLowerCase().includes('detection');
                                  return (
                                    <div className={`p-6 rounded-2xl border flex items-center gap-4 ${isLangError ? 'bg-rose-500/10 border-rose-500/50 text-rose-500' : testResults[0].status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/5 border-amber-500/20 text-amber-500'}`}>
                                       <AlertCircle className="h-6 w-6 shrink-0" />
                                       <div className="space-y-1">
                                          <p className="text-xs font-black uppercase tracking-widest">{isLangError ? 'Critical Protocol Rejection' : 'Execution Notice'}</p>
                                          <p className="text-xs font-bold leading-relaxed">{testResults[0].message}</p>
                                       </div>
                                    </div>
                                  );
                               }

                               return (
                                 <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40">
                                   <table className="w-full text-left text-[10px] border-collapse">
                                     <thead>
                                       <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                                         <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500">Case</th>
                                         <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500">Input Payload</th>
                                         <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500">Expected Vector</th>
                                         <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500">Machine Output</th>
                                         <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500 text-center">Status</th>
                                       </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-900">
                                       {testResults.map((tc, idx) => (
                                         <tr key={idx} className="hover:bg-slate-50 dark:bg-slate-900/40 transition-colors">
                                           <td className="px-5 py-4 font-black text-slate-600">#{idx + 1}</td>
                                           <td className="px-5 py-4 font-mono text-slate-500 dark:text-slate-400 whitespace-pre">{tc.input}</td>
                                           <td className="px-5 py-4 font-mono text-indigo-400 whitespace-pre">{tc.expected}</td>
                                           <td className={`px-5 py-4 font-mono whitespace-pre ${tc.status === 'pass' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                             {tc.actual || '(Empty Output)'}
                                           </td>
                                           <td className="px-5 py-4 text-center">
                                              {tc.status === 'pass' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-black uppercase tracking-widest text-[8px] border border-emerald-500/20">
                                                  <CheckCircle2 className="h-3 w-3" /> Pass
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-black uppercase tracking-widest text-[8px] border border-rose-500/20">
                                                  <XCircle className="h-3 w-3" /> Fail
                                                </span>
                                              )}
                                           </td>
                                         </tr>
                                       ))}
                                     </tbody>
                                   </table>
                                 </div>
                               );
                            })()}
                          </div>
                        ) : q.type === 'UML' ? (
                          <div className="md:col-span-2 mt-4 space-y-6">
                             {/* Header & Export */}
                             <div className="flex items-center justify-between gap-3 px-2">
                                <div className="flex items-center gap-3">
                                   <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                                      <Sparkles className="h-4 w-4 text-cyan-400" />
                                   </div>
                                   <div>
                                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 leading-none mb-1">Architectural Analysis</h5>
                                      <p className="text-[9px] text-slate-500 font-medium tracking-wide">Automated structural & semantic verification</p>
                                   </div>
                                </div>
                                {(() => {
                                   try {
                                     const data = JSON.parse(studentAns?.studentAnswer);
                                     if (data?.image && isInstructor) {
                                       return (
                                         <button 
                                           onClick={() => {
                                             const link = document.createElement('a');
                                             link.href = data.image;
                                             link.download = `Diagram_${submission.studentName}_Q${idx+1}.png`;
                                             link.click();
                                           }}
                                           className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-900 dark:text-white transition-all backdrop-blur-md shadow-xl"
                                         >
                                           <Download className="h-3.5 w-3.5 text-cyan-400" /> Export PNG
                                         </button>
                                       );
                                     }
                                   } catch(e) {}
                                   return null;
                                })()}
                             </div>

                             {/* Diagram Stage */}
                             {releaseMode === 'manual_review' && studentAns?.isAIGradeApproved === 0 && (
                                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4 flex items-center gap-3 animate-pulse">
                                   <AlertCircle className="h-5 w-5 text-indigo-400" />
                                   <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">This AI-calculated grade is hidden and awaiting instructor verification.</p>
                                </div>
                             )}
                             <div className="bg-[#080c18] min-h-[400px] h-auto rounded-[2rem] border border-slate-200 dark:border-slate-800/50 overflow-hidden relative shadow-2xl flex items-center justify-center group/stage">
                                {(() => {
                                   try {
                                     const data = JSON.parse(studentAns?.studentAnswer);
                                     if (data?.image) {
                                       return (
                                         <div className="relative w-full h-full flex items-center justify-center p-8">
                                           <img src={data.image} alt="Student Diagram" className="max-w-[95%] max-h-[500px] object-contain drop-shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-transform duration-700 group-hover/stage:scale-[1.02]" />
                                           <div className="absolute top-6 right-8 px-4 py-1.5 bg-cyan-500/10 backdrop-blur-xl rounded-full border border-cyan-500/20 text-[8px] font-black text-cyan-400 uppercase tracking-[0.2em] shadow-lg">Static Record</div>
                                         </div>
                                       );
                                     }
                                   } catch(e) {}
                                   return (
                                      <div className="w-full h-full p-6">
                                         <UMLCanvas 
                                            value={studentAns?.studentAnswer} 
                                            isEditable={false} 
                                            diagramType={parseOptions(q.options).diagramType} 
                                         />
                                      </div>
                                   );
                                })()}
                             </div>
                             
                             {/* Diagnostic Report Panel */}
                             <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-4">
                                   <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 rounded-[2rem] backdrop-blur-md">
                                      <div className="flex items-center gap-3 mb-4">
                                         <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                                         <h6 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Diagnostic Engine Insights</h6>
                                      </div>
                                      
                                      {(() => {
                                         try {
                                            const res = typeof studentAns?.testResults === 'string' ? JSON.parse(studentAns.testResults) : (studentAns?.testResults || []);
                                            const r = res[0];
                                            if (!r) return <p className="text-xs text-slate-500 italic">No diagnostic metadata available for this submission.</p>;
                                            
                                            // Enhanced parsing for the feedback string
                                            const parts = r.feedback.split('[Semantic Insights]:');
                                            const mainLog = parts[0].trim();
                                            const insights = parts[1] ? parts[1].split('|').map(s => s.trim()) : [];

                                            return (
                                               <div className="space-y-4">
                                                  <div className="p-4 bg-black/20 rounded-2xl border border-white/5 font-mono text-[11px] leading-relaxed">
                                                     <span className="text-cyan-400/80 mr-2">LOG:</span>
                                                     <span className="text-slate-600 dark:text-slate-300">{mainLog}</span>
                                                  </div>

                                                  {insights.length > 0 && (
                                                     <div className="grid gap-2">
                                                        {insights.map((insight, i) => {
                                                           const match = insight.match(/\[(.*?)\]\s*->\s*\[(.*?)\]\s*\((.*?)\)/);
                                                           if (match) {
                                                              return (
                                                                 <div key={i} className="flex items-center justify-between p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl group/insight hover:border-indigo-500/30 transition-all">
                                                                    <div className="flex items-center gap-3">
                                                                       <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 line-through opacity-40">{match[1]}</div>
                                                                       <div className="text-indigo-400">→</div>
                                                                       <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">{match[2]}</div>
                                                                    </div>
                                                                    <div className="text-[8px] font-black text-indigo-500/60 uppercase tracking-widest bg-indigo-500/5 px-2 py-1 rounded-md">{match[3]}</div>
                                                                 </div>
                                                              );
                                                           }
                                                           return <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/30 p-2 rounded-lg italic">{insight}</div>;
                                                        })}
                                                     </div>
                                                  )}

                                                  <div className="flex flex-wrap gap-2">
                                                     {r.missingNodes?.length > 0 && r.missingNodes.map((n, i) => (
                                                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                                           <div className="w-1 h-1 bg-rose-500 rounded-full animate-pulse" />
                                                           <span className="text-rose-400 text-[9px] font-black uppercase tracking-wider">Missing Element: {n}</span>
                                                        </div>
                                                     ))}
                                                     {r.missingEdges?.length > 0 && r.missingEdges.map((e, i) => (
                                                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                                           <div className="w-1 h-1 bg-orange-500 rounded-full" />
                                                           <span className="text-orange-400 text-[9px] font-black uppercase tracking-wider">Missing Connection: {e}</span>
                                                        </div>
                                                     ))}
                                                  </div>
                                               </div>
                                            );
                                         } catch(e) { return <p className="text-sm text-slate-500 italic px-2">Analysis log processing error.</p>; }
                                      })()}
                                   </div>
                                </div>

                                <div className="space-y-4">
                                   <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 rounded-[2rem] h-full flex flex-col justify-between backdrop-blur-md">
                                      <div>
                                         <h6 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-6">Performance Score</h6>
                                         {(() => {
                                            try {
                                              const res = typeof studentAns?.testResults === 'string' ? JSON.parse(studentAns.testResults) : (studentAns?.testResults || []);
                                              const r = res[0];
                                              if (!r) return null;

                                              return (
                                                <div className="space-y-6">
                                                   <div className="grid grid-cols-2 gap-3">
                                                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center">
                                                         <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-1">Graph Core</div>
                                                         <div className="text-xl font-black text-indigo-400 tracking-tighter">{r.graphScore || 0}%</div>
                                                      </div>
                                                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center">
                                                         <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-1">AI Semantic</div>
                                                         <div className="text-xl font-black text-fuchsia-400 tracking-tighter">{r.aiScore || 0}%</div>
                                                      </div>
                                                   </div>

                                                   <div className="relative p-6 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 rounded-3xl overflow-hidden text-center group/score">
                                                      <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover/score:opacity-100 transition-opacity blur-2xl" />
                                                      <div className="relative">
                                                         <div className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-2 shadow-sm">Blended Metric</div>
                                                         <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-2xl">{studentAns.score || r.blendedScore || 0}%</div>
                                                         <div className="mt-4 flex items-center justify-center gap-1">
                                                            {[1,2,3,4,5].map(s => (
                                                               <div key={s} className={`w-3 h-1 rounded-full ${s <= Math.ceil((studentAns.score || r.blendedScore || 0) / 20) ? 'bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-white/10'}`} />
                                                            ))}
                                                         </div>
                                                      </div>
                                                   </div>
                                                </div>
                                              );
                                            } catch(e) { return null; }
                                         })()}
                                      </div>
                                      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                                         <p className="text-[9px] text-slate-600 font-medium leading-relaxed uppercase tracking-wider">Certification Level: {studentAns.score >= 90 ? 'Master Architect' : studentAns.score >= 70 ? 'Advanced' : 'Standard Implementation'}</p>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          </div>
                        ) : q.type === 'MATH' ? (
                          <div className="md:col-span-2 mt-4 space-y-6">
                            <div className="flex items-center gap-3 mb-2 px-2">
                               <Sigma className="h-4 w-4 text-amber-500 opacity-50" />
                               <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Mathematical Logic Review</h5>
                            </div>

                            {(() => {
                               let studentData = { steps: '', finalAnswer: '' };
                               try { 
                                 const parsed = JSON.parse(studentAns?.studentAnswer || '{}'); 
                                 if (typeof parsed === 'object' && parsed !== null) studentData = { ...studentData, ...parsed };
                               } catch(e) { studentData.finalAnswer = studentAns?.studentAnswer || ''; }

                               let testRes = {};
                               try { 
                                 const parsedRes = studentAns?.testResults ? (typeof studentAns.testResults === 'string' ? JSON.parse(studentAns.testResults) : studentAns.testResults) : [];
                                 testRes = parsedRes[0] || {}; 
                               } catch(e) {}

                               return (
                                 <div className="space-y-4">
                                   <div className="grid md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                         <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-2">Student Solution Steps</p>
                                         <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl min-h-[100px] flex items-center justify-center">
                                            <MathRenderer tex={studentData.steps || "No steps provided."} displayMode={true} />
                                         </div>
                                      </div>
                                      <div className="space-y-2">
                                         <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-2">Student Final Result</p>
                                         <div className="h-[100px] flex items-center justify-center bg-amber-500/5 border border-amber-500/20 rounded-2xl text-2xl">
                                            <MathRenderer tex={studentData.finalAnswer || "Empty"} displayMode={true} />
                                         </div>
                                      </div>
                                   </div>

                                   {testRes.feedback && (
                                     <div className={`p-5 rounded-2xl border flex items-center gap-4 ${testRes.finalAnswerCorrect ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/5 border-amber-500/20 text-amber-500'}`}>
                                        <Sparkles className="h-6 w-6 shrink-0" />
                                        <div className="space-y-1">
                                           <p className="text-[10px] font-black uppercase tracking-widest">Diagnostic Feedback</p>
                                           <p className="text-xs font-bold leading-relaxed">{testRes.feedback}</p>
                                           <div className="flex items-center gap-4 mt-1">
                                              <span className="text-[9px] font-black uppercase opacity-60">Final Correct: {testRes.finalAnswerCorrect ? 'Yes' : 'No'}</span>
                                              <span className="text-[9px] font-black uppercase opacity-60">Step Quality: {testRes.stepQuality}%</span>
                                           </div>
                                        </div>
                                     </div>
                                   )}
                                   
                                   {isInstructor && (
                                     <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                                        <RefreshCw className="h-3 w-3" /> Correct Key: {q.correctAnswer}
                                     </div>
                                   )}
                                 </div>
                               );
                            })()}
                          </div>
                        ) : isEssay ? (
                          /* ═══════════════════════════════════════════════════════
                             ESSAY DETAILED FEEDBACK PANEL
                             ═══════════════════════════════════════════════════════ */
                          (() => {
                            let essayDetails = {};
                            let essayFeedback = '';
                            try {
                              const res = studentAns?.testResults ? (typeof studentAns.testResults === 'string' ? JSON.parse(studentAns.testResults) : studentAns.testResults) : [];
                              const r = res[0] || {};
                              essayDetails = r.details || {};
                              essayFeedback = r.feedback || '';
                            } catch(e) {}

                            const breakdown = essayDetails.breakdown || {};
                            const strengths = essayDetails.strengths || [];
                            const weaknesses = essayDetails.weaknesses || [];
                            const suggestions = essayDetails.suggestions || [];
                            const coveredConcepts = essayDetails.coveredConcepts || [];
                            const missingConcepts = essayDetails.missingConcepts || [];
                            const similarity = essayDetails.similarity || 0;
                            const hasRichFeedback = strengths.length > 0 || weaknesses.length > 0 || Object.keys(breakdown).length > 0;

                            const dimensionLabels = {
                              contentUnderstanding: { label: 'Content Understanding', icon: '📚', color: 'indigo' },
                              accuracy: { label: 'Accuracy', icon: '🎯', color: 'emerald' },
                              clarity: { label: 'Clarity & Expression', icon: '✍️', color: 'cyan' },
                              conceptCoverage: { label: 'Concept Coverage', icon: '🧩', color: 'amber' },
                            };

                            return (
                              <div className="mt-6 space-y-6">
                                {/* Student Answer Display */}
                                <div className="space-y-3">
                                   <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] ml-2">Your Response</p>
                                   <div className="p-6 rounded-2xl border-[1.5px] bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-200 dark:border-indigo-500/20 flex items-start gap-4 min-h-[5rem] shadow-sm">
                                     <div className="mt-1 shrink-0 p-1.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                                       <AlertCircle className="h-5 w-5 text-indigo-500" />
                                     </div>
                                     <span className="text-base font-bold leading-relaxed break-words whitespace-pre-wrap text-indigo-900 dark:text-indigo-400">
                                       {studentAns?.studentAnswer || "No Response Candidate Provided"}
                                     </span>
                                   </div>
                                </div>

                                {hasRichFeedback && (
                                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800/50 overflow-hidden shadow-lg">
                                    {/* Why This Score? Header */}
                                    <div className="px-8 py-6 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border-b border-slate-200 dark:border-slate-800/50">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-sm">
                                          <Sparkles className="h-5 w-5 text-indigo-500" />
                                        </div>
                                        <div>
                                          <h5 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">Why This Score?</h5>
                                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">{essayFeedback}</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="p-8 space-y-8">
                                      {/* Score Breakdown */}
                                      {Object.keys(breakdown).length > 0 && (
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                                            <h6 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 dark:text-slate-300">Score Breakdown</h6>
                                          </div>
                                          <div className="grid gap-3">
                                            {Object.entries(breakdown).map(([key, val]) => {
                                              const dim = dimensionLabels[key] || { label: key, icon: '📊', color: 'slate' };
                                              const pct = val.max > 0 ? Math.round((val.score / val.max) * 100) : 0;
                                              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                                              const bgColor = pct >= 80 ? 'bg-emerald-500/5 border-emerald-500/10' : pct >= 50 ? 'bg-amber-500/5 border-amber-500/10' : 'bg-rose-500/5 border-rose-500/10';
                                              
                                              return (
                                                <div key={key} className={`p-4 rounded-2xl border ${bgColor} transition-all hover:shadow-md`}>
                                                  <div className="flex items-center justify-between mb-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                      <span className="text-base">{dim.icon}</span>
                                                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 tracking-wide">{dim.label}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-slate-800 dark:text-white bg-white/60 dark:bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                                                      {val.score}/{val.max}
                                                    </span>
                                                  </div>
                                                  <div className="relative h-2.5 bg-slate-200/60 dark:bg-slate-800/60 rounded-full overflow-hidden">
                                                    <div 
                                                      className={`absolute top-0 left-0 h-full rounded-full ${barColor} transition-all duration-700 ease-out shadow-sm`}
                                                      style={{ width: `${pct}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Strengths & Weaknesses Grid */}
                                      <div className="grid md:grid-cols-2 gap-5">
                                        {/* Strengths */}
                                        {strengths.length > 0 && (
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                              <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                              <h6 className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">What You Did Well</h6>
                                            </div>
                                            <div className="space-y-2">
                                              {strengths.map((s, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/15 transition-all hover:border-emerald-300 dark:hover:border-emerald-500/30">
                                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 leading-relaxed">{s}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Weaknesses */}
                                        {weaknesses.length > 0 && (
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                              <div className="w-1 h-5 bg-amber-500 rounded-full" />
                                              <h6 className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">Areas to Improve</h6>
                                            </div>
                                            <div className="space-y-2">
                                              {weaknesses.map((w, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/15 transition-all hover:border-amber-300 dark:hover:border-amber-500/30">
                                                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">{w}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Concept Tags */}
                                      {(coveredConcepts.length > 0 || missingConcepts.length > 0) && (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1 h-5 bg-purple-500 rounded-full" />
                                            <h6 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 dark:text-slate-300">Concept Analysis</h6>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {coveredConcepts.map((c, i) => (
                                              <span key={`c-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200/50 dark:border-emerald-500/20">
                                                <CheckCircle2 className="h-3 w-3" />
                                                {c}
                                              </span>
                                            ))}
                                            {missingConcepts.map((m, i) => (
                                              <span key={`m-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold border border-rose-200/50 dark:border-rose-500/20">
                                                <XCircle className="h-3 w-3" />
                                                {m}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Improvement Suggestions */}
                                      {suggestions.length > 0 && (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1 h-5 bg-cyan-500 rounded-full" />
                                            <h6 className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-400">How to Improve</h6>
                                          </div>
                                          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-50/50 to-blue-50/30 dark:from-cyan-500/5 dark:to-blue-500/5 border border-cyan-200/50 dark:border-cyan-500/15">
                                            <div className="space-y-2.5">
                                              {suggestions.map((s, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                  <span className="text-cyan-500 font-black text-xs mt-0.5 shrink-0">💡</span>
                                                  <span className="text-xs font-semibold text-cyan-900 dark:text-cyan-300 leading-relaxed">{s}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Semantic Similarity Indicator */}
                                      {similarity > 0 && (
                                        <div className="flex items-center justify-between p-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Semantic Alignment</span>
                                          <div className="flex items-center gap-3">
                                            <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full rounded-full transition-all duration-700 ${similarity >= 80 ? 'bg-emerald-500' : similarity >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                style={{ width: `${Math.min(100, similarity)}%` }}
                                              />
                                            </div>
                                            <span className={`text-xs font-black ${similarity >= 80 ? 'text-emerald-500' : similarity >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                              {similarity}%
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Fallback: simple feedback if no rich data */}
                                {!hasRichFeedback && essayFeedback && (
                                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center gap-4">
                                    <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />
                                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 leading-relaxed">{essayFeedback}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <>
                            <div className="mt-8 space-y-4">
                               <div className="grid md:grid-cols-2 gap-4">
                                  {/* Student Answer */}
                                  <div className="space-y-2">
                                     <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] ml-2">Your Answer</p>
                                     <div className={`p-5 rounded-2xl border-[1.5px] flex items-start gap-4 min-h-[4rem] transition-all shadow-sm ${
                                       isCorrect ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : 
                                       isPartiallyCorrect ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' : 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20'
                                     }`}>
                                       <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                                         {isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                                       </div>
                                       <span className={`text-sm font-bold leading-relaxed break-words whitespace-pre-wrap ${isCorrect ? 'text-emerald-900 dark:text-emerald-400' : 'text-rose-900 dark:text-rose-400'}`}>
                                         {studentAns?.studentAnswer || "No Response Provided"}
                                       </span>
                                     </div>
                                  </div>

                                  {/* Correct Answer Reference */}
                                  {!isCorrect && (
                                     <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] ml-2">Correct Answer</p>
                                        <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/80 border-[1.5px] border-slate-200 dark:border-slate-800 flex items-start gap-4 min-h-[4rem] shadow-sm">
                                           <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                                              <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-80" />
                                           </div>
                                           <span className="text-sm font-bold leading-relaxed break-words whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                                              {q.correctAnswer || <span className="italic text-slate-400">View in Assessment Session / Instructor Override</span>}
                                           </span>
                                        </div>
                                     </div>
                                  )}
                               </div>
                            </div>
                          </>
                        )}
                   </div>

                   {/* Grade Control */}
                   <div className="shrink-0 w-full md:w-48 p-8 bg-slate-50 dark:bg-slate-950/80 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/80 flex flex-col items-center justify-between gap-6 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                         <Award className="h-24 w-24" />
                      </div>
                      
                      <div className="text-center relative z-10 w-full">
                        <span className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-[0.2em] block mb-3 bg-indigo-50 dark:bg-indigo-500/10 py-1.5 px-3 rounded-lg border border-indigo-100 dark:border-indigo-500/20 shadow-sm">Academic Points</span>
                        <div className="text-3xl font-black text-slate-900 dark:text-white flex flex-col items-center gap-1">
                           {studentAns?.status === 'PENDING_REVIEW' ? (
                              <span className="text-sm text-cyan-500 uppercase tracking-widest mt-2">In Review</span>
                           ) : studentAns?.status === 'SCHEDULED_RELEASE' ? (
                              <span className="text-sm text-amber-500 uppercase tracking-widest mt-2">Pending Release</span>
                           ) : (
                              <>
                                <span>{formatScore(studentAns?.scoreEarned || (isInstructor ? studentAns?.aiScore : 0))}</span> 
                                <span className="text-xs text-slate-400 uppercase tracking-widest border-t border-slate-200 dark:border-slate-800/80 w-1/2 pt-1 mt-1">/ {formatScore(q.points)}</span>
                              </>
                           )}
                        </div>
                      </div>
                      
                      {isInstructor && (isEssay || q.type === 'UML') && (
                        <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800 relative z-10">
                          {releaseMode === 'manual_review' && studentAns?.isAIGradeApproved === 0 && (
                            <button 
                              disabled={grading[studentAns.id]}
                              onClick={() => handleApproveAIGrade(studentAns.id)}
                              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest rounded-xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-cyan-500/20 text-white transform active:scale-95"
                            >
                              {grading[studentAns.id] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                              <span>Accept AI ({formatScore(studentAns.aiScore)})</span>
                            </button>
                          )}

                          <div className="relative group/input w-full">
                            <span className="absolute -top-2 left-3 bg-white dark:bg-slate-950 px-1 text-[8px] font-black uppercase tracking-widest text-slate-400 z-10">Adjust</span>
                            <input 
                               type="number"
                               max={q.points}
                               min={0}
                               step="0.01"
                               className="w-full h-12 bg-transparent border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-center font-black text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                               placeholder="Score"
                               id={`grade-${studentAns.id}`}
                               defaultValue={studentAns?.isAIGradeApproved === 0 ? studentAns.aiScore : studentAns?.scoreEarned}
                            />
                          </div>
                          
                          <button 
                            disabled={grading[studentAns.id]}
                            onClick={() => {
                              const input = document.getElementById(`grade-${studentAns.id}`);
                              if (input.value !== '') {
                                if (studentAns?.isAIGradeApproved === 0) {
                                   handleApproveAIGrade(studentAns.id, input.value);
                                } else {
                                   handleUpdateScore(studentAns.id, input.value);
                                }
                              }
                            }}
                            className="w-full h-12 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-md"
                          >
                            {grading[studentAns.id] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Commit
                          </button>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ExamResult;
