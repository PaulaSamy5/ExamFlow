import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { 
  Plus, Trash2, Save, ArrowLeft, 
  HelpCircle, Type, CheckSquare, AlignLeft,
  Calendar, Clock, Award, Loader2, AlertCircle,
  FolderPlus, GripVertical, ChevronDown, ChevronUp,
  EyeOff, Sparkles, CheckCircle2, Circle, XCircle, PlusCircle, Code, ShieldCheck, Sigma
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import UMLCanvas from '../../components/UMLCanvas';
import RichTextEditor from '../../components/RichTextEditor';

const MathRenderer = ({ tex, displayMode = false }) => {
  const containerRef = useRef(null);
  useEffect(() => {
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

// ── Types ────────────────────────────────────────────────
const Q_TYPES = [
  { type: 'MCQ',         icon: CheckSquare, label: 'MCQ',        color: 'text-indigo-400' },
  { type: 'TRUE_FALSE',  icon: Type,        label: 'True/False', color: 'text-emerald-400' },
  { type: 'FILL_BLANKS', icon: HelpCircle,  label: 'Fill Blank', color: 'text-amber-400'  },
  { type: 'ESSAY',       icon: AlignLeft,   label: 'Essay',      color: 'text-rose-400'   },
  { type: 'CODING',      icon: Code,        label: 'Coding',     color: 'text-fuchsia-400' },
  { type: 'UML',         icon: Sparkles,    label: 'UML Diagram', color: 'text-cyan-400'    },
  { type: 'MATH',        icon: Sigma,      label: 'Math / Equation', color: 'text-amber-500' },
];

const LANGUAGES = [
  { id: 'any', label: 'Any', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'javascript', label: 'JavaScript', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'python', label: 'Python', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'cpp', label: 'C++', color: 'text-sky-400', bg: 'bg-sky-400/10' },
];

const makeQuestion = (type) => ({
  type,
  text: '',
  isMultiple: false,
  points: 10,
  options: type === 'MCQ' ? ['', '', '', ''] : (type === 'CODING' ? JSON.stringify({ 
    title: '',
    requiredLanguage: 'any',
    inputDescription: '', 
    outputDescription: '', 
    sampleInput: '', 
    sampleOutput: '', 
    testCases: [{input: '', expectedOutput: ''}] 
  }) : (type === 'UML' ? JSON.stringify({
    title: '',
    diagramType: 'Use Case',
    useAI: false,
    studentImage: '',
    modelImage: ''
  }) : (type === 'MATH' ? JSON.stringify({
    modelSteps: [],
    correctFinalAnswer: '',
    tolerance: 0.01
  }) : (type === 'ESSAY' ? JSON.stringify({ useAI: false }) : null)))),
  correctAnswer: type === 'TRUE_FALSE' ? 'True' : (type === 'UML' ? JSON.stringify({ nodes: [], edges: [] }) : '')
});

const makeSection = (title = 'New Section') => ({
  id: Date.now(),
  title,
  questions: []
});

// ── Inline Add Bar (shown after every question + at section end) ──
const AddBar = ({ onAddQuestion }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 my-3 px-1">
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800/80" />

      {open ? (
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-indigo-500/30 rounded-2xl px-3 py-2 shadow-xl shadow-indigo-900/10 animate-fade-in">
          {Q_TYPES.map(btn => (
            <button
              key={btn.type}
              type="button"
              onClick={() => { onAddQuestion(btn.type); setOpen(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 ${btn.color} transition-all whitespace-nowrap`}
            >
              <btn.icon className="h-3.5 w-3.5" />
              {btn.label}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)}
            className="ml-1 p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 transition-all">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-slate-100 dark:bg-slate-800 transition-all whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Question
        </button>
      )}

      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800/80" />
    </div>
  );
};

// ── Question Card ────────────────────────────────────────
const QuestionCard = ({ q, qNum, onUpdate, onRemove, onOptionUpdate, onAddOption, onRemoveOption, onToggleMultiple }) => (
  <div className="rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm overflow-hidden transition-all hover:border-indigo-500/30 group/card relative">
    {/* Card top strip with neon accent */}
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
    
    <div className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-sm font-black text-indigo-400 border border-indigo-500/20 shadow-inner">
          {qNum}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Question Type</span>
          <span className={`text-xs font-bold uppercase tracking-widest ${Q_TYPES.find(t => t.type === q.type)?.color || 'text-slate-600 dark:text-slate-300'}`}>{q.type}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 text-slate-600 transition-all opacity-0 group-hover/card:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>

    {/* Card body */}
    <div className="p-8 space-y-6">
      {(() => {
        let codingOpts = { title: '', requiredLanguage: 'javascript' };
        if (q.type === 'CODING') {
          try { codingOpts = q.options ? JSON.parse(q.options) : codingOpts; } catch(e){}
        }
        return (
          <>
            {q.type === 'CODING' && (
              <div className="space-y-6 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Problem Title</label>
                    <input required className="input-field w-full text-lg font-black" placeholder="e.g. Two Sum" value={codingOpts.title || ''} onChange={e => {
                      try {
                        const parsed = q.options ? JSON.parse(q.options) : {};
                        onUpdate('options', JSON.stringify({...parsed, title: e.target.value}));
                      } catch(err) {}
                    }} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Required Language</label>
                    <div className="flex gap-2 p-1 bg-white dark:bg-slate-950/40 border border-slate-300 dark:border-slate-700/50 rounded-2xl">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => onUpdate('options', JSON.stringify({...codingOpts, requiredLanguage: lang.id}))}
                          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${codingOpts.requiredLanguage === lang.id ? `${lang.bg} ${lang.color} ring-1 ring-${lang.color.split('-')[1]}-500/30` : 'text-slate-600 hover:text-slate-500 dark:text-slate-400'}`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {q.type === 'UML' && (() => {
              let umlOpts = { title: '', diagramType: 'Use Case' };
              try { umlOpts = q.options ? JSON.parse(q.options) : umlOpts; } catch(e){}
              return (
                <div className="space-y-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block ml-2">Scenario Title</label>
                    <input 
                      required 
                      className="input-field w-full text-lg font-black bg-white dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 focus:border-cyan-500/50" 
                      placeholder="e.g. Hospital Management System" 
                      value={umlOpts.title || ''} 
                      onChange={e => onUpdate('options', JSON.stringify({...umlOpts, title: e.target.value}))} 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Diagram Type</label>
                      <select 
                        className="input-field w-full text-sm bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200"
                        value={umlOpts.diagramType}
                        onChange={e => onUpdate('options', JSON.stringify({...umlOpts, diagramType: e.target.value}))}
                      >
                        {['Use Case', 'Activity', 'Class', 'ERD', 'Sequence'].map(t => (
                          <option key={t} value={t}>{t} Diagram</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Evaluation Grade</label>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-[10px] font-black text-cyan-500 uppercase">
                        <Sparkles size={14} /> Hybrid AI Engine
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-9 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">
                  {q.type === 'CODING' ? 'Problem Description' : q.type === 'UML' ? 'System Scenario / Requirements' : 'Question Statement'}
                </label>
                
                <RichTextEditor
                  value={q.text || ''}
                  onChange={val => onUpdate('text', val)}
                  placeholder={
                    q.type === 'CODING' ? "Explain the algorithm requirements..." 
                    : q.type === 'UML' ? "Describe the system requirements..."
                    : "Write your question here..."
                  }
                />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] block mb-1 opacity-0 pointer-events-none hidden sm:block">Pts</label>
                <input
                  type="number" min="1" required
                  className="input-field w-full text-center font-bold text-amber-400"
                  placeholder="pts"
                  value={q.points}
                  onChange={e => onUpdate('points', e.target.value)}
                />
              </div>
            </div>
          </>
        );
      })()}

      {/* MCQ */}
      {q.type === 'MCQ' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-300 dark:border-slate-700/50">
             <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Multiple Selection</span>
             </div>
             <button
               type="button"
               onClick={() => onToggleMultiple(!q.isMultiple)}
               className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${q.isMultiple ? 'bg-indigo-600' : 'bg-slate-700'}`}
             >
               <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${q.isMultiple ? 'translate-x-6' : 'translate-x-1'}`} />
             </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt, oIndex) => {
              const parsedCorrect = (() => {
                const isMultiple = q.isMultiple === 1 || q.isMultiple === true;
                if (!isMultiple) return q.correctAnswer;
                try { return JSON.parse(q.correctAnswer || '[]'); } catch(e) { return []; }
              })();
              const isMultipleMode = q.isMultiple === 1 || q.isMultiple === true;
              const isSelected = isMultipleMode 
                ? (Array.isArray(parsedCorrect) && parsedCorrect.includes(opt))
                : q.correctAnswer === `idx:${oIndex}`;

              return (
                <div key={oIndex} className="group/opt relative">
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${isSelected && opt !== '' ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/40 hover:border-slate-600'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isMultipleMode) {
                          const current = Array.isArray(parsedCorrect) ? parsedCorrect : [];
                          const next = current.includes(opt) ? current.filter(x => x !== opt) : [...current, opt];
                          onUpdate('correctAnswer', JSON.stringify(next));
                        } else {
                          onUpdate('correctAnswer', `idx:${oIndex}`);
                        }
                      }}
                      className="shrink-0 transition-transform active:scale-95"
                    >
                      {isSelected && opt !== '' ? (
                        <CheckCircle2 className="h-5 w-5 text-indigo-500 fill-indigo-500/10" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-600 group-hover/opt:text-slate-500" />
                      )}
                    </button>
                    
                    <input
                      required
                      className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-600"
                      placeholder={`Option ${oIndex + 1}...`}
                      value={opt}
                      onChange={e => onOptionUpdate(oIndex, e.target.value)}
                    />

                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => onRemoveOption(oIndex)}
                        className="opacity-0 group-hover/opt:opacity-100 p-1 rounded-lg hover:bg-rose-500/10 text-rose-500/50 hover:text-rose-500 transition-all"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {q.options.length < 8 && (
              <button
                type="button"
                onClick={onAddOption}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:border-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all text-xs font-black uppercase tracking-widest"
              >
                <PlusCircle className="h-4 w-4" />
                Add Option
              </button>
            )}
          </div>
        </div>
      )}

      {/* True/False */}
      {q.type === 'TRUE_FALSE' && (
        <div className="flex gap-3">
          {['True', 'False'].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => onUpdate('correctAnswer', val)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm border transition-all ${q.correctAnswer === val ? 'bg-indigo-600 border-indigo-500 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'}`}
            >
              {val}
            </button>
          ))}
        </div>
      )}

      {/* Complete / Fill blank */}
      {q.type === 'FILL_BLANKS' && (
        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-indigo-500/20">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="text-indigo-400 font-bold">Tip:</span> Use <strong className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-900 dark:text-white">___</strong> (three underscores) in your question text to mark the blank. (e.g., "The capital of France is ___")
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Target Word:</span>
            <input
              required
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all rounded-lg px-3 py-2 w-full text-emerald-400 font-bold text-sm"
              placeholder="e.g. Paris"
              value={q.correctAnswer}
              onChange={e => onUpdate('correctAnswer', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Essay */}
      {q.type === 'ESSAY' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-slate-100 dark:bg-slate-800/40 p-4 rounded-xl border border-indigo-500/30">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 mt-0.5">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest block mb-1">AI Semantic Evaluation Always Active</span>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Automated meaning-based grading is active. You must provide a highly accurate <strong className="text-indigo-400">Model Answer</strong> below. The AI will evaluate the student's submission by comparing its semantic meaning to this reference. If left blank, the question will require manual grading.
              </p>
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block ml-2 flex items-center gap-2">
               <CheckCircle2 className="h-3 w-3" /> Model Answer (AI Reference)
             </label>
             <textarea
               rows={4}
               className="input-field w-full text-xs leading-relaxed p-4 rounded-xl border border-slate-300 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/60 focus:bg-slate-50 dark:bg-slate-900 focus:border-indigo-500/50 transition-all font-medium text-slate-700 dark:text-slate-200"
               placeholder="Provide the ideal answer here. The AI will compare the student's submission to this text's meaning..."
               value={q.correctAnswer || ''}
               onChange={e => onUpdate('correctAnswer', e.target.value)}
             />
          </div>
        </div>
      )}

      {q.type === 'CODING' && (
        <div className="space-y-4 pt-4 border-t border-slate-300 dark:border-slate-700/50 mt-4">
           {(() => {
              let codingOpts = { title: '', requiredLanguage: 'javascript', inputDescription: '', outputDescription: '', sampleInput: '', sampleOutput: '', testCases: [] };
              try { codingOpts = q.options ? JSON.parse(q.options) : codingOpts; } catch(e){}
              return (
                <div className="space-y-6">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Input Description</label>
                       <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="E.g. The first line contains an integer T..." value={codingOpts.inputDescription} onChange={e => onUpdate('options', JSON.stringify({...codingOpts, inputDescription: e.target.value}))} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Output Description</label>
                       <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="E.g. For each test case print..." value={codingOpts.outputDescription} onChange={e => onUpdate('options', JSON.stringify({...codingOpts, outputDescription: e.target.value}))} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Sample Input</label>
                       <textarea className="input-field w-full text-sm font-mono whitespace-pre resize-none bg-white dark:bg-slate-950/50" rows={3} placeholder="Sample standard input..." value={codingOpts.sampleInput} onChange={e => onUpdate('options', JSON.stringify({...codingOpts, sampleInput: e.target.value}))} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Sample Output</label>
                       <textarea className="input-field w-full text-sm font-mono whitespace-pre resize-none bg-white dark:bg-slate-950/50" rows={3} placeholder="Expected output for sample..." value={codingOpts.sampleOutput} onChange={e => onUpdate('options', JSON.stringify({...codingOpts, sampleOutput: e.target.value}))} />
                     </div>
                   </div>

                   <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-fuchsia-500/20">
                      <div className="flex items-center justify-between">
                         <label className="text-[11px] font-black uppercase tracking-widest text-fuchsia-400 flex items-center gap-2">
                           <EyeOff className="h-4 w-4" /> Hidden Test Cases (Auto-Grading)
                         </label>
                         <button type="button" onClick={() => {
                           onUpdate('options', JSON.stringify({...codingOpts, testCases: [...(codingOpts.testCases||[]), {input:'', expectedOutput:''}]}));
                           setTimeout(() => {
                             const el = document.getElementById(`test-container-${q._uid}`);
                             if (el) el.scrollTop = el.scrollHeight;
                           }, 50);
                         }} className="text-[10px] font-bold bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                           <Plus className="h-3 w-3" /> Add Case
                         </button>
                      </div>
                      <div id={`test-container-${q._uid}`} className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar scroll-smooth p-1">
                        {(codingOpts.testCases || []).length === 0 && (
                           <p className="text-xs text-slate-500 italic text-center py-4">No test cases added. Code will automatically pass if submitted.</p>
                        )}
                        {(codingOpts.testCases || []).map((tc, tcIdx) => (
                           <div key={tcIdx} className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 relative group/tc">
                              <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase text-slate-600">Input</span>
                                <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none focus:border-fuchsia-500 rounded p-2 text-xs font-mono resize-none text-slate-600 dark:text-slate-300" placeholder="Input" rows={2} value={tc.input} onChange={e => { const newTc = [...codingOpts.testCases]; newTc[tcIdx].input = e.target.value; onUpdate('options', JSON.stringify({...codingOpts, testCases: newTc})); }} />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase text-slate-600">Expected Output</span>
                                <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none focus:border-fuchsia-500 rounded p-2 text-xs font-mono resize-none text-slate-600 dark:text-slate-300" placeholder="Expected Output" rows={2} value={tc.expectedOutput} onChange={e => { const newTc = [...codingOpts.testCases]; newTc[tcIdx].expectedOutput = e.target.value; onUpdate('options', JSON.stringify({...codingOpts, testCases: newTc})); }} />
                              </div>
                              <button type="button" onClick={() => { const newTc = codingOpts.testCases.filter((_, i) => i !== tcIdx); onUpdate('options', JSON.stringify({...codingOpts, testCases: newTc})); }} className="absolute -top-2 -right-2 bg-rose-500 text-slate-900 dark:text-white rounded-full p-1 opacity-0 group-hover/tc:opacity-100 transition-all hover:scale-110 shadow-lg"><XCircle className="h-3.5 w-3.5" /></button>
                           </div>
                        ))}
                      </div>
                   </div>
                </div>
              );
           })()}
        </div>
      )}

      {q.type === 'UML' && (
        <div className="space-y-4 pt-4 border-t border-slate-300 dark:border-slate-700/50 mt-4">
          {(() => {
            let umlOpts = { diagramType: 'Use Case', useAI: false };
            try { umlOpts = q.options ? JSON.parse(q.options) : umlOpts; } catch(e){}
            return (
              <div className="space-y-6">


                <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-cyan-500/20">
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                     <AlertCircle className="h-4 w-4 text-cyan-400" />
                     Draw the <strong>Model Diagram</strong> (Reference) below. Students will be graded based on similarity to this structure.
                   </p>
                   {/* We will implement UMLCanvas soon */}
                   <div className="bg-white dark:bg-slate-950 h-[550px] rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 font-bold uppercase tracking-widest text-[10px] relative overflow-hidden">
                      <UMLCanvas 
                        value={q.correctAnswer} 
                        onChange={val => onUpdate('correctAnswer', val)}
                        onImageExport={img => onUpdate('options', JSON.stringify({...umlOpts, modelImage: img}))}
                        diagramType={umlOpts.diagramType}
                        isEditable={true}
                      />
                   </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {q.type === 'MATH' && (
        <div className="space-y-6 pt-4 border-t border-slate-300 dark:border-slate-700/50 mt-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-amber-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                <Sigma className="h-4 w-4" /> Math Reference Configuration
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Correct Final Answer</label>
                  <div className="space-y-2">
                    <input 
                      required 
                      className="input-field w-full text-lg font-black text-amber-500" 
                      placeholder="e.g. 1/2 or 0.5 or x^2" 
                      value={q.correctAnswer} 
                      onChange={e => onUpdate('correctAnswer', e.target.value)} 
                    />
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[50px] flex items-center justify-center text-amber-500">
                      <MathRenderer tex={q.correctAnswer || '\\text{No answer set}'} displayMode={true} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Grading Mode</label>
                    <select 
                      className="input-field w-full text-xs font-bold h-[42px] bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                      value={(() => {
                        try { 
                          const opts = typeof q.options === 'string' ? JSON.parse(q.options || '{}') : (q.options || {});
                          return opts.gradingMode || 'final_answer'; 
                        } catch(e) { return 'final_answer'; }
                      })()}
                      onChange={e => {
                        try {
                          const opts = JSON.parse(q.options || '{}');
                          onUpdate('options', JSON.stringify({...opts, gradingMode: e.target.value}));
                        } catch(err) {}
                      }}
                    >
                      <option value="final_answer">Final Answer Only</option>
                      <option value="checkpoints">Flexible Checkpoints</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Numeric Tolerance</label>
                    <input 
                      type="number" step="0.001"
                      className="input-field w-full text-sm font-bold h-[42px]" 
                      value={(() => {
                        try { return JSON.parse(q.options || '{}').tolerance || 0.01; } catch(e) { return 0.01; }
                      })()} 
                      onChange={e => {
                        try {
                          const opts = JSON.parse(q.options || '{}');
                          onUpdate('options', JSON.stringify({...opts, tolerance: parseFloat(e.target.value)}));
                        } catch(err) {}
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Optional Checkpoints
                  </label>
                  <button type="button" onClick={() => {
                    try {
                      const opts = JSON.parse(q.options || '{}');
                      const cps = opts.checkpoints || [];
                      onUpdate('options', JSON.stringify({...opts, checkpoints: [...cps, '']}));
                    } catch(e){}
                  }} className="text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Value
                  </button>
                </div>
                {(() => {
                  let cps = [];
                  try { cps = JSON.parse(q.options || '{}').checkpoints || []; } catch(e){}
                  if (cps.length === 0) return <p className="text-[11px] text-slate-500 italic p-2 hidden md:block">No checkpoints required. Final answer provides full credit.</p>;
                  
                  return (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      {cps.map((cp, idx) => (
                        <div key={idx} className="flex items-center gap-2 relative group/cp">
                           <input 
                              className="input-field w-full py-2 px-3 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                              placeholder="e.g. x=5 or 2.5"
                              value={cp}
                              onChange={e => {
                                try {
                                  const opts = JSON.parse(q.options || '{}');
                                  const newCps = [...(opts.checkpoints||[])];
                                  newCps[idx] = e.target.value;
                                  onUpdate('options', JSON.stringify({...opts, checkpoints: newCps}));
                                } catch(err){}
                              }}
                           />
                           <button type="button" onClick={() => {
                              try {
                                  let opts = JSON.parse(q.options || '{}');
                                  opts.checkpoints = (opts.checkpoints||[]).filter((_, i) => i !== idx);
                                  onUpdate('options', JSON.stringify(opts));
                              } catch(err){}
                           }} className="text-rose-400 p-1 opacity-0 group-hover/cp:opacity-100 hover:text-rose-500 transition-all absolute right-2">
                              <XCircle className="h-4 w-4" />
                           </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {(() => {
                  let mode = 'final_answer';
                  try { mode = JSON.parse(q.options || '{}').gradingMode || 'final_answer'; } catch(e){}
                  if (mode === 'checkpoints') {
                    return <p className="text-[10px] text-amber-500/70 mt-2 italic flex items-start gap-1"><AlertCircle className="h-3 w-3 min-w-[12px] mt-0.5" /> Checkpoint Mode: The AI will scan the student's solution steps to match these values. Order does not matter.</p>
                  }
                  return null;
                })()}
              </div>
            </div>


          </div>
        </div>
      )}
    </div>
  </div>
);

// ── Helpers ──────────────────────────────────────────────
const getLocalNow = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatToLocalISO = (dateStr) => {
  if (!dateStr) return '';
  // Try to parse carefully to avoid timezone jumps
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  
  const pad = (n) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// ── Main Page ────────────────────────────────────────────
const CreateExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Strongly sync native draft at process initial render to eliminate race condition 
  const [draftState] = useState(() => {
    try {
      const d = localStorage.getItem(`exam_draft_${id || 'new'}`);
      if (d) return JSON.parse(d);
    } catch(e) {}
    return null;
  });

  const [step, setStep] = useState(draftState?.step || 1);
  
  // Scroll to top when internal step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id && !draftState);
  const [errors, setErrors] = useState({});
  const [exam, setExam] = useState(draftState?.exam || {
    title: '',
    description: '',
    totalGrade: 100,
    duration: '',
    startTime: getLocalNow(),
    endTime: '',
    showResults: null,
    requireAIGradeApproval: 0,
  });
  const [sections, setSections] = useState(draftState?.sections || [{ id: 1, title: 'Section 1', questions: [] }]);
  const [isAutoGrade, setIsAutoGrade] = useState(true);

  useEffect(() => {
    if (id && !draftState) {
      const fetchExam = async () => {
        try {
          const { data } = await api.get(`/exams/${id}`);
          setExam({
            title: data.title,
            description: data.description || '',
            totalGrade: data.totalGrade,
            duration: data.duration,
            startTime: formatToLocalISO(data.startTime),
            endTime: formatToLocalISO(data.endTime),
            showResults: data.showResults !== 0 ? data.showResults : 0,
            requireAIGradeApproval: data.requireAIGradeApproval || 0,
          });

          if (data.questions) {
            setSections([{
              id: 1,
              title: 'Assessment Content',
              questions: data.questions.map(q => {
                 let initialCorrect = q.correctAnswer;
                 if (q.type === 'MCQ' && q.isMultiple !== 1 && q.correctAnswer) {
                    const idx = (q.options && Array.isArray(q.options)) ? q.options.indexOf(q.correctAnswer) : -1;
                    if (idx !== -1) initialCorrect = `idx:${idx}`;
                 }
                 let opts = q.options;
                 if (opts && typeof opts === 'object') {
                    opts = JSON.stringify(opts);
                 }
                 return { 
                   ...q, 
                   text: q.text || '',
                   correctAnswer: initialCorrect || '', 
                   options: opts || '', 
                   _uid: q.id || `q-${Math.random().toString(36).substr(2, 9)}` 
                 };
              })
            }]);
          }
          const sum = data.questions?.reduce((acc, q) => acc + q.points, 0) || 0;
          setIsAutoGrade(sum === data.totalGrade);
        } catch (err) {
          toast.error('Failed to connect to assessment unit');
          navigate('/');
        } finally {
          setFetching(false);
        }
      };
      fetchExam();
    }
  }, [id, navigate, draftState]);

  // Soft Auto-Cache draft locally
  useEffect(() => {
    if (!fetching) {
       localStorage.setItem(`exam_draft_${id || 'new'}`, JSON.stringify({ exam, sections, step }));
    }
  }, [exam, sections, step, id, fetching]);

  const allQuestions = sections.flatMap(s => s.questions);
  const totalPoints = allQuestions.reduce((sum, q) => sum + parseFloat(q.points || 0), 0);
  const pointsOk = isAutoGrade ? true : totalPoints <= parseFloat(exam.totalGrade || 0);

  // ── Validation Logic ──
  const validateStep1 = () => {
    const newErrors = {};
    if (!exam.title.trim()) newErrors.title = 'Title is required';
    if (!exam.duration || exam.duration <= 0) newErrors.duration = 'Valid duration is required';
    if (!exam.startTime) newErrors.startTime = 'Start time is required';
    if (!exam.endTime) newErrors.endTime = 'End time is required';
    if (exam.showResults === null) newErrors.showResults = 'Please choose result visibility';

    if (exam.startTime && exam.endTime) {
      const start = new Date(exam.startTime);
      const end = new Date(exam.endTime);
      const now = new Date();
      if (end < now) newErrors.endTime = 'End time cannot be in the past';
      else if (end <= start) newErrors.endTime = 'End time must be after start time';
      else if (exam.duration > 0) {
        const minEnd = new Date(start.getTime() + exam.duration * 60000);
        if (end < minEnd) newErrors.endTime = `End time must be at least ${exam.duration} mins after start`;
      }
    }

    setErrors(newErrors);
    const errorCount = Object.keys(newErrors).length;
    
    if (errorCount > 1) {
      toast.error('All fields are required', { id: 'v-error' });
    } else if (errorCount === 1) {
      toast.error(Object.values(newErrors)[0], { id: 'v-error' });
    }

    return errorCount === 0;
  };

  const addQuestionToSection = (sectionId, type, afterIndex = null) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const q = { ...makeQuestion(type), _uid: `${sectionId}-${Date.now()}` };
      if (afterIndex === null) return { ...s, questions: [...s.questions, q] };
      const qs = [...s.questions];
      qs.splice(afterIndex + 1, 0, q);
      return { ...s, questions: qs };
    }));
  };

  const addOption = (sectionId, qIndex) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const questions = [...s.questions];
      questions[qIndex] = { ...questions[qIndex], options: [...questions[qIndex].options, ''] };
      return { ...s, questions };
    }));
  };

  const removeOption = (sectionId, qIndex, oIndex) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const questions = [...s.questions];
      const q = { ...questions[qIndex] };
      const optVal = q.options[oIndex];
      const nextOptions = q.options.filter((_, i) => i !== oIndex);
      let nextCorrect = q.correctAnswer;
      if (q.isMultiple) {
         try {
           const parsed = JSON.parse(q.correctAnswer || '[]');
           nextCorrect = JSON.stringify(parsed.filter(x => x !== optVal));
         } catch(e) { nextCorrect = '[]'; }
      } else if (q.correctAnswer === optVal) nextCorrect = '';
      questions[qIndex] = { ...q, options: nextOptions, correctAnswer: nextCorrect };
      return { ...s, questions };
    }));
  };

  const toggleMultiple = (sectionId, qIndex, val) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const questions = [...s.questions];
      questions[qIndex] = { ...questions[qIndex], isMultiple: val, correctAnswer: val ? '[]' : '' };
      return { ...s, questions };
    }));
  };

  const removeQuestion = (sectionId, qIndex) => {
    setSections(prev => prev.map(s => s.id !== sectionId ? s : { ...s, questions: s.questions.filter((_, i) => i !== qIndex) }));
  };

  const updateQuestion = (sectionId, qIndex, field, value) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const questions = [...s.questions];
      questions[qIndex] = { ...questions[qIndex], [field]: value };
      return { ...s, questions };
    }));
  };

  const updateOption = (sectionId, qIndex, oIndex, value) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const questions = [...s.questions];
      const q = { ...questions[qIndex] };
      const wasCorrect = q.correctAnswer === q.options[oIndex];
      const options = [...q.options];
      options[oIndex] = value;
      q.options = options;
      if (wasCorrect) q.correctAnswer = value;
      questions[qIndex] = q;
      return { ...s, questions };
    }));
  };

  const addSection = (afterSectionId) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === afterSectionId);
      const next = [...prev];
      next.splice(idx + 1, 0, makeSection(`Section ${prev.length + 1}`));
      return next;
    });
  };

  const removeSection = (id) => {
    if (sections.length === 1) { toast.error("Can't remove the last section"); return; }
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const updateSectionTitle = (id, title) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    
    if (allQuestions.length === 0) { toast.error('Required: At least one question exists'); return; }
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      if (q.type !== 'ESSAY' && q.type !== 'CODING' && q.type !== 'UML' && !q.correctAnswer) {
        toast.error(`Set a valid answer for Question #${i + 1}`); return;
      }
    }
    if (!isAutoGrade && !pointsOk) { toast.error(`Points overflow (${totalPoints} > ${exam.totalGrade})`); return; }

    setLoading(true);
    try {
      const questions = allQuestions.map(({ _uid, id: qId, ...q }) => {
        const payload = { ...q };
        const isNotMultiple = !payload.isMultiple || payload.isMultiple === 0;
        if (payload.type === 'MCQ' && isNotMultiple && String(payload.correctAnswer).startsWith('idx:')) {
           const idx = parseInt(payload.correctAnswer.split(':')[1]);
           payload.correctAnswer = (payload.options && payload.options[idx]) ? payload.options[idx] : payload.correctAnswer;
        }
        if (payload.type === 'CODING' && typeof payload.options === 'string') {
           try { payload.options = JSON.parse(payload.options); } catch(e) { payload.options = {}; }
        }
        return payload;
      });

      const finalExam = { ...exam, totalGrade: isAutoGrade ? totalPoints : exam.totalGrade };
      if (id) {
        await api.put(`/exams/${id}`, { ...finalExam, questions });
        toast.success('Matrix updated');
      } else {
        await api.post('/exams', { ...finalExam, questions });
        toast.success('Assessment live!');
      }
      localStorage.removeItem(`exam_draft_${id || 'new'}`); // Purge safety cache on successful transmission
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Transmission failure';
      toast.error(`Control Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex flex-col items-center pt-12 space-y-6 animate-pulse">
      <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Initializing Assessment Workspace...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-32 px-6 pt-0"> {/* Strictly top-aligned */}
      
      {/* Dynamic Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => step === 1 ? navigate(-1) : setStep(1)}
            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-white hover:border-slate-300 dark:border-slate-700 transition-all shadow-xl shadow-black/20 group">
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-inner ${step === 1 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {step === 1 ? 'Phase 01 — Blueprint' : 'Phase 02 — Construction'}
               </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {id ? 'Refactoring Assessment' : 'New Assessment Unit'}
            </h1>
          </div>
        </div>

        {/* Stepper with percentages */}
        <div className="flex items-center gap-8 pr-2">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{step === 1 ? 'Next: Build Questions' : 'Total Grade Allocation'}</p>
              <p className="text-sm font-black text-indigo-400">{step === 1 ? 'Configuration Phase' : `${totalPoints} Points Established`}</p>
           </div>
           <div className="flex gap-2 h-12 items-center">
              <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${step >= 1 ? 'bg-indigo-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
              <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${step >= 2 ? 'bg-indigo-500 text-indigo-400' : 'bg-slate-100 dark:bg-slate-800'}`} />
           </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">

        {step === 1 && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
            {/* ── Section A: Core Identity ── */}
            <div className="glass rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800/60 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600/80 shadow-[0_0_20px_rgba(79,70,229,0.5)]" />
              
              <div className="flex items-center gap-4 mb-8">
                 <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 border border-indigo-500/30 shadow-inner">
                    <Sparkles className="h-6 w-6 text-indigo-400" />
                 </div>
                 <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none mb-1.5">Assessment Core</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Establish the primary identifiers & rules</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-12 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    Title Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    className={`input-field w-full text-xl h-14 rounded-2xl border-2 bg-slate-50 dark:bg-slate-900/40 transition-all ${errors.title ? 'border-rose-500/50 bg-rose-500/5' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'}`} 
                    placeholder="e.g. DATA-602 FINAL EXAM"
                    value={exam.title} onChange={e => {
                        setExam({ ...exam, title: e.target.value.toUpperCase() });
                        setErrors(prev => ({ ...prev, title: null }));
                    }} />
                </div>

                <div className="md:col-span-12 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Rules & Instructions</label>
                  <textarea rows={4} className="input-field w-full text-sm rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 focus:border-indigo-500/50 resize-none p-5"
                    placeholder="What should students know before joining? Specify rules, allowed materials, etc."
                    value={exam.description} onChange={e => setExam({ ...exam, description: e.target.value })} />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2"><Award className="h-3.5 w-3.5" /> Total Grade</label>
                  <div className="relative">
                     <input 
                      type="number" min="1" disabled={isAutoGrade} 
                      className={`input-field w-full h-14 text-center text-lg font-black rounded-2xl border-2 transition-all ${isAutoGrade ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'}`}
                      value={isAutoGrade ? totalPoints : exam.totalGrade} 
                      onChange={e => setExam({ ...exam, totalGrade: e.target.value })} 
                    />
                    <button type="button" onClick={() => setIsAutoGrade(!isAutoGrade)} 
                      className={`absolute -top-3 -right-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl border transition-all ${isAutoGrade ? 'bg-indigo-600 border-indigo-400 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                      {isAutoGrade ? 'Auto-sum' : 'Static'}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span><Clock className="h-3.5 w-3.5 inline mr-1" /> Duration</span>
                    <span className="text-[9px] text-slate-600">Minutes</span>
                  </label>
                  <input type="number" min="1" 
                    className={`input-field w-full h-14 text-center text-lg font-black rounded-2xl border-2 bg-slate-50 dark:bg-slate-900/40 ${errors.duration ? 'border-rose-500/50 bg-rose-500/5' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'}`}
                    value={exam.duration} onChange={e => {
                        setExam({ ...exam, duration: e.target.value });
                        setErrors(prev => ({ ...prev, duration: null }));
                    }} />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"><Calendar className="h-3.5 w-3.5 inline mr-1" /> Start Date</label>
                  <input type="datetime-local" className="input-field w-full h-14 text-[10px] font-black rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 focus:border-indigo-500/50"
                    value={exam.startTime} onChange={e => {
                        setExam({ ...exam, startTime: e.target.value });
                        setErrors(prev => ({ ...prev, startTime: null, endTime: null }));
                    }} />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span><Calendar className="h-3.5 w-3.5 inline mr-1" /> End Date</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input type="datetime-local" 
                    className={`input-field w-full h-14 text-[10px] font-black rounded-2xl border-2 bg-slate-50 dark:bg-slate-900/40 transition-all ${errors.endTime ? 'border-rose-500/50 bg-rose-500/5' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500/50'}`}
                    value={exam.endTime} onChange={e => {
                        setExam({ ...exam, endTime: e.target.value });
                        setErrors(prev => ({ ...prev, endTime: null }));
                    }} />
                </div>
              </div>
            </div>

            {/* Section B: Results Strategy */}
            <div className="glass rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800/60 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] rounded-full pointer-events-none" />
               
               <div className="flex items-center gap-4 mb-8">
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                     <Eye className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1.5">Result Release Mode</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Determine when students access their final grades</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { mode: 1, approval: 0, label: 'Immediate Release', icon: Sparkles, desc: 'Displayed instantly upon submission' },
                    { mode: 2, approval: 0, label: 'After Deadline', icon: Clock, desc: 'Wait until the global end-time' },
                    { mode: 0, approval: 1, label: 'Manual Review', icon: ShieldCheck, desc: 'Requires instructor approval for AI grades' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                          setExam({ ...exam, showResults: item.mode, requireAIGradeApproval: item.approval });
                          setErrors(prev => ({ ...prev, showResults: null }));
                      }}
                      className={`flex flex-col items-center gap-3 p-8 rounded-[2rem] border-2 text-center transition-all duration-500 relative group animate-in slide-in-from-bottom-2 ${
                        (exam.showResults === item.mode && exam.requireAIGradeApproval === item.approval)
                        ? 'bg-indigo-600 border-white/20 shadow-[0_20px_40px_rgba(79,70,229,0.4)] ring-4 ring-indigo-500/10 scale-105 z-10' 
                        : 'bg-white dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/50 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                      }`}
                    >
                      <item.icon className={`h-8 w-8 mb-1 ${exam.showResults === item.mode ? 'text-slate-900 dark:text-white' : 'text-slate-600'}`} />
                      <div>
                        <p className={`text-xs font-black uppercase tracking-[0.1em] ${exam.showResults === item.mode ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{item.label}</p>
                        <p className={`text-[9px] font-bold leading-tight mt-2 opacity-80 ${exam.showResults === item.mode ? 'text-indigo-100' : 'text-slate-600'}`}>{item.desc}</p>
                      </div>
                      
                      {item.approval === 1 && (
                         <div className="mt-3 px-3 py-1 rounded-full bg-black/40 border border-white/5 text-[8px] font-black uppercase tracking-widest text-indigo-200">
                           AI Approval Required
                         </div>
                      )}
                    </button>
                  ))}
               </div>

               {exam.requireAIGradeApproval === 1 && (
                  <div className="mt-8 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
                     <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                     <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold italic">
                       Manual Review is active. AI will calculate scores, but they will remain hidden from students until you manually verify and release them via the performance dashboard.
                     </p>
                  </div>
               )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
            {sections.map((section, sIdx) => {
              let globalQNum = sections.slice(0, sIdx).reduce((acc, s) => acc + s.questions.length, 0);
              return (
                <div key={section.id} className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-500">
                  <div className="flex items-center gap-4 px-2 group/sec">
                    <div className="h-8 w-1.5 rounded-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.6)]" />
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-2xl font-black text-slate-900 dark:text-white hover:text-indigo-400 focus:text-indigo-400 transition-all placeholder-slate-800"
                      value={section.title}
                      onChange={e => updateSectionTitle(section.id, e.target.value)}
                      placeholder="Enter Section Title..."
                    />
                    <div className="flex items-center gap-3">
                       <span className="text-[11px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-5 py-2 rounded-2xl uppercase tracking-[0.2em] shadow-inner">
                         {section.questions.length} Items
                       </span>
                       {sections.length > 1 && (
                         <button type="button" onClick={() => removeSection(section.id)}
                           className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-600 transition-all shadow-lg active:scale-95">
                           <Trash2 className="h-5 w-5" />
                         </button>
                       )}
                    </div>
                  </div>

                  <div className="pl-6 border-l-4 border-slate-900/80 space-y-6">
                    {section.questions.length === 0 && (
                      <div className="py-16 text-center border-3 border-dashed border-slate-900 rounded-[3rem] bg-slate-50 dark:bg-slate-900/10 group hover:border-indigo-500/20 transition-all">
                        <PlusCircle className="h-12 w-12 text-slate-800 mx-auto mb-5 group-hover:text-indigo-500/30 transition-all duration-500" />
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-700 mb-8 group-hover:text-slate-500 transition-all">Workspace Interface Offline</p>
                        <AddBar onAddQuestion={type => addQuestionToSection(section.id, type)} />
                      </div>
                    )}

                    {section.questions.map((q, qIdx) => (
                      <div key={q._uid || qIdx} className="space-y-2">
                        <QuestionCard
                          q={q} qNum={globalQNum + qIdx + 1}
                          onUpdate={(field, val) => updateQuestion(section.id, qIdx, field, val)}
                          onRemove={() => removeQuestion(section.id, qIdx)}
                          onOptionUpdate={(oIdx, val) => updateOption(section.id, qIdx, oIdx, val)}
                          onAddOption={() => addOption(section.id, qIdx)}
                          onRemoveOption={(oIdx) => removeOption(section.id, qIdx, oIdx)}
                          onToggleMultiple={(val) => toggleMultiple(section.id, qIdx, val)}
                        />
                        <AddBar onAddQuestion={type => addQuestionToSection(section.id, type, qIdx)} />
                      </div>
                    ))}
                  </div>

                  {sIdx === sections.length - 1 && (
                    <button
                      type="button"
                      onClick={() => addSection(section.id)}
                      className="w-full h-20 flex items-center justify-center gap-4 rounded-[2rem] border-3 border-dashed border-slate-900 text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 hover:border-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all mt-6 group shadow-2xl"
                    >
                      <Plus className="h-5 w-5 transition-transform group-hover:rotate-180 duration-700" />
                      Spawn New Sub-Section
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Fixed Interaction Matrix ── */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-[100]">
           <div className="glass backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-5 shadow-[0_30px_60px_rgba(0,0,0,0.6)] flex items-center justify-between ring-1 ring-white/10 group">
              <div className="flex items-center gap-6 pl-4 border-l-2 border-slate-300 dark:border-slate-700/50">
                 <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">Grade Status</p>
                    <div className="flex items-center gap-3">
                       <span className={`text-2xl font-black tracking-tighter ${pointsOk ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                         {totalPoints} <span className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">/ {isAutoGrade ? totalPoints : (exam.totalGrade || '??')}</span>
                       </span>
                       {pointsOk && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />}
                    </div>
                 </div>

                 <div className="hidden md:block pl-6 border-l-2 border-slate-300 dark:border-slate-700/50">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-2">Local Draft Active</p>
                    <div className="flex items-center gap-2">
                       <Save className="h-4 w-4 text-indigo-500" />
                       <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Progress saved securely</span>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 pr-2">
                 {step === 2 && (
                    <button 
                      type="button" 
                      onClick={() => setStep(1)}
                      className="h-14 px-8 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700 active:scale-95"
                    >
                       Previous Phase
                    </button>
                 )}

                 <button
                   type="submit"
                   disabled={loading || (step === 2 && !pointsOk)}
                   className={`h-14 px-10 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-4 transition-all duration-300 shadow-2xl active:scale-95 min-w-[200px] justify-center ${
                     step === 1 
                     ? 'bg-white text-slate-950 hover:bg-indigo-50 shadow-white/5' 
                     : 'bg-indigo-600 text-slate-900 dark:text-white hover:bg-indigo-500 shadow-indigo-600/30'
                   } disabled:opacity-40 disabled:cursor-not-allowed`}
                 >
                   {loading ? (
                     <Loader2 className="animate-spin h-5 w-5" />
                   ) : (
                     <>
                       {step === 1 ? 'Go to Construction' : (id ? 'Update Assessment' : 'Broadcast Live')}
                       <Sparkles className="h-4 w-4" />
                     </>
                   )}
                 </button>
              </div>
           </div>
        </div>

      </form>
    </div>
  );
};

export default CreateExam;
