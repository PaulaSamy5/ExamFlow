import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import ErrorBoundary from '../../components/ErrorBoundary';
import { FieldError } from '../../components/FieldError';
import {
  Plus, Trash2, Save, ArrowLeft,
  HelpCircle, Type, CheckSquare, AlignLeft,
  Calendar, Clock, Award, Loader2, AlertCircle, AlertTriangle, Lock,
  FolderPlus, GripVertical, ChevronDown, ChevronUp, Layout,
  EyeOff, Eye, Sparkles, CheckCircle, Circle, XCircle, PlusCircle, Code, ShieldCheck, Calculator,
  Printer, BookOpen, Paintbrush, Building, FileText, Upload, Image, QrCode
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import UMLCanvas from '../../components/UMLCanvas';
import RichTextEditor from '../../components/RichTextEditor';
import { useAuth } from '../../store/AuthContext';

const MathRenderer = ({ tex, displayMode = false }) => {
  const containerRef = useRef(null);
  useEffect(() => {
    if (containerRef.current && window.katex) {
      try {
        window.katex.render(tex || '', containerRef.current, {
          throwOnError: false,
          displayMode: displayMode
        });
      } catch (e) { }
    }
  }, [tex, displayMode]);
  return <div ref={containerRef} />;
};

// ── Types ────────────────────────────────────────────────
const Q_TYPES = [
  { type: 'MCQ', icon: CheckSquare, label: 'MCQ', color: 'text-indigo-400' },
  { type: 'TRUE_FALSE', icon: Type, label: 'True/False', color: 'text-emerald-400' },
  { type: 'FILL_BLANKS', icon: HelpCircle, label: 'Fill Blank', color: 'text-amber-400' },
  { type: 'ESSAY', icon: AlignLeft, label: 'Essay', color: 'text-rose-400' },
  { type: 'CODING', icon: Code, label: 'Coding', color: 'text-fuchsia-400' },
  { type: 'UML', icon: Sparkles, label: 'UML Diagram', color: 'text-cyan-400' },
  { type: 'MATH', icon: Calculator, label: 'Math (Soon 🚀)', color: 'text-amber-500', disabled: true },
];

const LANGUAGES = [
  { id: 'any', label: 'Any', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'javascript', label: 'JavaScript', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'python', label: 'Python', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'cpp', label: 'C++', color: 'text-sky-400', bg: 'bg-sky-400/10' },
];

const getIsMultiple = (q) => {
  if (!q) return false;
  return q.isMultiple === 1 || q.isMultiple === true || q.isMultiple === '1' ||
         q.ismultiple === 1 || q.ismultiple === true || q.ismultiple === '1';
};

const getCorrectAnswer = (q) => {
  if (!q) return '';
  return q.correctAnswer !== undefined ? q.correctAnswer : (q.correctanswer !== undefined ? q.correctanswer : '');
};

const convertAnswerMode = (q, toMultiple) => {
  const current = getCorrectAnswer(q);
  const options = q.options || [];

  if (toMultiple) {
    if (typeof current === 'string' && current.startsWith('idx:')) {
      const idx = parseInt(current.split(':')[1]);
      if (!isNaN(idx) && idx >= 0 && idx < options.length) {
        const optText = options[idx];
        return JSON.stringify([optText]);
      }
    }
    try {
      const parsed = typeof current === 'string' ? JSON.parse(current) : current;
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch (e) {}
    return '[]';
  } else {
    let parsed = [];
    try {
      parsed = typeof current === 'string' ? JSON.parse(current) : (Array.isArray(current) ? current : []);
    } catch (e) {}
    if (Array.isArray(parsed) && parsed.length > 0) {
      const firstOpt = parsed[0];
      const idx = options.indexOf(firstOpt);
      if (idx !== -1) {
        return `idx:${idx}`;
      }
    }
    return '';
  }
};

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
    testCases: [{ input: '', expectedOutput: '' }]
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
  description: '',
  questions: []
});

// ── Inline Add Bar (shown after every question + at section end) ──
const AddBar = ({ onAddQuestion }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 my-3 px-1">
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800/80" />

      {open ? (
        <div className="flex flex-wrap lg:flex-nowrap justify-center items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-indigo-500/30 rounded-2xl px-2 py-1.5 shadow-xl shadow-indigo-900/10 animate-fade-in w-full">
          {Q_TYPES.map(btn => (
            <button
              key={btn.type}
              type="button"
              disabled={btn.disabled}
              onClick={() => { if (!btn.disabled) { onAddQuestion(btn.type); setOpen(false); } }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 whitespace-nowrap border shrink-0 ${btn.disabled
                  ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                  : `bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 ${btn.color} hover:scale-105 hover:shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:border-indigo-400/50 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-700`
                }`}
            >
              <btn.icon className="h-3.5 w-3.5" />
              {btn.label}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)}
            className="ml-1 p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 transition-all shrink-0">
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
const QuestionCard = ({ q, qNum, onUpdate, onRemove, onOptionUpdate, onAddOption, onRemoveOption, onToggleMultiple, hasError, errorMessages = [], examType, isLocked = false }) => (
  <div className={`rounded-[2.5rem] border backdrop-blur-sm overflow-hidden transition-all relative group/card ${
    hasError 
      ? 'border-rose-500 bg-rose-50/5 dark:bg-rose-950/5 ring-1 ring-rose-500/20' 
      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:border-indigo-500/30'
  }`}>
    {/* Card top strip with neon accent */}
    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isLocked ? 'from-transparent via-amber-500 to-transparent' : hasError ? 'from-transparent via-rose-500 to-transparent' : 'from-transparent via-indigo-500/20 to-transparent'}`} />

    <div className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800/50">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 flex items-center justify-center rounded-2xl text-sm font-black border shadow-inner transition-colors ${hasError ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
          {qNum}
        </div>
        {(() => {
          const typeInfo = Q_TYPES.find(t => t.type === q.type);
          const TypeIcon = typeInfo?.icon;
          return (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 ${typeInfo?.color || 'text-slate-500'}`}>
              {TypeIcon && <TypeIcon className="h-3 w-3" />}
              {typeInfo?.label || q.type}
            </span>
          );
        })()}
        {isLocked && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-in fade-in duration-200">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            Locked
          </span>
        )}
        {!isLocked && hasError && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-in fade-in duration-200">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {errorMessages.length === 1 ? 'Fix 1 issue' : `Fix ${errorMessages.length} issues`}
          </span>
        )}
      </div>
      {!isLocked && (
        <button
          type="button"
          onClick={onRemove}
          className="p-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 text-slate-600 transition-all opacity-0 group-hover/card:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>

    {/* Card body */}
    <div className="p-4 sm:p-8 space-y-6">
      {(() => {
        const parsedOptions = (() => {
          try {
            if (!q.options) return q.type === 'MCQ' ? [] : {};
            if (typeof q.options === 'string') {
              const parsed = JSON.parse(q.options);
              return parsed ?? (q.type === 'MCQ' ? [] : {});
            }
            if (q.type === 'MCQ' && !Array.isArray(q.options)) return [];
            return q.options;
          } catch (e) {
            return q.type === 'MCQ' ? [] : {};
          }
        })();
        let codingOpts = { title: '', requiredLanguage: 'javascript' };
        if (q.type === 'CODING') {
          codingOpts = typeof parsedOptions === 'object' ? { ...codingOpts, ...parsedOptions } : codingOpts;
        }
        return (
          <>
            {q.type === 'CODING' && (
              <div className="space-y-6 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                  {(() => {
                    const hasTitleErr = errorMessages.some(m => /Missing: Problem Title/i.test(m));
                    return (
                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest block ml-2 ${hasTitleErr ? 'text-rose-500' : 'text-slate-500'}`}>Problem Title</label>
                        <input
                          disabled={isLocked}
                          className={`input-field w-full text-lg font-black disabled:opacity-70 disabled:cursor-not-allowed ${hasTitleErr ? 'border-rose-500 dark:border-rose-500/80 bg-rose-50/40 dark:bg-rose-950/20' : ''}`}
                          placeholder="e.g. Two Sum"
                          value={codingOpts.title || ''}
                          onChange={e => {
                            try {
                              const parsed = q.options ? JSON.parse(q.options) : {};
                              onUpdate('options', JSON.stringify({ ...parsed, title: e.target.value }));
                            } catch (err) {}
                          }}
                        />
                        {hasTitleErr && (
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Problem title is required.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Required Language</label>
                    <div className="flex gap-2 p-1 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700/50 rounded-2xl">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => onUpdate('options', JSON.stringify({ ...codingOpts, requiredLanguage: lang.id }))}
                          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all disabled:opacity-60 disabled:cursor-not-allowed ${codingOpts.requiredLanguage === lang.id ? `${lang.bg} ${lang.color} ring-1 ring-${lang.color.split('-')[1]}-500/30` : 'text-slate-600 hover:text-slate-500 dark:text-slate-400'}`}
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
              try { umlOpts = q.options ? JSON.parse(q.options) : umlOpts; } catch (e) { }
              return (
                <div className="space-y-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block ml-2">Scenario Title</label>
                    <input
                      required
                      disabled={isLocked}
                      className="input-field w-full text-lg font-black bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 focus:border-cyan-500/50 disabled:opacity-70 disabled:cursor-not-allowed"
                      placeholder="e.g. Hospital Management System"
                      value={umlOpts.title || ''}
                      onChange={e => onUpdate('options', JSON.stringify({ ...umlOpts, title: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Diagram Type</label>
                      <select
                        disabled={isLocked}
                        className="input-field w-full text-sm bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        value={umlOpts.diagramType}
                        onChange={e => onUpdate('options', JSON.stringify({ ...umlOpts, diagramType: e.target.value }))}
                      >
                        {['Use Case', 'Activity', 'Class', 'ERD', 'Sequence'].map(t => (
                          <option key={t} value={t}>{t} Diagram</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Evaluation Grade</label>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-[10px] font-black text-cyan-500 uppercase">
                        <Sparkles size={14} /> Hybrid AI Engine
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const hasTextError   = errorMessages.some(m => /Missing: (Question Statement|Problem Description|System Scenario)/i.test(m));
              const hasPointsError = errorMessages.some(m => /Missing: Points/i.test(m));
              const fieldLabel = q.type === 'CODING' ? 'Problem Description' : q.type === 'UML' ? 'System Scenario / Requirements' : 'Question Statement';
              return (
                <div className="space-y-2">
                  {/* Label row — both labels share one horizontal line so neither can push the inputs out of sync */}
                  <div className="flex items-center gap-3">
                    <label className={`flex-1 text-[10px] font-black uppercase tracking-widest ml-2 ${hasTextError ? 'text-rose-500' : 'text-slate-500'}`}>
                      {fieldLabel}
                      {hasTextError && <span className="ml-1 normal-case tracking-normal font-medium">— required</span>}
                    </label>
                    <label className={`w-24 shrink-0 text-[10px] font-black uppercase tracking-widest text-center ${hasPointsError ? 'text-rose-500' : 'text-slate-500'}`}>
                      Points
                    </label>
                  </div>
                  {/* Input row — editor and points input always start at the same level */}
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <RichTextEditor
                        value={q.text}
                        onChange={val => onUpdate('text', val)}
                        disabled={isLocked}
                        placeholder={
                          q.type === 'CODING' ? "Explain the algorithm requirements..."
                            : q.type === 'UML' ? "Describe the system requirements..."
                              : "Write your question here..."
                        }
                      />
                    </div>
                    <div className="w-24 shrink-0 space-y-1">
                      <input
                        type="number" min="1"
                        disabled={isLocked}
                        className={`input-field w-full text-center font-bold text-amber-400 transition-all disabled:opacity-70 disabled:cursor-not-allowed ${hasPointsError ? 'border-rose-500 dark:border-rose-500/80 bg-rose-50/40 dark:bg-rose-950/20 focus:ring-rose-500/20' : ''}`}
                        placeholder="pts"
                        value={q.points}
                        onChange={e => onUpdate('points', e.target.value)}
                      />
                      {hasPointsError && (
                        <p className="flex items-center justify-center gap-1 text-[10px] font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in duration-200">
                          <AlertCircle className="h-3 w-3 shrink-0" /> Required
                        </p>
                      )}
                    </div>
                  </div>
                  {hasTextError && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {fieldLabel} is required.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* MCQ — must be inside this IIFE so parsedOptions is in scope */}
            {q.type === 'MCQ' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-300 dark:border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Multiple Selection</span>
                  </div>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => onToggleMultiple(!q.isMultiple)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${q.isMultiple ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${q.isMultiple ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {q.isMultiple && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>This question allows students to choose more than one choice.</span>
                  </div>
                )}

                {(() => {
                  const optsArr = Array.isArray(parsedOptions) ? parsedOptions : [];
                  const trimmedOpts = optsArr.map(o => String(o).trim().toLowerCase());
                  const hasEmptyOptErr = errorMessages.some(m => /Missing: Option [A-Z]/i.test(m));
                  const hasDupErr = errorMessages.some(m => /Fix: Duplicate options/i.test(m));
                  const hasStructErr = errorMessages.some(m => /Fix: At least 2 options/i.test(m));
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {optsArr.map((opt, oIndex) => {
                          const parsedCorrect = (() => {
                            const isMultiple = q.isMultiple === 1 || q.isMultiple === true;
                            if (!isMultiple) return q.correctAnswer;
                            try { return JSON.parse(q.correctAnswer || '[]'); } catch (e) { return []; }
                          })();
                          const isMultipleMode = q.isMultiple === 1 || q.isMultiple === true;
                          const isSelected = isMultipleMode
                            ? (Array.isArray(parsedCorrect) && parsedCorrect.includes(opt))
                            : q.correctAnswer === `idx:${oIndex}`;
                          const optTrimmed = String(opt).trim().toLowerCase();
                          const optLetter = String.fromCharCode(65 + oIndex);
                          const isEmpty = errorMessages.some(m => new RegExp(`Missing: Option ${optLetter}\\b`, 'i').test(m));
                          const isDup = hasDupErr && optTrimmed && trimmedOpts.filter(t => t === optTrimmed).length > 1;
                          const optHasError = isEmpty || isDup;

                          return (
                            <div key={oIndex} className="group/opt relative">
                              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
                                optHasError
                                  ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-950/10'
                                  : isSelected && opt !== ''
                                    ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                                    : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/40 hover:border-slate-600'
                              }`}>
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
                                    <CheckCircle className="h-5 w-5 text-indigo-500 fill-indigo-500/10" />
                                  ) : (
                                    <Circle className={`h-5 w-5 group-hover/opt:text-slate-500 ${optHasError ? 'text-rose-400' : 'text-slate-600'}`} />
                                  )}
                                </button>

                                <input
                                  disabled={isLocked}
                                  className={`bg-transparent border-none outline-none w-full text-sm font-bold placeholder:text-slate-600 disabled:cursor-not-allowed ${optHasError ? 'text-rose-600 dark:text-rose-400 placeholder:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}
                                  placeholder={`Option ${oIndex + 1}...`}
                                  value={opt}
                                  onChange={e => onOptionUpdate(oIndex, e.target.value)}
                                />

                                {optsArr.length > 2 && (
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

                        {optsArr.length < 8 && !isLocked && (
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

                      {/* Structural errors — shown once, inline, not repeated */}
                      {hasStructErr && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 mt-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> At least 2 options are required.
                        </p>
                      )}
                      {hasDupErr && !hasStructErr && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 mt-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Remove duplicate options.
                        </p>
                      )}
                      {errorMessages.some(m => /Missing: Correct Answer$/i.test(m)) && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 mt-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Select a correct answer before continuing.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        );
      })()}

      {/* True/False */}
      {q.type === 'TRUE_FALSE' && (() => {
        const hasTFErr = errorMessages.some(m => /Missing: Correct Answer \(True \/ False\)/i.test(m));
        return (
          <div className="space-y-2">
            <div className={`flex gap-3 ${hasTFErr ? 'ring-2 ring-rose-500/40 rounded-xl p-1' : ''}`}>
              {['True', 'False'].map(val => (
                <button
                  key={val}
                  type="button"
                  disabled={isLocked}
                  onClick={() => onUpdate('correctAnswer', val)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm border transition-all disabled:opacity-70 disabled:cursor-not-allowed ${q.correctAnswer === val ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                  {val}
                </button>
              ))}
            </div>
            {hasTFErr && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Select True or False as the correct answer.
              </p>
            )}
          </div>
        );
      })()}

      {/* Complete / Fill blank */}
      {q.type === 'FILL_BLANKS' && (() => {
        const hasFillErr = errorMessages.some(m => /Missing: Correct Answer$/i.test(m));
        return (
          <div className={`space-y-3 p-4 rounded-xl border transition-all ${hasFillErr ? 'border-rose-400/60 bg-rose-50/30 dark:bg-rose-950/10' : 'bg-slate-50 dark:bg-slate-900/50 border-indigo-500/20'}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="text-indigo-400 font-bold">Tip:</span> Use <strong className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-900 dark:text-white">___</strong> (three underscores) in your question text to mark the blank. (e.g., "The capital of France is ___")
            </p>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold uppercase tracking-widest whitespace-nowrap ${hasFillErr ? 'text-rose-500' : 'text-slate-500'}`}>
                Target Word:{hasFillErr && ' *'}
              </span>
              <div className="flex-1 space-y-1">
                <input
                  disabled={isLocked}
                  className={`bg-slate-100 dark:bg-slate-800 border outline-none focus:ring-1 transition-all rounded-lg px-3 py-2 w-full text-emerald-400 font-bold text-sm disabled:opacity-70 disabled:cursor-not-allowed ${hasFillErr ? 'border-rose-500 dark:border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/20 focus:border-rose-500 focus:ring-rose-500/50' : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'}`}
                  placeholder="e.g. Paris"
                  value={q.correctAnswer}
                  onChange={e => onUpdate('correctAnswer', e.target.value)}
                />
                {hasFillErr && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Correct answer word is required.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Essay */}
      {q.type === 'ESSAY' && (() => {
        const hasModelErr = errorMessages.some(m => /Missing: Model Answer$/i.test(m));
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${hasModelErr ? 'text-rose-500' : 'text-rose-400'}`}>
                  <CheckCircle className="h-3 w-3" />
                  Model Answer
                  {hasModelErr && <span className="normal-case tracking-normal font-medium">— required</span>}
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Instructor-only
                </span>
              </div>
              <textarea
                rows={5}
                disabled={isLocked}
                className="input-field w-full text-sm leading-relaxed disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Write the expected answer, key points, or grading rubric. This is used for grading and review — students will never see it."
                value={q.correctAnswer || ''}
                onChange={e => onUpdate('correctAnswer', e.target.value)}
              />
              {hasModelErr && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Model answer is required.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {q.type === 'CODING' && (
        <div className="space-y-4 pt-4 border-t border-slate-300 dark:border-slate-700/50 mt-4">
          {(() => {
            const isPrintable = examType === 'PRINTABLE_ONLY';
            let codingOpts = { title: '', requiredLanguage: 'javascript', inputDescription: '', outputDescription: '', sampleInput: '', sampleOutput: '', testCases: [] };
            try { codingOpts = q.options ? JSON.parse(q.options) : codingOpts; } catch (e) { }
            return (
              <div className="space-y-6">
                {/* IO and samples — online exams only */}
                {!isPrintable && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Input Description</label>
                      <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="E.g. The first line contains an integer T..." value={codingOpts.inputDescription} onChange={e => onUpdate('options', JSON.stringify({ ...codingOpts, inputDescription: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Output Description</label>
                      <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="E.g. For each test case print..." value={codingOpts.outputDescription} onChange={e => onUpdate('options', JSON.stringify({ ...codingOpts, outputDescription: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Sample Input</label>
                      <textarea className="input-field w-full text-sm font-mono whitespace-pre resize-none bg-white dark:bg-slate-950/50" rows={3} placeholder="Sample standard input..." value={codingOpts.sampleInput} onChange={e => onUpdate('options', JSON.stringify({ ...codingOpts, sampleInput: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block ml-2">Sample Output</label>
                      <textarea className="input-field w-full text-sm font-mono whitespace-pre resize-none bg-white dark:bg-slate-950/50" rows={3} placeholder="Expected output for sample..." value={codingOpts.sampleOutput} onChange={e => onUpdate('options', JSON.stringify({ ...codingOpts, sampleOutput: e.target.value }))} />
                    </div>
                  </div>
                )}

                {/* Model Answer — required for all exam types */}
                {(() => {
                  const hasCodingModelErr = errorMessages.some(m => /Missing: Sample Solution/i.test(m));
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${hasCodingModelErr ? 'text-rose-500' : 'text-fuchsia-400'}`}>
                          <CheckCircle className="h-3 w-3" />
                          {isPrintable ? 'Sample Solution / Expected Approach' : 'Sample Solution / Grading Notes'}
                          {hasCodingModelErr && <span className="normal-case tracking-normal font-medium">— required</span>}
                        </label>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <EyeOff className="h-3 w-3" /> Instructor-only
                        </span>
                      </div>
                      <textarea
                        rows={isPrintable ? 6 : 4}
                        className="input-field w-full text-sm font-mono leading-relaxed"
                        placeholder={isPrintable
                          ? "Write the expected solution, algorithm steps, or key concepts the student should demonstrate..."
                          : "Paste a sample solution or write grading notes for your own reference..."}
                        value={q.correctAnswer || ''}
                        onChange={e => onUpdate('correctAnswer', e.target.value)}
                      />
                      {hasCodingModelErr && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Sample solution is required.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Test Cases — online exams only */}
                {!isPrintable && (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-fuchsia-500/20">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-widest text-fuchsia-400 flex items-center gap-2">
                        <EyeOff className="h-4 w-4" /> Hidden Test Cases
                        <span className="font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">(Optional — enables automated grading)</span>
                      </label>
                      <button type="button" onClick={() => {
                        onUpdate('options', JSON.stringify({ ...codingOpts, testCases: [...(codingOpts.testCases || []), { input: '', expectedOutput: '' }] }));
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
                        <p className="text-xs text-slate-500 italic text-center py-4">No test cases added — automated grading will not run.</p>
                      )}
                      {(codingOpts.testCases || []).map((tc, tcIdx) => (
                        <div key={tcIdx} className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 relative group/tc">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-600">Input</span>
                            <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none focus:border-fuchsia-500 rounded p-2 text-xs font-mono resize-none text-slate-600 dark:text-slate-300" placeholder="Input" rows={2} value={tc.input} onChange={e => { const newTc = [...codingOpts.testCases]; newTc[tcIdx].input = e.target.value; onUpdate('options', JSON.stringify({ ...codingOpts, testCases: newTc })); }} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-600">Expected Output</span>
                            <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none focus:border-fuchsia-500 rounded p-2 text-xs font-mono resize-none text-slate-600 dark:text-slate-300" placeholder="Expected Output" rows={2} value={tc.expectedOutput} onChange={e => { const newTc = [...codingOpts.testCases]; newTc[tcIdx].expectedOutput = e.target.value; onUpdate('options', JSON.stringify({ ...codingOpts, testCases: newTc })); }} />
                          </div>
                          <button type="button" onClick={() => { const newTc = codingOpts.testCases.filter((_, i) => i !== tcIdx); onUpdate('options', JSON.stringify({ ...codingOpts, testCases: newTc })); }} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover/tc:opacity-100 transition-all hover:scale-110 shadow-lg"><XCircle className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {q.type === 'UML' && (
        <div className="space-y-4 pt-4 border-t border-slate-300 dark:border-slate-700/50 mt-4">
          {(() => {
            let umlOpts = { diagramType: 'Use Case', useAI: false, modelAnswerText: '' };
            try { umlOpts = { ...umlOpts, ...(q.options ? JSON.parse(q.options) : {}) }; } catch (e) { }
            return (
              <div className="space-y-6">

                {/* Required text model answer */}
                {(() => {
                  const hasUmlModelErr = errorMessages.some(m => /Missing: Model Answer \/ Expected Components/i.test(m));
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${hasUmlModelErr ? 'text-rose-500' : 'text-cyan-400'}`}>
                          <CheckCircle className="h-3 w-3" />
                          Model Answer / Expected Components
                          {hasUmlModelErr && <span className="normal-case tracking-normal font-medium">— required</span>}
                        </label>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <EyeOff className="h-3 w-3" /> Instructor-only
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        className="input-field w-full text-sm leading-relaxed"
                        placeholder="Describe the key elements, relationships, or components the correct diagram must include. Used for grading reference."
                        value={umlOpts.modelAnswerText || ''}
                        onChange={e => onUpdate('options', JSON.stringify({ ...umlOpts, modelAnswerText: e.target.value }))}
                      />
                      {hasUmlModelErr && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Model answer description is required.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Reference diagram canvas */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-cyan-500/20">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>
                        Optionally draw a <strong>Reference Diagram</strong> for visual grading reference. Students will never see this.
                      </span>
                    </p>
                    <span className="text-[10px] text-cyan-500/70 dark:text-cyan-400/50 flex items-center gap-1 shrink-0 ml-3">
                      <EyeOff className="h-3 w-3" /> Hidden from students
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 h-[550px] rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 font-bold uppercase tracking-widest text-[10px] relative overflow-hidden">
                    <UMLCanvas
                      value={q.correctAnswer}
                      onChange={val => onUpdate('correctAnswer', val)}
                      onImageExport={img => onUpdate('options', JSON.stringify({ ...umlOpts, modelImage: img }))}
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
                <Calculator className="h-4 w-4" /> Math Reference Configuration
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
                        try { return JSON.parse(q.options).gradingMode || 'final_answer'; } catch (e) { return 'final_answer'; }
                      })()}
                      onChange={e => {
                        try {
                          const opts = JSON.parse(q.options || '{}');
                          onUpdate('options', JSON.stringify({ ...opts, gradingMode: e.target.value }));
                        } catch (err) { }
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
                        try { return JSON.parse(q.options || '{}').tolerance || 0.01; } catch (e) { return 0.01; }
                      })()}
                      onChange={e => {
                        try {
                          const opts = JSON.parse(q.options || '{}');
                          onUpdate('options', JSON.stringify({ ...opts, tolerance: parseFloat(e.target.value) }));
                        } catch (err) { }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Optional Checkpoints
                  </label>
                  <button type="button" onClick={() => {
                    try {
                      const opts = JSON.parse(q.options || '{}');
                      const cps = opts.checkpoints || [];
                      onUpdate('options', JSON.stringify({ ...opts, checkpoints: [...cps, ''] }));
                    } catch (e) { }
                  }} className="text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Value
                  </button>
                </div>
                {(() => {
                  let cps = [];
                  try { cps = JSON.parse(q.options || '{}').checkpoints || []; } catch (e) { }
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
                                const newCps = [...(opts.checkpoints || [])];
                                newCps[idx] = e.target.value;
                                onUpdate('options', JSON.stringify({ ...opts, checkpoints: newCps }));
                              } catch (err) { }
                            }}
                          />
                          <button type="button" onClick={() => {
                            try {
                              let opts = JSON.parse(q.options || '{}');
                              opts.checkpoints = (opts.checkpoints || []).filter((_, i) => i !== idx);
                              onUpdate('options', JSON.stringify(opts));
                            } catch (err) { }
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
                  try { mode = JSON.parse(q.options || '{}').gradingMode || 'final_answer'; } catch (e) { }
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

// Pure function — no component state, safe to call from useMemo
const validateAllQuestions = (qs) => {
  const errs = [];
  if (!qs || qs.length === 0) {
    errs.push("Required: At least one question exists.");
    return errs;
  }
  qs.forEach((q, idx) => {
    const qNum = idx + 1;
    const cleanText = q.text ? q.text.replace(/<[^>]*>/g, '').trim() : '';
    if (!cleanText) {
      const textLabel = q.type === 'CODING' ? 'Problem Description'
        : q.type === 'UML' ? 'System Scenario / Requirements'
        : 'Question Statement';
      errs.push(`Question ${qNum}: Missing: ${textLabel}`);
    }
    const pts = parseFloat(q.points);
    if (isNaN(pts) || pts <= 0) errs.push(`Question ${qNum}: Missing: Points`);
    if (!q.type) { errs.push(`Question ${qNum}: Missing: Question Type`); return; }

    const curAns = getCorrectAnswer(q);

    let parsedOptions = q.options;
    if (typeof q.options === 'string') {
      try { parsedOptions = JSON.parse(q.options); } catch (e) { parsedOptions = q.options; }
    }

    if (q.type === 'MCQ') {
      const optsArray = Array.isArray(parsedOptions) ? parsedOptions : [];
      if (optsArray.length < 2) errs.push(`Question ${qNum}: Fix: At least 2 options required`);
      optsArray.forEach((opt, i) => {
        if (!opt || String(opt).trim() === '') {
          errs.push(`Question ${qNum}: Missing: Option ${String.fromCharCode(65 + i)}`);
        }
      });
      const trimmedOpts = optsArray.map(o => String(o).trim().toLowerCase());
      if (trimmedOpts.some((o, i) => trimmedOpts.indexOf(o) !== i)) errs.push(`Question ${qNum}: Fix: Duplicate options`);
      const isMultipleMode = getIsMultiple(q);
      if (isMultipleMode) {
        let ans = [];
        try { ans = typeof curAns === 'string' ? JSON.parse(curAns) : curAns; } catch (e) {}
        if (!Array.isArray(ans) || ans.length === 0) errs.push(`Question ${qNum}: Missing: Correct Answer`);
      } else {
        if (!curAns || String(curAns).trim() === '' || !String(curAns).startsWith('idx:')) {
          errs.push(`Question ${qNum}: Missing: Correct Answer`);
        } else {
          const oIdx = parseInt(String(curAns).split(':')[1]);
          if (isNaN(oIdx) || oIdx < 0 || oIdx >= optsArray.length) errs.push(`Question ${qNum}: Missing: Correct Answer`);
        }
      }
    } else if (q.type === 'TRUE_FALSE') {
      if (curAns !== 'True' && curAns !== 'False') errs.push(`Question ${qNum}: Missing: Correct Answer (True / False)`);
    } else if (q.type === 'FILL_BLANKS') {
      if (!curAns || String(curAns).trim() === '') errs.push(`Question ${qNum}: Missing: Correct Answer`);
    } else if (q.type === 'MATH') {
      const mathOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
      if (!mathOpts.correctFinalAnswer || String(mathOpts.correctFinalAnswer).trim() === '') errs.push(`Question ${qNum}: Missing: Correct Final Answer`);
    } else if (q.type === 'ESSAY') {
      if (!curAns || String(curAns).trim() === '') errs.push(`Question ${qNum}: Missing: Model Answer`);
    } else if (q.type === 'CODING') {
      const codingOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
      if (!codingOpts.title || String(codingOpts.title).trim() === '') errs.push(`Question ${qNum}: Missing: Problem Title`);
      if (!curAns || String(curAns).trim() === '') errs.push(`Question ${qNum}: Missing: Sample Solution`);
      
      const testCases = Array.isArray(codingOpts.testCases) ? codingOpts.testCases : [];
      if (testCases.length === 0) {
        errs.push(`Question ${qNum}: Fix: At least 1 test case is required`);
      } else {
        testCases.forEach((tc, tcIdx) => {
          if (!tc.expectedOutput || String(tc.expectedOutput).trim() === '') {
            errs.push(`Question ${qNum}: Missing: Expected Output for Test Case ${tcIdx + 1}`);
          }
        });
      }
    } else if (q.type === 'UML') {
      const umlOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
      if (!umlOpts.title || String(umlOpts.title).trim() === '') errs.push(`Question ${qNum}: Missing: Scenario Title`);
      if (!umlOpts.modelAnswerText || String(umlOpts.modelAnswerText).trim() === '') errs.push(`Question ${qNum}: Missing: Model Answer / Expected Components`);
      
      let umlModel = { nodes: [], edges: [] };
      try { umlModel = typeof curAns === 'string' ? JSON.parse(curAns) : curAns; } catch (e) {}
      const umlNodes = umlModel?.nodes || [];
      if (umlNodes.length === 0) {
        errs.push(`Question ${qNum}: Missing: Model Diagram elements`);
      }
    }
  });
  return errs;
};

const getLocalNow = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatToLocalISO = (dateStr) => {
  if (!dateStr) return '';
  // Extract date and time parts directly from ISO string to bypass timezone shifts
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    const parts = dateStr.split('T');
    return `${parts[0]}T${parts[1].slice(0, 5)}`;
  }
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

// ── Compact custom date picker popover ──
const CompactDatePicker = ({ value, min, onChange, placeholder = "Select date", hasError, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return value ? new Date(value + 'T00:00:00') : new Date();
  });
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value + 'T00:00:00'));
    }
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formatDisplayDate = (dStr) => {
    if (!dStr) return placeholder;
    const dt = new Date(dStr + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  const days = [];
  for (let i = firstDayIndex; i > 0; i--) {
    days.push({
      day: prevLastDate - i + 1,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevLastDate - i + 1)
    });
  }

  for (let i = 1; i <= lastDate; i++) {
    days.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i)
    });
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  const toYYYYMMDD = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const selectedStr = value;
  const minStr = min;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all bg-white dark:bg-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          hasError
            ? 'border-rose-400 dark:border-rose-500/50 text-rose-500 bg-rose-50/10'
            : value
            ? 'border-indigo-500 dark:border-indigo-400 text-slate-900 dark:text-white'
            : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          {formatDisplayDate(value)}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-slate-950/80 z-[100] w-72 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
              >
                <ChevronUp className="h-4 w-4 -rotate-90" />
              </button>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
              >
                <ChevronUp className="h-4 w-4 rotate-90" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <span key={d} className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((dObj, idx) => {
                const dateStr = toYYYYMMDD(dObj.date);
                const isSelected = selectedStr === dateStr;
                const isDisabled = minStr && dateStr < minStr;
                const isToday = toYYYYMMDD(new Date()) === dateStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(dateStr);
                      setIsOpen(false);
                    }}
                    className={`h-8 text-xs font-semibold rounded-lg transition-all flex items-center justify-center relative cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 font-bold'
                        : isDisabled
                        ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                        : dObj.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        : 'text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-50'
                    }`}
                  >
                    {dObj.day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Compact custom time picker popover ──
const CompactTimePicker = ({ value, options, onChange, placeholder = "Select time", hasError, disabled, showNowOption, onNowSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const isNoOptions = !options || options.length === 0;
  const isDisabled = isNoOptions || disabled;

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const parseCurrentTime = (timeStr) => {
    if (!timeStr) return { hour: '09', minute: '00', ampm: 'AM' };
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return {
      hour: String(h).padStart(2, '0'),
      minute: m,
      ampm
    };
  };

  const { hour, minute, ampm } = parseCurrentTime(value);

  const handleSelect = (newHour, newMinute, newAmpm) => {
    let h = parseInt(newHour, 10);
    if (newAmpm === 'PM' && h < 12) h += 12;
    if (newAmpm === 'AM' && h === 12) h = 0;
    const hh = String(h).padStart(2, '0');
    const mm = String(newMinute).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  };

  const displayLabel = value ? (() => {
    const { hour, minute, ampm } = parseCurrentTime(value);
    return `${parseInt(hour, 10)}:${minute} ${ampm}`;
  })() : placeholder;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all bg-white dark:bg-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          hasError
            ? 'border-rose-400 dark:border-rose-500/50 text-rose-500 bg-rose-50/10'
            : value
            ? 'border-indigo-500 dark:border-indigo-400 text-slate-900 dark:text-white'
            : 'border-slate-200 dark:border-slate-700 text-slate-405 hover:border-slate-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400 shrink-0" />
          {isNoOptions ? 'Select date first' : displayLabel}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 p-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-slate-950/80 z-[100] w-64 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-0.5">Hour</p>
              <div className="grid grid-cols-6 gap-1">
                {['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map(h => {
                  const isSel = hour === h;
                  const testValHour = (() => {
                    let hourNum = parseInt(h, 10);
                    if (ampm === 'PM' && hourNum < 12) hourNum += 12;
                    if (ampm === 'AM' && hourNum === 12) hourNum = 0;
                    return String(hourNum).padStart(2, '0');
                  })();
                  const isValid = options.some(opt => opt.value.startsWith(testValHour));
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={!isValid}
                      onClick={() => handleSelect(h, minute, ampm)}
                      className={`h-7 text-xs font-bold rounded-lg transition-all ${
                        isSel
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : isValid
                          ? 'text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {parseInt(h, 10)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-0.5">Minute</p>
              <div className="grid grid-cols-4 gap-1">
                {['00', '15', '30', '45'].map(m => {
                  const isSel = minute === m;
                  const testValMin = (() => {
                    let hourNum = parseInt(hour, 10);
                    if (ampm === 'PM' && hourNum < 12) hourNum += 12;
                    if (ampm === 'AM' && hourNum === 12) hourNum = 0;
                    const hh = String(hourNum).padStart(2, '0');
                    return `${hh}:${m}`;
                  })();
                  const isValid = options.some(opt => opt.value === testValMin);
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!isValid}
                      onClick={() => handleSelect(hour, m, ampm)}
                      className={`h-7 text-xs font-bold rounded-lg transition-all ${
                        isSel
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : isValid
                          ? 'text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl">
              {['AM', 'PM'].map(ap => {
                const isSel = ampm === ap;
                const isValid = options.some(opt => {
                  const [hh] = opt.value.split(':');
                  const h = parseInt(hh, 10);
                  const optAmpm = h >= 12 ? 'PM' : 'AM';
                  return optAmpm === ap;
                });
                return (
                  <button
                    key={ap}
                    type="button"
                    disabled={!isValid}
                    onClick={() => handleSelect(hour, minute, ap)}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      isSel
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : isValid
                        ? 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {ap}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────
const CreateExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [metaCollapsed, setMetaCollapsed] = useState(true);

  // Strongly sync native draft at process initial render to eliminate race condition
  const [draftState] = useState(() => {
    try {
      const d = localStorage.getItem(`exam_draft_${id || 'new'}`);
      if (!d) return null;
      const parsed = JSON.parse(d);
      // Validate draft structure to prevent crashes from stale/corrupted data
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections)) return null;
      return parsed;
    } catch (e) {
      localStorage.removeItem(`exam_draft_${id || 'new'}`);
      return null;
    }
  });

  const [step, setStep] = useState(draftState?.step || 1);

  // Scroll to top when internal step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id && !draftState);
  const [errors, setErrors] = useState({});
  const [showValidationModal, setShowValidationModal] = useState(false);
  // publishTouchedUids: Set of question _uids that were invalid when Publish was last clicked.
  // Only questions in this Set show error highlighting — new/untouched questions are always clean.
  const [publishTouchedUids, setPublishTouchedUids] = useState(() => new Set());
  const [showMultiAnswerWarning, setShowMultiAnswerWarning] = useState(false);
  const [multiAnswerConfirmed, setMultiAnswerConfirmed] = useState(false);
  const [pendingMultiAnswerQuestions, setPendingMultiAnswerQuestions] = useState([]);

  const defaultExamMeta = {
    examCategory: 'Final',
    institutionName: '',
    facultyName: '',
    departmentName: '',
    courseName: '',
    instructorName: user?.name || '',
    academicYear: '',
    examDate: '',
    logoUrl: '',
    examInstructions: '',
  };

  const [exam, setExam] = useState(() => {
    if (draftState?.exam) {
      return {
        ...draftState.exam,
        examMeta: {
          ...defaultExamMeta,
          ...(draftState.exam.examMeta || {})
        }
      };
    }
    return {
      title: '',
      description: '',
      totalGrade: 100,
      duration: '',
      startTime: getLocalNow(),
      endTime: '',
      showResults: null,
      requireAIGradeApproval: 0,
      examType: 'ONLINE',
      examMeta: defaultExamMeta
    };
  });

  const [sections, setSections] = useState(() => {
    if (draftState?.sections?.length > 0) return draftState.sections;
    return [{ id: 1, title: 'Exam Questions', description: '', questions: [] }];
  });
  const [isAutoGrade, setIsAutoGrade] = useState(true);
  const [submissionCount, setSubmissionCount] = useState(0);

  // Derive locked state: online exams only, once exam has started
  const hasStarted = exam.startTime && new Date() >= new Date(exam.startTime);
  const isQuestionsLocked = !!id && exam.examType === 'ONLINE' && hasStarted;
  const isStartTimeDisabled = !!id && hasStarted;

  useEffect(() => {
    if (id) {
      api.get(`/exams/${id}`)
        .then(({ data }) => {
          setSubmissionCount(data.submissionCount || 0);
        })
        .catch(err => {
          console.error("Failed to fetch latest submission count", err);
        });
    }
  }, [id]);

  // Auto-fill instructorName if user name becomes available and it's currently empty
  useEffect(() => {
    if (user?.name && !exam.examMeta?.instructorName) {
      setExam(prev => ({
        ...prev,
        examMeta: {
          ...prev.examMeta,
          instructorName: user.name
        }
      }));
    }
  }, [user, exam.examMeta?.instructorName]);

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
            examType: data.examType || 'ONLINE',
            examMeta: {
              ...defaultExamMeta,
              ...(data.examMeta || {})
            }
          });

          if (data.questions) {
            const mappedQuestions = data.questions.map(q => {
              let initialCorrect = q.correctAnswer;
              if (q.type === 'MCQ' && q.isMultiple !== 1 && q.correctAnswer) {
                const idx = (q.options || []).indexOf(q.correctAnswer);
                if (idx !== -1) initialCorrect = `idx:${idx}`;
              }
              let opts = q.options;
              if (q.type === 'CODING' && typeof opts === 'object' && opts !== null) {
                opts = JSON.stringify(opts);
              }
              return { ...q, correctAnswer: initialCorrect, options: opts, _uid: q.id || Math.random() };
            });
            const storedSections = Array.isArray(data.examMeta?.sections) ? data.examMeta.sections : null;
            if (storedSections && storedSections.length > 0) {
              setSections(storedSections.map((sec, i) => ({
                id: i + 1,
                title: sec.title || `Section ${i + 1}`,
                description: sec.description || '',
                questions: mappedQuestions.slice(sec.start, sec.start + sec.count),
              })));
            } else {
              setSections([{
                id: 1,
                title: 'Assessment Content',
                description: '',
                questions: mappedQuestions,
              }]);
            }
          }
          const sum = data.questions?.reduce((acc, q) => acc + q.points, 0) || 0;
          setIsAutoGrade(sum === data.totalGrade);
          setSubmissionCount(data.submissionCount || 0);
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

  // Live question errors — recomputed whenever questions change (always runs, even with 0 questions)
  // Returns flat string array (for modal) AND a uid→errors map (for per-card highlighting).
  const { liveQuestionErrors, liveErrorsByUid } = useMemo(() => {
    const flat = validateAllQuestions(allQuestions);
    // Build a map from _uid → error strings, so card errors are keyed by identity not position.
    const byUid = {};
    allQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const qErrs = flat.filter(e => e.startsWith(`Question ${qNum}:`));
      if (qErrs.length > 0) byUid[q._uid] = qErrs;
    });
    return { liveQuestionErrors: flat, liveErrorsByUid: byUid };
  }, [allQuestions]);

  const pointsOk = isAutoGrade ? true : totalPoints === parseFloat(exam.totalGrade || 0);

  // ── Helper: format a Date as YYYY-MM-DDThh:mm (local) for datetime-local min attr ──
  const toDatetimeLocal = (date) => {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // ── Minimum valid end time: max(now, start+duration) ──
  const minEndDatetimeLocal = useMemo(() => {
    const now = new Date();
    const dur = parseFloat(exam.duration) || 0;
    if (exam.startTime) {
      const start = new Date(exam.startTime);
      const startPlusDur = new Date(start.getTime() + dur * 60000);
      return toDatetimeLocal(new Date(Math.max(now.getTime(), startPlusDur.getTime())));
    }
    return toDatetimeLocal(new Date(now.getTime() + dur * 60000));
  }, [exam.startTime, exam.duration]);

  // ── Minimum valid start time: now ──
  const minStartDatetimeLocal = useMemo(() => toDatetimeLocal(new Date()), []);

  // ── Live end-time status (drives inline warning, clears automatically) ──
  // NOTE: "past" case is intentionally omitted — the `min` attr on the input disables past times
  // in the date picker UI, so no redundant error banner is needed for that case.
  const endTimeStatus = useMemo(() => {
    if (!exam.endTime) return null;
    const end = new Date(exam.endTime);
    const now = new Date();
    const dur = parseFloat(exam.duration) || 0;

    if (exam.startTime) {
      const start = new Date(exam.startTime);
      if (end <= start) {
        return { type: 'error', msg: 'End time must be after the start time.' };
      }
      if (dur > 0) {
        const minEnd = new Date(start.getTime() + dur * 60000);
        if (end < minEnd) {
          const diff = Math.ceil((minEnd.getTime() - end.getTime()) / 60000);
          return {
            type: 'error',
            msg: `The selected End Time is earlier than the minimum required time based on the exam duration. ` +
                 `With a ${dur}-minute exam, students need at least ${diff} more minute${diff !== 1 ? 's' : ''} from the start.`,
          };
        }
      }
    } else if (dur > 0) {
      const minEnd = new Date(now.getTime() + dur * 60000);
      if (end < minEnd) {
        return {
          type: 'warn',
          msg: `Based on the current time and a ${dur}-minute exam duration, students may not have enough time to complete this exam.`,
        };
      }
    }

    return { type: 'ok' };
  }, [exam.endTime, exam.startTime, exam.duration]);

  // ── Duration compatibility check — friendly amber reminder ──
  // Fires whenever start + end are both set AND the window is shorter than duration.
  // Distinct from endTimeStatus (which is an error). This is a UX nudge.
  const durationMismatch = useMemo(() => {
    if (exam.examType === 'PRINTABLE_ONLY') return null;
    const dur = parseFloat(exam.duration);
    if (!exam.startTime || !exam.endTime || !dur || dur <= 0) return null;
    const start = new Date(exam.startTime);
    const end = new Date(exam.endTime);
    const windowMins = (end - start) / 60000;
    if (windowMins <= 0) return null; // endTimeStatus will handle end < start
    if (windowMins < dur) {
      const shortfall = Math.ceil(dur - windowMins);
      return {
        windowMins: Math.round(windowMins),
        shortfall,
      };
    }
    return null;
  }, [exam.startTime, exam.endTime, exam.duration, exam.examType]);

  // ── Helper: parse "YYYY-MM-DDTHH:MM" into { date, time } parts ──
  const parseDateTime = (dtStr) => {
    if (!dtStr) return { date: '', time: '' };
    const parts = dtStr.split('T');
    return { date: parts[0] || '', time: parts[1] ? parts[1].slice(0, 5) : '' };
  };

  // ── Helper: combine a date string and time string into "YYYY-MM-DDTHH:MM" ──
  const combineDateTime = (date, time) => {
    if (!date) return '';
    return `${date}T${time || '00:00'}`;
  };

  // ── 15-minute interval time slot options (static) ──
  const timeOptions = useMemo(() => {
    const list = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        list.push({ value: `${hh}:${mm}`, label: `${displayHour}:${mm} ${ampm}` });
      }
    }
    return list;
  }, []);

  // ── Filtered start time options — removes past slots when today is selected ──
  // For existing exams, never filter the start time — the saved time must always appear.
  const filteredStartTimeOptions = useMemo(() => {
    if (id) return timeOptions; // editing: always show all slots so saved time is always visible
    const minStartDate = minStartDatetimeLocal.split('T')[0];
    const minStartTime = minStartDatetimeLocal.split('T')[1];
    const { date: selectedDate } = parseDateTime(exam.startTime);
    if (selectedDate === minStartDate) {
      return timeOptions.filter(opt => opt.value >= minStartTime);
    }
    return timeOptions;
  }, [id, exam.startTime, minStartDatetimeLocal, timeOptions]);

  // ── Filtered end time options — removes invalid slots when min-end-date is selected ──
  // For existing exams that have already started, do not restrict the end time based on now.
  const filteredEndTimeOptions = useMemo(() => {
    if (id && hasStarted) return timeOptions; // editing a live exam: show all end-time slots
    const minEndDate = minEndDatetimeLocal.split('T')[0];
    const minEndTime = minEndDatetimeLocal.split('T')[1];
    const { date: selectedDate } = parseDateTime(exam.endTime);
    if (selectedDate === minEndDate) {
      return timeOptions.filter(opt => opt.value >= minEndTime);
    }
    return timeOptions;
  }, [id, hasStarted, exam.endTime, minEndDatetimeLocal, timeOptions]);


  // ── Validation Logic ──
  const validateStep1 = () => {
    const newErrors = {};
    const isPrintable = exam.examType === 'PRINTABLE_ONLY';

    if (!exam.title.trim()) newErrors.title = 'Title is required';
    if (!exam.duration || exam.duration <= 0) newErrors.duration = 'Valid duration is required';

    if (!isPrintable) {
      if (!exam.startTime) newErrors.startTime = 'Start time is required';
      if (!exam.endTime) newErrors.endTime = 'End time is required';
      if (exam.showResults === null) newErrors.showResults = 'Please choose result visibility';

      // Use the same logic as endTimeStatus for consistency
      if (exam.endTime) {
        const end = new Date(exam.endTime);
        const now = new Date();
        const dur = parseFloat(exam.duration) || 0;
        if (end < now) {
          newErrors.endTime = 'End time is in the past — students cannot join an exam that has already ended.';
        } else if (exam.startTime) {
          const start = new Date(exam.startTime);
          if (end <= start) {
            newErrors.endTime = 'End time must be after the start time.';
          } else if (dur > 0) {
            const minEnd = new Date(start.getTime() + dur * 60000);
            if (end < minEnd) {
              const diff = Math.ceil((minEnd.getTime() - end.getTime()) / 60000);
              newErrors.endTime = `The selected End Time is too early. With a ${dur}-minute exam duration, students need at least ${diff} more minute${diff !== 1 ? 's' : ''} from the start.`;
            }
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Phase 3 validation — printable exam metadata
  const metaFields = [
    { key: 'examCategory', label: 'Exam Category', icon: Award },
    { key: 'institutionName', label: 'University / Institution Name', icon: Building },
    { key: 'departmentName', label: 'Department Name', icon: BookOpen },
    { key: 'courseName', label: 'Course Name / Code', icon: FileText },
    { key: 'instructorName', label: 'Instructor Name', icon: Sparkles },
    { key: 'academicYear', label: 'Academic Year / Semester', icon: Calendar },
    { key: 'examDate', label: 'Exam Date', icon: Clock },
  ];
  const optionalMetaFields = [
    { key: 'facultyName', label: 'Faculty / College Name', icon: Building },
  ];

  const getMetaCompletion = () => {
    const completed = metaFields.filter(f => {
      const val = exam.examMeta?.[f.key];
      return val && String(val).trim() !== '';
    });
    return { completed: completed.length, total: metaFields.length, fields: metaFields.map(f => ({ ...f, done: !!(exam.examMeta?.[f.key] && String(exam.examMeta[f.key]).trim()) })) };
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!exam.examMeta?.institutionName?.trim()) newErrors.institutionName = 'University/Institution Name is required';
    if (!exam.examMeta?.departmentName?.trim()) newErrors.departmentName = 'Department Name is required';
    if (!exam.examMeta?.courseName?.trim()) newErrors.courseName = 'Course Name/Code is required';
    if (!exam.examMeta?.instructorName?.trim()) newErrors.instructorName = 'Instructor Name is required';
    if (!exam.examMeta?.academicYear?.trim()) newErrors.academicYear = 'Academic Year/Semester is required';
    if (!exam.examMeta?.examDate) newErrors.examDate = 'Exam Date is required';
    if (!exam.examMeta?.examCategory) newErrors.examCategory = 'Exam Category is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        } catch (e) { nextCorrect = '[]'; }
      } else if (q.correctAnswer === optVal) nextCorrect = '';
      questions[qIndex] = { ...q, options: nextOptions, correctAnswer: nextCorrect };
      return { ...s, questions };
    }));
  };

  const toggleMultiple = (sectionId, qIndex, val) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const questions = [...s.questions];
      const q = questions[qIndex];
      const nextAnswer = convertAnswerMode(q, val);
      questions[qIndex] = { ...q, isMultiple: val, correctAnswer: nextAnswer };
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

  const updateSectionDescription = (id, description) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, description } : s));
  };

  const isPrintable = exam.examType === 'PRINTABLE_ONLY';
  const maxStep = isPrintable ? 3 : 2;

  const handleSubmit = async (e, bypassMultiCheck = false) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (step === 1) {
      const missing = [];
      if (!exam.title.trim()) missing.push("Exam Title");
      if (!exam.duration || parseFloat(exam.duration) <= 0) missing.push("Exam Duration");

      const isPrintable = exam.examType === 'PRINTABLE_ONLY';
      if (!isPrintable) {
        if (!exam.startTime) missing.push("Start Time");
        if (!exam.endTime) missing.push("End Time");
        if (exam.showResults === null) missing.push("Result Visibility");
      }

      if (missing.length > 0) {
        toast.custom((t) => (
          <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border max-w-sm w-full
            bg-amber-50 dark:bg-[#1e1a0e] border-amber-200 dark:border-amber-500/30
            transition-all duration-300 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          >
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1.5">
                Almost there! Please complete:
              </p>
              <ul className="space-y-1">
                {missing.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ), { duration: 4000 });
        validateStep1();
        return;
      }

      // Block if duration is incompatible with the window (friendly gate)
      if (durationMismatch) {
        toast.custom((t) => (
          <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border max-w-sm w-full
            bg-amber-50 dark:bg-[#1e1a0e] border-amber-200 dark:border-amber-500/30
            transition-all duration-300 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          >
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-0.5">Time window too short</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                The selected window is {durationMismatch.windowMins} min but the exam duration is {exam.duration} min. Extend the end time or shorten the duration.
              </p>
            </div>
          </div>
        ), { duration: 5000 });
        validateStep1();
        return;
      }

      if (!validateStep1()) {
        toast.custom((t) => (
          <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border max-w-sm w-full
            bg-rose-50 dark:bg-[#1e0f0f] border-rose-200 dark:border-rose-500/30
            transition-all duration-300 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          >
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-0.5">Schedule conflict</p>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                Please fix the schedule errors highlighted below before continuing.
              </p>
            </div>
          </div>
        ), { duration: 4000 });
        return;
      }

      // If questions are locked, save general info directly — step 2 is completely bypassed
      if (isQuestionsLocked) {
        // Fall through to save logic immediately
      } else {
        setStep(2);
        return;
      }
    }

    // Block publish/launch if any question is incomplete — show the summary modal and mark cards.
    // Snapshot the _uids of currently-failing questions so only THOSE cards show errors.
    // Newly added questions after this point will NOT be in the snapshot and stay clean.
    if (!isQuestionsLocked && liveQuestionErrors.length > 0) {
      if (step === 3) setStep(2);
      // Snapshot: only the questions currently invalid get highlighted.
      const failingUids = new Set(Object.keys(liveErrorsByUid));
      setPublishTouchedUids(failingUids);
      setShowValidationModal(true);
      return;
    }

    // Soft-warn if any Multiple Selection question has only 1 correct answer selected
    if (!isQuestionsLocked && !multiAnswerConfirmed && !bypassMultiCheck) {
      const suspects = allQuestions
        .map((q, idx) => ({ q, num: idx + 1 }))
        .filter(({ q }) => {
          const isMulti = getIsMultiple(q);
          if (!isMulti) return false;
          let ans = [];
          const curAns = getCorrectAnswer(q);
          try { ans = typeof curAns === 'string' ? JSON.parse(curAns) : (Array.isArray(curAns) ? curAns : []); } catch (e) {}
          return Array.isArray(ans) && ans.length === 1;
        })
        .map(({ num }) => num);
      if (suspects.length > 0) {
        setShowMultiAnswerWarning(true);
        setMultiAnswerConfirmed(false);
        setPendingMultiAnswerQuestions(suspects);
        return;
      }
    }

    if (step === 2) {
      if (!isAutoGrade && !pointsOk) {
        toast.error(`This exam is configured for ${exam.totalGrade} total points, but the current questions add up to only ${totalPoints} points. Please adjust the question scores before publishing.`);
        return;
      }
      if (isPrintable) {
        setStep(3);
        return;
      }
    }

    if (step === 3) {
      if (!validateStep3()) return;
    }
    setLoading(true);
    try {
      const questions = allQuestions.map(({ _uid, id: qId, ...q }) => {
        const payload = { ...q };
        const isNotMultiple = !getIsMultiple(payload);
        const curAns = getCorrectAnswer(payload);
        if (payload.type === 'MCQ' && isNotMultiple && String(curAns).startsWith('idx:')) {
          const idx = parseInt(curAns.split(':')[1]);
          payload.correctAnswer = (payload.options && payload.options[idx]) ? payload.options[idx] : curAns;
        } else {
          payload.correctAnswer = curAns; // ensure camelCase key is saved
        }
        payload.isMultiple = getIsMultiple(payload) ? 1 : 0; // ensure it is normalized for DB
        if (payload.type === 'CODING' && typeof payload.options === 'string') {
          try { payload.options = JSON.parse(payload.options); } catch (e) { payload.options = {}; }
        }
        return payload;
      });

      const sectionsMeta = sections.map((s, sIdx) => ({
        title: s.title,
        description: s.description || '',
        count: s.questions.length,
        start: sections.slice(0, sIdx).reduce((acc, prev) => acc + prev.questions.length, 0),
      }));
      const finalExam = {
        ...exam,
        totalGrade: isAutoGrade ? totalPoints : exam.totalGrade,
        examMeta: { ...(exam.examMeta || {}), sections: sectionsMeta },
      };
      if (id) {
        // When questions are locked (exam has started), omit the questions array entirely.
        // The backend only updates exam metadata; sending questions would trigger a 409.
        const updatePayload = isQuestionsLocked ? finalExam : { ...finalExam, questions };
        await api.put(`/exams/${id}`, updatePayload);
        const examTitle = exam.title?.trim() || 'Exam';
        toast.success(`${examTitle} updated successfully.`);
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

  const cardClass = "bg-white dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm transition-all duration-500";

  return (
    <div className="max-w-4xl mx-auto pb-8 px-6 pt-0"> {/* Strictly top-aligned */}

      {/* Dynamic Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
            style={{ touchAction: 'manipulation' }}
            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-white hover:border-slate-300 dark:border-slate-700 transition-all shadow-xl shadow-black/20 group">
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-inner ${
                isQuestionsLocked ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : step === 1 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                : step === 2 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              }`}>
                {isQuestionsLocked ? 'General Settings Only' : (step === 1 ? 'Phase 01 — Blueprint' : step === 2 ? 'Phase 02 — Construction' : 'Phase 03 — Exam Paper Details')}
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {id ? 'Refactoring Assessment' : 'New Assessment Unit'}
            </h1>
          </div>
        </div>

        {/* Stepper with percentages */}
        {!isQuestionsLocked && (
        <div className="flex items-center gap-8 pr-2">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {step === 1 ? (isQuestionsLocked ? 'Next: Save Assessment' : 'Next: Build Questions') : step === 2 ? (isPrintable ? 'Next: Exam Paper Details' : 'Total Grade Allocation') : 'Final Step — Complete Details'}
            </p>
            <p className="text-sm font-black text-indigo-400">
              {step === 1 ? (isQuestionsLocked ? 'Questions Locked' : 'Configuration Phase') : step === 2 ? `${totalPoints} Points Established` : `${getMetaCompletion().completed} / ${getMetaCompletion().total} Fields Complete`}
            </p>
          </div>
          <div className="flex gap-2 h-12 items-center">
            <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${step >= 1 ? 'bg-indigo-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
            <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${step >= 2 ? 'bg-indigo-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
            {isPrintable && (
              <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${step >= 3 ? 'bg-violet-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
            )}
          </div>
        </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700" noValidate>

        {step === 1 && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500 max-w-3xl mx-auto">
            
            {/* ── Questions Locked Notice ── */}
            {isQuestionsLocked && (
              <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/25 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">Question Editing Locked</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    This online exam has already started{submissionCount > 0 ? ` and ${submissionCount} student${submissionCount !== 1 ? 's have' : ' has'} submitted answers` : ''}.
                    {' '}Question editing has been locked to preserve exam integrity. Only the exam's general information can still be edited.
                  </p>
                </div>
              </div>
            )}

            {/* ── 1. Exam Delivery Mode ── */}
            <div className={cardClass}>
               {id ? (
                 <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-2xl transition-colors duration-500 ${exam.examType === 'ONLINE' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                       {exam.examType === 'ONLINE' ? <Sparkles className="h-6 w-6" /> : <Printer className="h-6 w-6" />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-indigo-550 dark:text-indigo-400 uppercase tracking-widest">Exam Delivery Mode</h3>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                        {exam.examType === 'ONLINE' ? 'Online Exam' : 'Printable Exam'}
                      </p>
                      <p className="text-[11px] text-slate-500/80 dark:text-slate-400/80 mt-1.5 font-medium">
                        Exam type is fixed after creation.
                      </p>
                    </div>
                 </div>
               ) : (
                 <>
                   <div className="flex items-center gap-3 mb-6">
                      <div className={`p-2 rounded-xl transition-colors duration-500 ${exam.examType === 'ONLINE' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                         {exam.examType === 'ONLINE' ? <Sparkles className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Exam Delivery Mode</h3>
                        <p className="text-xs text-slate-500">Choose how students will take this exam.</p>
                      </div>
                   </div>

                   <div className="tour-exam-types grid grid-cols-1 sm:grid-cols-2 gap-4 p-1">
                      {[
                        { type: 'ONLINE', label: 'Online Exam', icon: Sparkles, desc: 'Digital exam with QR join, live timer, and auto-grading.' },
                        { type: 'PRINTABLE_ONLY', label: 'Printable Exam', icon: Printer, desc: 'Generate a PDF for in-class paper exams. Not visible online.' },
                      ].map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setExam({ ...exam, examType: item.type })}
                          className={`flex flex-col text-left p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
                            exam.examType === item.type
                            ? `bg-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-50/50 dark:bg-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-500/10 border-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-500 ring-1 ring-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-500 shadow-md shadow-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-500/10 scale-[1.02]` 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 grayscale opacity-80 hover:grayscale-0 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <item.icon className={`h-5 w-5 ${exam.examType === item.type ? `text-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-600 dark:text-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-400` : 'text-slate-400'}`} />
                              <span className={`text-sm font-semibold ${exam.examType === item.type ? `text-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-900 dark:text-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-100` : 'text-slate-700 dark:text-slate-300'}`}>{item.label}</span>
                            </div>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center transition-all ${exam.examType === item.type ? `border-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-600 bg-${item.type === 'ONLINE' ? 'indigo' : 'emerald'}-600` : 'border-slate-300 dark:border-slate-600'}`}>
                              {exam.examType === item.type && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 ml-7.5 leading-relaxed">{item.desc}</p>
                        </button>
                      ))}
                   </div>
                 </>
               )}

               {/* Dynamic Features Ticker */}
               <div className="mt-4 flex items-center justify-center">
                 <div className="bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/60 rounded-full px-5 py-2 flex items-center gap-3.5 text-[11px] font-semibold text-slate-550 dark:text-slate-400 group hover:border-indigo-500/20 dark:hover:border-indigo-500/10 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-300">
                   <span className="hidden sm:inline-block shrink-0 uppercase tracking-widest text-slate-400 text-[10px] font-bold">Features:</span>
                   
                   <div className="relative h-5 w-[240px] sm:w-[350px] overflow-hidden">
                     {/* Online Features */}
                     <div className={`absolute inset-0 w-full flex items-center justify-between transition-all duration-500 ${exam.examType === 'ONLINE' ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95 pointer-events-none'}`}>
                       <div className="flex items-center gap-1 sm:gap-1.5 text-indigo-650 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                         <Clock className="h-3.5 w-3.5 text-indigo-500" />
                         <span>Live Timer</span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                         <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                         <span>Auto-grade<span className="hidden sm:inline">ing</span></span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1 sm:gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                         <QrCode className="h-3.5 w-3.5 text-blue-500" />
                         <span>QR <span className="hidden sm:inline">Code </span>Join</span>
                       </div>
                     </div>

                     {/* Printable Features */}
                     <div className={`absolute inset-0 w-full flex items-center justify-between transition-all duration-500 ${exam.examType === 'PRINTABLE_ONLY' ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full opacity-0 scale-95 pointer-events-none'}`}>
                       <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                         <Printer className="h-3.5 w-3.5 text-emerald-500" />
                         <span>PDF Export</span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1 sm:gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors">
                         <EyeOff className="h-3.5 w-3.5 text-rose-500" />
                         <span>Offline<span className="hidden sm:inline"> Exam</span></span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1 sm:gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                         <Award className="h-3.5 w-3.5 text-amber-500" />
                         <span>Manual <span className="hidden sm:inline">Grading</span><span className="inline sm:hidden">Grade</span></span>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
            </div>

            {/* ── 2. Basic Information ── */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BookOpen className="h-5 w-5" />
                 </div>
                 <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Basic Information</h2>
                    <p className="text-xs text-slate-500">Provide the primary details and instructions.</p>
                 </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${errors.title ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-950/10' : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'}`}
                    placeholder="e.g. DATA-602 FINAL EXAM"
                    value={exam.title}
                    onChange={e => {
                      setExam({ ...exam, title: e.target.value.toUpperCase() });
                      if (errors.title) setErrors(prev => ({ ...prev, title: null }));
                    }}
                    onBlur={() => {
                      if (!exam.title?.trim()) setErrors(prev => ({ ...prev, title: 'Title is required' }));
                    }} />
                  <FieldError message={errors.title} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    Rules & Instructions <span className="text-xs text-slate-400 font-normal">Optional</span>
                  </label>
                  <textarea rows={3} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                    placeholder="Specify allowed materials, guidelines, etc."
                    value={exam.description} onChange={e => setExam({ ...exam, description: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── 4. Grading & Results ── */}
            <div className={cardClass}>
               <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                     <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Grading & Results</h3>
                    <p className="text-xs text-slate-500">Configure points and result visibility.</p>
                  </div>
               </div>

               <div className="space-y-8">
                  {/* Total Grade Configuration */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Grade Calculation</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="flex-1 w-full flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => setIsAutoGrade(true)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${isAutoGrade ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                          Auto-sum from Questions
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAutoGrade(false)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${!isAutoGrade ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                          Fixed Total Point Value
                        </button>
                      </div>
                      
                      <div className="sm:w-32 w-full relative">
                         <input 
                          type="number" min="1" disabled={isAutoGrade} 
                          className={`w-full h-10 rounded-xl border text-center font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${isAutoGrade ? 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-indigo-500'}`}
                          value={isAutoGrade ? totalPoints : exam.totalGrade} 
                          onChange={e => setExam({ ...exam, totalGrade: e.target.value })} 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
                      </div>
                    </div>

                    {/* Dynamic Status / Progress Indicator */}
                    <div className="p-4 rounded-xl border transition-all duration-300 bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800/60">
                      {isAutoGrade ? (
                        <div className="flex items-center gap-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span>Auto-sum mode active: total exam points will dynamically sum up to <strong>{totalPoints} pts</strong> based on questions.</span>
                        </div>
                      ) : (() => {
                        const target = parseFloat(exam.totalGrade || 0);
                        const pct = target > 0 ? Math.min(100, Math.max(0, (totalPoints / target) * 100)) : 0;
                        const diff = target - totalPoints;
                        
                        let statusColor = "bg-indigo-500";
                        let ringColor = "border-indigo-500/30";
                        let textColor = "text-indigo-600 dark:text-indigo-400";
                        let statusIcon = Clock;
                        let statusMsg = "";

                        if (diff === 0) {
                          statusColor = "bg-emerald-500";
                          ringColor = "border-emerald-500/30";
                          textColor = "text-emerald-600 dark:text-emerald-400";
                          statusIcon = CheckCircle;
                          statusMsg = "✓ Total points correctly configured.";
                        } else if (diff > 0) {
                          statusColor = "bg-amber-500";
                          ringColor = "border-amber-500/30";
                          textColor = "text-amber-600 dark:text-amber-400";
                          statusIcon = AlertCircle;
                          statusMsg = `Current Question Points: ${totalPoints} / ${target} (${diff} points remaining)`;
                        } else {
                          statusColor = "bg-rose-500";
                          ringColor = "border-rose-500/30";
                          textColor = "text-rose-600 dark:text-rose-400";
                          statusIcon = XCircle;
                          statusMsg = `❌ Points overflow: ${totalPoints} / ${target} pts (${Math.abs(diff)} pts excess)`;
                        }

                        const IconComponent = statusIcon;

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className={`flex items-center gap-2 ${textColor}`}>
                                <IconComponent className="h-4 w-4 shrink-0" />
                                {statusMsg}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 font-bold">
                                {totalPoints} / {target} pts
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${statusColor} transition-all duration-500`} 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Animated Result Release Mode */}
                  <div className={`transition-all duration-700 overflow-hidden ${exam.examType === 'PRINTABLE_ONLY' ? 'max-h-[100px] opacity-100' : 'max-h-[1000px] opacity-100'}`}>
                    {exam.examType === 'PRINTABLE_ONLY' ? (
                       <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                          <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Result Release Mode is disabled because this is a <strong>Printable Exam</strong>. Scores are managed manually by the instructor outside the student portal.
                          </p>
                       </div>
                    ) : (
                      <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-500">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Result Release Mode</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-1">
                           {[
                             { mode: 1, approval: 0, label: 'Immediate', icon: Sparkles, desc: 'Shown upon submission', longDesc: 'Students see their score and auto-graded feedback instantly.', color: 'indigo' },
                             { mode: 2, approval: 0, label: 'After Deadline', icon: Clock, desc: 'Wait until end-time', longDesc: 'Results are locked and release automatically once the deadline passes.', color: 'blue' },
                             { mode: 0, approval: 1, label: 'Manual Review', icon: ShieldCheck, desc: 'Requires your approval', longDesc: 'Grades are held until you manually review and release them.', color: 'amber' },
                           ].map((item) => {
                             const isSelected = exam.showResults === item.mode && exam.requireAIGradeApproval === item.approval;
                             
                             let colorClasses = "";
                             if (isSelected) {
                               if (item.color === 'indigo') {
                                 colorClasses = "bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500 shadow-md shadow-indigo-500/10 scale-[1.02]";
                               } else if (item.color === 'blue') {
                                 colorClasses = "bg-blue-50/50 dark:bg-blue-500/10 border-blue-500 ring-1 ring-blue-500 shadow-md shadow-blue-500/10 scale-[1.02]";
                               } else {
                                 colorClasses = "bg-amber-50/50 dark:bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-md shadow-amber-500/10 scale-[1.02]";
                               }
                             } else {
                               colorClasses = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 grayscale opacity-80 hover:grayscale-0 hover:opacity-100";
                             }

                             return (
                               <button
                                 key={item.label}
                                 type="button"
                                 onClick={() => {
                                     setExam({ ...exam, showResults: item.mode, requireAIGradeApproval: item.approval });
                                     setErrors(prev => ({ ...prev, showResults: null }));
                                 }}
                                 className={`flex flex-col text-left p-5 rounded-xl border transition-all duration-300 cursor-pointer relative ${colorClasses}`}
                               >
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className={`p-2 rounded-lg transition-colors duration-300 ${
                                     isSelected 
                                       ? (item.color === 'indigo' ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : item.color === 'blue' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400')
                                       : (item.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-500' : item.color === 'blue' ? 'bg-blue-500/10 text-blue-400 dark:bg-blue-500/10 dark:text-blue-500' : 'bg-amber-500/10 text-amber-400 dark:bg-amber-500/10 dark:text-amber-500')
                                   }`}>
                                     <item.icon className="h-4.5 w-4.5" />
                                   </div>
                                   <span className={`text-sm font-bold ${
                                     isSelected 
                                       ? (item.color === 'indigo' ? 'text-indigo-900 dark:text-indigo-100' : item.color === 'blue' ? 'text-blue-900 dark:text-blue-100' : 'text-amber-900 dark:text-amber-100')
                                       : 'text-slate-700 dark:text-slate-300'
                                   }`}>{item.label}</span>
                                 </div>
                                 
                                 <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 leading-snug">{item.desc}</p>
                                 <p className="text-[11px] text-slate-500 leading-normal">{item.longDesc}</p>
                                 
                                 {isSelected && (
                                   <div className={`absolute top-4 right-4 h-2.5 w-2.5 rounded-full ${
                                     item.color === 'indigo' ? 'bg-indigo-500' : item.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
                                   }`} />
                                 )}
                               </button>
                             );
                           })}
                        </div>

                        <FieldError message={errors.showResults} />

                        {exam.requireAIGradeApproval === 1 && (
                           <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
                                Manual Review is active. AI will calculate scores, but they remain hidden until you release them.
                              </p>
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
             </div>

            {/* ── 5. Schedule & Timing ── */}
            <div className={`${cardClass} tour-schedule-timing`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Schedule & Timing</h2>
                  <p className="text-xs text-slate-500">
                    {exam.examType === 'PRINTABLE_ONLY'
                      ? 'Set the duration of the exam.'
                      : 'Define when the exam window opens and closes.'}
                  </p>
                </div>
              </div>

              {exam.examType !== 'PRINTABLE_ONLY' && (() => {
                const { date: startDateVal, time: startTimeVal } = parseDateTime(exam.startTime);
                const { date: endDateVal, time: endTimeVal } = parseDateTime(exam.endTime);

                // format "HH:MM" → "H:MM AM/PM"
                const formatDisplayTime = (t) => {
                  if (!t) return null;
                  const [hStr, mStr] = t.split(':');
                  let h = parseInt(hStr, 10);
                  const m = mStr || '00';
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  h = h % 12 || 12;
                  return `${h}:${m} ${ampm}`;
                };

                // format "YYYY-MM-DD" → "MMM D, YYYY"
                const formatDisplayDate = (d) => {
                  if (!d) return null;
                  const dt = new Date(d + 'T00:00:00');
                  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                };

                // Compute window duration in minutes (end - start)
                const windowMins = exam.startTime && exam.endTime
                  ? Math.round((new Date(exam.endTime) - new Date(exam.startTime)) / 60000)
                  : null;

                const windowLabel = windowMins && windowMins > 0
                  ? windowMins >= 60
                    ? `${Math.floor(windowMins / 60)}h ${windowMins % 60 > 0 ? windowMins % 60 + 'm' : ''} window`.trim()
                    : `${windowMins}m window`
                  : null;

                const hasError = endTimeStatus?.type === 'error' || errors.endTime || errors.startTime;
                const hasWarn = endTimeStatus?.type === 'warn';
                const hasOk = endTimeStatus?.type === 'ok';

                return (
                  <div className="mb-6">
                    {/* ── Exam Window Flow Card ── */}
                    <div className={`relative rounded-2xl border-2 transition-all duration-300 ${
                      hasError
                        ? 'border-rose-400 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-500/5'
                        : hasWarn
                        ? 'border-amber-400 dark:border-amber-500/40 bg-amber-50/20 dark:bg-amber-500/5'
                        : hasOk
                        ? 'border-emerald-400 dark:border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-500/5'
                        : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/20'
                    }`}>

                      {/* Window label pill — top center */}
                      {windowLabel && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide shadow-sm ${
                            hasError ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300'
                            : hasOk ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}>{windowLabel}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-stretch divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-700/80">

                        {/* ── START block ── */}
                        <div className="tour-start-timing p-4 sm:p-5 space-y-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Start</span>
                            {!isStartTimeDisabled ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const now = new Date();
                                  const pad = n => String(n).padStart(2, '0');
                                  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
                                  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
                                  setExam(prev => ({ ...prev, startTime: `${dateStr}T${timeStr}` }));
                                  setErrors(prev => ({ ...prev, startTime: null, endTime: null }));
                                }}
                                className="ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/25 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
                              >Now</button>
                            ) : (
                              <div className="ml-auto flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-250 dark:border-slate-700/30">
                                <Lock className="h-2.5 w-2.5 shrink-0" />
                                <span>Locked</span>
                              </div>
                            )}
                          </div>

                          {isStartTimeDisabled ? (
                            /* Locked — show the saved values as read-only badges */
                            <div className="flex flex-col gap-2">
                              <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{formatDisplayDate(startDateVal)}</span>
                              </div>
                              <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{formatDisplayTime(startTimeVal)}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Date picker */}
                              <CompactDatePicker
                                value={startDateVal}
                                min={minStartDatetimeLocal.split('T')[0]}
                                hasError={!!errors.startTime}
                                onChange={newDate => {
                                  const minStartDate = minStartDatetimeLocal.split('T')[0];
                                  let finalDate = newDate;
                                  if (finalDate && finalDate < minStartDate) finalDate = minStartDate;
                                  let finalTime = startTimeVal;
                                  const minStartTime = minStartDatetimeLocal.split('T')[1];
                                  if (finalDate === minStartDate && (!finalTime || finalTime < minStartTime)) finalTime = minStartTime;
                                  else if (!finalTime) finalTime = '09:00';
                                  setExam({ ...exam, startTime: combineDateTime(finalDate, finalTime) });
                                  setErrors(prev => ({ ...prev, startTime: null, endTime: null }));
                                }}
                              />

                              {/* Compact custom time picker */}
                              <CompactTimePicker
                                value={startTimeVal}
                                options={filteredStartTimeOptions}
                                placeholder="Pick time"
                                hasError={!!errors.startTime}
                                showNowOption={true}
                                onNowSelect={() => {
                                  const now = new Date();
                                  const pad = n => String(n).padStart(2, '0');
                                  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                                  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
                                  setExam(prev => ({ ...prev, startTime: `${dateStr}T${timeStr}` }));
                                  setErrors(prev => ({ ...prev, startTime: null, endTime: null }));
                                }}
                                onChange={newTime => {
                                  const finalDate = startDateVal || minStartDatetimeLocal.split('T')[0];
                                  setExam({ ...exam, startTime: combineDateTime(finalDate, newTime) });
                                  setErrors(prev => ({ ...prev, startTime: null, endTime: null }));
                                }}
                              />
                            </>
                          )}
                          {/* Display selected */}
                          {!isStartTimeDisabled && startDateVal && startTimeVal && (
                            <div className="flex items-center gap-1.5 px-0.5 animate-fade-in">
                              <CheckCircle className="h-3 w-3 text-indigo-400 shrink-0" />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {formatDisplayDate(startDateVal)} · {formatDisplayTime(startTimeVal)}
                              </span>
                            </div>
                          )}
                          {errors.startTime && (
                            <p className="text-[11px] text-rose-500 font-medium px-0.5 animate-fade-in">{errors.startTime}</p>
                          )}
                        </div>

                        {/* ── Arrow connector ── */}
                        <div className="hidden sm:flex flex-col items-center justify-center px-3 gap-1.5 bg-slate-50/80 dark:bg-slate-800/40">
                          <div className="h-px w-5 bg-slate-300 dark:bg-slate-600"></div>
                          <div className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <svg viewBox="0 0 16 8" className="w-8 h-3 text-slate-300 dark:text-slate-600">
                              <path d="M0 4 L12 4 M9 1 L12 4 L9 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          {windowMins && windowMins > 0 && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold text-center leading-tight">{windowMins}m</span>
                          )}
                        </div>

                        {/* ── END block ── */}
                        <div className="tour-end-timing p-4 sm:p-5 space-y-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className={`h-2 w-2 rounded-full ${hasError ? 'bg-rose-500' : hasOk ? 'bg-emerald-500' : 'bg-violet-500'}`}></div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">End</span>
                            <span className="text-rose-500 text-xs ml-auto">*</span>
                          </div>

                          {/* Date picker */}
                          <CompactDatePicker
                            value={endDateVal}
                            min={minEndDatetimeLocal.split('T')[0]}
                            hasError={hasError}
                            onChange={newDate => {
                              const minEndDate = minEndDatetimeLocal.split('T')[0];
                              let finalDate = newDate;
                              if (finalDate && finalDate < minEndDate) finalDate = minEndDate;
                              let finalTime = endTimeVal;
                              const minEndTime = minEndDatetimeLocal.split('T')[1];
                              if (finalDate === minEndDate && (!finalTime || finalTime < minEndTime)) finalTime = minEndTime;
                              else if (!finalTime) finalTime = startTimeVal || '10:00';
                              setExam({ ...exam, endTime: combineDateTime(finalDate, finalTime) });
                              setErrors(prev => ({ ...prev, endTime: null }));
                            }}
                          />

                          {/* Compact custom time picker */}
                          <CompactTimePicker
                            value={endTimeVal}
                            options={filteredEndTimeOptions}
                            placeholder="Pick time"
                            hasError={hasError}
                            onChange={newTime => {
                              const finalDate = endDateVal || minEndDatetimeLocal.split('T')[0];
                              setExam({ ...exam, endTime: combineDateTime(finalDate, newTime) });
                              setErrors(prev => ({ ...prev, endTime: null }));
                            }}
                          />

                          {/* Display selected */}
                          {endDateVal && endTimeVal && (
                            <div className="flex items-center gap-1.5 px-0.5">
                              {hasOk
                                ? <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                                : hasError
                                ? <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
                                : <CheckCircle className="h-3 w-3 text-violet-400 shrink-0" />
                              }
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {formatDisplayDate(endDateVal)} · {formatDisplayTime(endTimeVal)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Validation footer ── */}
                      {(endTimeStatus?.type === 'error' || errors.endTime || endTimeStatus?.type === 'warn' || endTimeStatus?.type === 'ok') && (
                        <div className={`px-4 py-2.5 rounded-b-2xl border-t text-xs font-medium flex items-center gap-2 ${
                          hasError
                            ? 'border-rose-300 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300'
                            : hasWarn
                            ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            : 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {hasError && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                          {hasWarn && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                          {hasOk && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                          <span>{endTimeStatus?.msg || errors.endTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Duration ── */}
              {(() => {
                const durationEmpty = !exam.duration || parseFloat(exam.duration) <= 0;
                const durationErr = durationEmpty
                  ? errors.duration || null
                  : null;
                // Show border error immediately if errors.duration is set OR field was cleared while was previously valid
                const showDurationError = !!errors.duration;

                return (
                  <div className={`${exam.examType === 'PRINTABLE_ONLY' ? '' : 'border-t border-slate-100 dark:border-slate-800 pt-5'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`p-1.5 rounded-lg transition-colors ${showDurationError ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          Exam Duration
                        </label>
                      </div>
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 50"
                          className={`w-full sm:w-28 h-10 rounded-xl border bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-center transition-all focus:outline-none focus:ring-2 ${
                            showDurationError
                              ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/20 bg-rose-50/50 dark:bg-rose-950/10'
                              : 'border-slate-200 dark:border-slate-700 focus:border-violet-400 focus:ring-violet-500/20'
                          }`}
                          value={exam.duration}
                          onChange={e => {
                            const val = e.target.value;
                            setExam({ ...exam, duration: val });
                            // Live clear: if the user typed a valid number, clear the error immediately
                            if (val && parseFloat(val) > 0) {
                              setErrors(prev => ({ ...prev, duration: null }));
                            } else {
                              // Live set: show error as soon as field becomes empty/invalid
                              setErrors(prev => ({ ...prev, duration: 'Exam duration is required' }));
                            }
                          }}
                          onBlur={() => {
                            if (!exam.duration || parseFloat(exam.duration) <= 0)
                              setErrors(prev => ({ ...prev, duration: 'Exam duration is required' }));
                          }}
                        />
                        <span className="text-sm text-slate-500 font-medium">minutes</span>
                        {exam.duration > 0 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            · {Math.floor(exam.duration / 60) > 0 ? `${Math.floor(exam.duration / 60)}h ` : ''}{exam.duration % 60 > 0 ? `${exam.duration % 60}m` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inline error message alert banner */}
                    {errors.duration && (
                      <div className="mt-3 flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 animate-in fade-in slide-in-from-top-1 duration-200">
                        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-700 dark:text-rose-350 font-medium leading-relaxed">
                          {errors.duration}
                        </p>
                      </div>
                    )}
                    {/* Duration mismatch friendly warning */}
                    {durationMismatch && (
                      <div className="mt-3 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 animate-in fade-in slide-in-from-top-1 duration-300">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                            Please provide enough time for students to complete the exam.
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                            The selected time window is <strong>{durationMismatch.windowMins} min</strong> but the exam duration is <strong>{exam.duration} min</strong> — {durationMismatch.shortfall} minute{durationMismatch.shortfall !== 1 ? 's' : ''} short. Extend the end time or shorten the duration.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>




          </div>
        )}

        {step === 2 && (
          <div className="tour-question-builder space-y-12 animate-in fade-in zoom-in-95 duration-500">
            {isQuestionsLocked ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 text-slate-800 dark:text-amber-305">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-amber-950 dark:text-amber-200">Question Construction is Locked</p>
                    <p className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed">
                      Active submissions: <strong>{submissionCount}</strong>. To preserve exam integrity, editing questions, options, or correctness here is fully blocked.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Edit General Info
                </button>
              </div>
            ) : (
              /* Sections explainer — subtle, always visible */
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-500/5 border border-indigo-200/60 dark:border-indigo-500/15 text-xs text-slate-600 dark:text-slate-400">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg border border-indigo-200 dark:border-indigo-500/20 shrink-0 mt-0.5">
                  <Layout className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Sections help you organize questions into groups</p>
                  <p className="text-slate-500 dark:text-slate-500 leading-relaxed">
                    Each section gets its own title shown to students during the exam — e.g. "Part A: Multiple Choice" or "Part B: Essay". You can rename any section by clicking its title. Add more sections using the button at the bottom.
                  </p>
                </div>
              </div>
            )}

            <div className={isQuestionsLocked ? "pointer-events-none select-none opacity-70" : ""}>

            {sections.map((section, sIdx) => {
              let globalQNum = sections.slice(0, sIdx).reduce((acc, s) => acc + s.questions.length, 0);
              return (
                <div key={section.id} className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-500">
                  {/* Section Header */}
                  <div className="flex items-start gap-4 px-1">
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                      <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-indigo-600/25">
                        {sIdx + 1}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <input
                        className={`w-full bg-transparent border-none outline-none text-xl sm:text-2xl font-black text-slate-900 dark:text-white hover:text-indigo-500 focus:text-indigo-500 dark:hover:text-indigo-400 dark:focus:text-indigo-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 ${isQuestionsLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                        value={section.title}
                        disabled={isQuestionsLocked}
                        onChange={e => updateSectionTitle(section.id, e.target.value)}
                        placeholder="Section Title (e.g. Multiple Choice Questions)"
                      />
                      <input
                        className={`w-full bg-transparent border-none outline-none text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 focus:text-slate-700 dark:focus:text-slate-300 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 ${isQuestionsLocked ? 'cursor-not-allowed opacity-85' : ''}`}
                        value={section.description || ''}
                        disabled={isQuestionsLocked}
                        onChange={e => updateSectionDescription(section.id, e.target.value)}
                        placeholder="Optional: instructions or notes for this section — e.g. 'Answer all questions. Each is worth 5 points.'"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 rounded-lg">
                        {section.questions.length} {section.questions.length === 1 ? 'question' : 'questions'}
                      </span>
                      {!isQuestionsLocked && sections.length > 1 && (
                        <button type="button" onClick={() => removeSection(section.id)}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pl-6 border-l-2 border-indigo-200/60 dark:border-slate-800 space-y-6">
                    {section.questions.length === 0 && !isQuestionsLocked && (
                      <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 group hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-all">
                        <PlusCircle className="h-9 w-9 text-slate-300 dark:text-slate-700 mx-auto mb-3 group-hover:text-indigo-400 transition-all duration-500" />
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">This section is empty</p>
                        <p className="text-xs text-slate-400 dark:text-slate-600 mb-5 max-w-xs mx-auto">
                          Add questions below — they'll be grouped under "<span className="font-semibold">{section.title || 'this section'}</span>" during the exam.
                        </p>
                        <ErrorBoundary>
                          <AddBar onAddQuestion={type => addQuestionToSection(section.id, type)} />
                        </ErrorBoundary>
                      </div>
                    )}

                    {section.questions.map((q, qIdx) => {
                      const qN = globalQNum + qIdx + 1;
                      // Only show errors for questions that were failing when Publish was clicked.
                      // New questions added after Publish are never in publishTouchedUids → always clean.
                      const qErrors = publishTouchedUids.has(q._uid)
                        ? (liveErrorsByUid[q._uid] || [])
                        : [];
                      return (
                        <div key={q._uid || qIdx} id={`question-card-${qN}`} className="space-y-2">
                          <ErrorBoundary>
                            <QuestionCard
                              q={q} qNum={qN}
                              onUpdate={(field, val) => updateQuestion(section.id, qIdx, field, val)}
                              onRemove={() => removeQuestion(section.id, qIdx)}
                              onOptionUpdate={(oIdx, val) => updateOption(section.id, qIdx, oIdx, val)}
                              onAddOption={() => addOption(section.id, qIdx)}
                              onRemoveOption={(oIdx) => removeOption(section.id, qIdx, oIdx)}
                              onToggleMultiple={(val) => toggleMultiple(section.id, qIdx, val)}
                              hasError={qErrors.length > 0}
                              errorMessages={qErrors}
                              examType={exam.examType}
                              isLocked={isQuestionsLocked}
                            />
                          </ErrorBoundary>
                          {!isQuestionsLocked && (
                            <AddBar onAddQuestion={type => addQuestionToSection(section.id, type, qIdx)} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!isQuestionsLocked && sIdx === sections.length - 1 && (
                    <button
                      type="button"
                      onClick={() => addSection(section.id)}
                      className="w-full flex flex-col items-center justify-center gap-1.5 py-7 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all mt-4 group"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" />
                        Add New Section
                      </div>
                      <p className="text-[11px] font-normal text-slate-400 dark:text-slate-600">
                        Group questions by type or topic — e.g. "Essay Questions", "Coding Problems"
                      </p>
                    </button>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* ── Phase 3 — Exam Paper Details (Printable Only) ── */}
        {step === 3 && isPrintable && (
          <div className="space-y-6 animate-in zoom-in-95 fade-in duration-500 max-w-3xl mx-auto">

            {/* Completion Checklist */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Completion Checklist</h3>
                  <p className="text-xs text-slate-500">All required fields must be completed before printing or publishing.</p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-black tracking-tighter ${getMetaCompletion().completed === getMetaCompletion().total ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {getMetaCompletion().completed}/{getMetaCompletion().total}
                  </span>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Complete</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
                <div 
                  className={`h-full transition-all duration-700 rounded-full ${getMetaCompletion().completed === getMetaCompletion().total ? 'bg-emerald-500' : 'bg-violet-500'}`}
                  style={{ width: `${(getMetaCompletion().completed / getMetaCompletion().total) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getMetaCompletion().fields.map(f => (
                  <div key={f.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                    f.done 
                      ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5' 
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
                  }`}>
                    {f.done 
                      ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /> 
                      : <Circle className="h-4 w-4 text-slate-400 shrink-0" />
                    }
                    <span className={`text-xs font-semibold ${f.done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Exam Category Selector */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Exam Category <span className="text-rose-500">*</span></h3>
                  <p className="text-xs text-slate-500">What type of assessment is this?</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {['Final', 'Midterm', 'Quiz', 'Practical', 'Assignment', 'Other'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, examCategory: cat } }));
                      setErrors(prev => ({ ...prev, examCategory: null }));
                    }}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all duration-300 ${
                      exam.examMeta?.examCategory === cat
                        ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500 shadow-md shadow-amber-500/10 scale-[1.03]'
                        : `border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-300 dark:hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-400 ${errors.examCategory ? 'border-rose-300 dark:border-rose-500/30' : ''}`
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <FieldError message={errors.examCategory} />
            </div>

            {/* Institution & Academic Information */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Institution & Academic Information</h3>
                  <p className="text-xs text-slate-500">These details will appear on your printed exam header.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Institution Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      University / Institution Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${errors.institutionName ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-500/5' : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'}`}
                      placeholder="e.g. University of Jordan"
                      value={exam.examMeta?.institutionName || ''}
                      onChange={e => {
                        setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, institutionName: e.target.value } }));
                        if (errors.institutionName) setErrors(prev => ({ ...prev, institutionName: null }));
                      }}
                      onBlur={() => {
                        if (!exam.examMeta?.institutionName?.trim()) setErrors(prev => ({ ...prev, institutionName: 'University/Institution Name is required' }));
                      }}
                    />
                    <FieldError message={errors.institutionName} />
                  </div>

                  {/* Faculty / College */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Faculty / College Name <span className="text-xs text-slate-400 font-normal">Optional</span>
                    </label>
                    <input 
                      className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="e.g. Faculty of IT"
                      value={exam.examMeta?.facultyName || ''}
                      onChange={e => setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, facultyName: e.target.value } }))}
                    />
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Department Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${errors.departmentName ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-500/5' : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'}`}
                      placeholder="e.g. Computer Science"
                      value={exam.examMeta?.departmentName || ''}
                      onChange={e => {
                        setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, departmentName: e.target.value } }));
                        if (errors.departmentName) setErrors(prev => ({ ...prev, departmentName: null }));
                      }}
                      onBlur={() => {
                        if (!exam.examMeta?.departmentName?.trim()) setErrors(prev => ({ ...prev, departmentName: 'Department Name is required' }));
                      }}
                    />
                    <FieldError message={errors.departmentName} />
                  </div>

                  {/* Course Name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Course Name / Code <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${errors.courseName ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-500/5' : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'}`}
                      placeholder="e.g. DATA-602 Data Structures"
                      value={exam.examMeta?.courseName || ''}
                      onChange={e => {
                        setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, courseName: e.target.value } }));
                        if (errors.courseName) setErrors(prev => ({ ...prev, courseName: null }));
                      }}
                      onBlur={() => {
                        if (!exam.examMeta?.courseName?.trim()) setErrors(prev => ({ ...prev, courseName: 'Course Name/Code is required' }));
                      }}
                    />
                    <FieldError message={errors.courseName} />
                  </div>

                  {/* Instructor Name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Instructor Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${errors.instructorName ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-500/5' : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'}`}
                      placeholder="e.g. Dr. Ahmad Hassan"
                      value={exam.examMeta?.instructorName || ''}
                      onChange={e => {
                        setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, instructorName: e.target.value } }));
                        if (errors.instructorName) setErrors(prev => ({ ...prev, instructorName: null }));
                      }}
                      onBlur={() => {
                        if (!exam.examMeta?.instructorName?.trim()) setErrors(prev => ({ ...prev, instructorName: 'Instructor Name is required' }));
                      }}
                    />
                    <FieldError message={errors.instructorName} />
                  </div>
                </div>
              </div>
            </div>

            {/* Date & Semester */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Date & Semester</h3>
                  <p className="text-xs text-slate-500">When does this exam take place?</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    Academic Year / Semester <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${errors.academicYear ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-500/5' : 'border-slate-300 dark:border-slate-700 focus:border-sky-500'}`}
                    placeholder="e.g. 2025 - Fall"
                    value={exam.examMeta?.academicYear || ''}
                    onChange={e => {
                      setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, academicYear: e.target.value } }));
                      if (errors.academicYear) setErrors(prev => ({ ...prev, academicYear: null }));
                    }}
                    onBlur={() => {
                      if (!exam.examMeta?.academicYear?.trim()) setErrors(prev => ({ ...prev, academicYear: 'Academic Year/Semester is required' }));
                    }}
                  />
                  <FieldError message={errors.academicYear} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    Exam Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${errors.examDate ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-500/5' : 'border-slate-300 dark:border-slate-700 focus:border-sky-500'}`}
                    value={exam.examMeta?.examDate || ''}
                    onChange={e => {
                      setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, examDate: e.target.value } }));
                      if (errors.examDate) setErrors(prev => ({ ...prev, examDate: null }));
                    }}
                    onBlur={() => {
                      if (!exam.examMeta?.examDate) setErrors(prev => ({ ...prev, examDate: 'Exam Date is required' }));
                    }}
                  />
                  <FieldError message={errors.examDate} />
                </div>
              </div>
            </div>

            {/* Institution Logo */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
                  <Image className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Institution Logo <span className="text-xs text-slate-400 font-normal">(Optional)</span></h3>
                  <p className="text-xs text-slate-500">Upload a logo to appear in the exam header.</p>
                </div>
              </div>

              {exam.examMeta?.logoUrl ? (
                <div className="flex items-center gap-6 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800">
                  <img src={exam.examMeta.logoUrl} className="h-20 w-20 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1" alt="Logo Preview" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Logo uploaded</p>
                    <p className="text-xs text-slate-500">This will appear in the top-left of your exam header.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, logoUrl: '' } }))}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold transition-all"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-fuchsia-400/50 hover:bg-fuchsia-500/5 transition-all cursor-pointer group">
                  <Upload className="h-8 w-8 text-slate-400 group-hover:text-fuchsia-500 mb-3 transition-colors" />
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-fuchsia-500 transition-colors">Click to upload logo</span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG, SVG up to 500KB</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500 * 1024) {
                        toast.error('Logo must be under 500KB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, logoUrl: ev.target.result } }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>

            {/* Exam Instructions — Optional */}
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Exam Instructions
                    <span className="text-xs font-normal text-slate-400">(Optional)</span>
                  </h3>
                  <p className="text-xs text-slate-500">Shown to students on the printed exam. Leave blank to omit this section entirely.</p>
                </div>
              </div>
              <textarea
                rows={5}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 transition-all resize-none leading-relaxed"
                placeholder={`e.g.\n• Answer all questions.\n• Each question has one correct answer unless stated otherwise.\n• Mobiles and electronic devices are not allowed.\n• Duration: ${exam.duration ? exam.duration + ' minutes' : '—'}`}
                value={exam.examMeta?.examInstructions || ''}
                onChange={e => setExam(prev => ({ ...prev, examMeta: { ...prev.examMeta, examInstructions: e.target.value } }))}
              />
              {!exam.examMeta?.examInstructions?.trim() && (
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  No instructions provided — the Instructions section will not appear in the PDF.
                </p>
              )}
            </div>

            {/* Summary Preview */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/5 via-transparent to-emerald-500/5 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Printer className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Exam Paper Preview Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Title:</strong> {exam.title || '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Category:</strong> {exam.examMeta?.examCategory || '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Institution:</strong> {exam.examMeta?.institutionName || '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Department:</strong> {exam.examMeta?.departmentName || '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Course:</strong> {exam.examMeta?.courseName || '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Instructor:</strong> {exam.examMeta?.instructorName || '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Date:</strong> {exam.examMeta?.examDate ? new Date(exam.examMeta.examDate).toLocaleDateString() : '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Duration:</strong> {exam.duration ? `${exam.duration} min` : '—'}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Questions:</strong> {allQuestions.length}</div>
                <div className="text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Total Points:</strong> {totalPoints}</div>
              </div>
            </div>

          </div>
        )}

        {/* ── Publish / Launch Validation Summary Modal ── */}
        {showValidationModal && (() => {
          // Group errors by question number
          const byQuestion = {};
          liveQuestionErrors.forEach(err => {
            const m = err.match(/^Question (\d+):\s*(.*)/);
            if (m) {
              const n = parseInt(m[1]);
              if (!byQuestion[n]) byQuestion[n] = [];
              byQuestion[n].push(m[2]);
            }
          });
          const questionNums = Object.keys(byQuestion).map(Number).sort((a, b) => a - b);
          const noQuestionsAtAll = allQuestions.length === 0;

          const scrollToQuestion = (n) => {
            setShowValidationModal(false);
            requestAnimationFrame(() => {
              const el = document.getElementById(`question-card-${n}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
              style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
            >
              <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_32px_72px_-16px_rgba(0,0,0,0.3)] dark:shadow-[0_32px_72px_-16px_rgba(0,0,0,0.65)] border border-slate-200/80 dark:border-slate-700/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">

                {/* Header */}
                <div className="px-7 pt-7 pb-5">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 shrink-0">
                      <CheckSquare className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
                        {noQuestionsAtAll ? 'No questions added yet' : 'Some questions require attention'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {noQuestionsAtAll
                          ? 'Add at least one question before publishing this exam.'
                          : 'Please complete the following before publishing this exam.'}
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                </div>

                {/* Checklist — only shown when there are specific question issues */}
                {!noQuestionsAtAll && (
                  <div className="px-7 pb-2 max-h-64 overflow-y-auto space-y-1.5">
                    {questionNums.map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => scrollToQuestion(n)}
                        className="w-full flex items-start gap-3 px-3.5 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
                      >
                        <span className="shrink-0 mt-0.5 h-5 w-5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
                          <span className="text-[9px] font-black text-rose-500">{n}</span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Question {n}</p>
                          <ul className="space-y-1">
                            {byQuestion[n].map((msg, i) => {
                              const colonIdx = msg.indexOf(':');
                              const prefix = colonIdx !== -1 ? msg.slice(0, colonIdx) : null;
                              const field  = colonIdx !== -1 ? msg.slice(colonIdx + 1).trim() : msg;
                              const isFix  = prefix === 'Fix';
                              return (
                                <li key={i} className="flex items-baseline gap-1.5 text-[11px] leading-relaxed">
                                  <span className={`font-bold shrink-0 ${isFix ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {prefix ?? '—'}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-300">{field}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity self-center whitespace-nowrap">
                          Go to →
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="px-7 pt-4 pb-7">
                  <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4" />
                  <button
                    type="button"
                    onClick={() => setShowValidationModal(false)}
                    className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    {noQuestionsAtAll ? 'Go Back and Add Questions' : 'Review Questions'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Multi-Answer Warning Modal ── */}
        {showMultiAnswerWarning && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
          >
            <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_32px_72px_-16px_rgba(0,0,0,0.3)] dark:shadow-[0_32px_72px_-16px_rgba(0,0,0,0.65)] border border-slate-200/80 dark:border-slate-700/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">
              
              {/* Header */}
              <div className="px-7 pt-7 pb-5">
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
                      Review Multiple Choice configurations
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Some questions have Multiple Selection enabled but only one correct choice selected.
                    </p>
                  </div>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800" />
              </div>

              {/* Questions List */}
              <div className="px-7 pb-2 max-h-64 overflow-y-auto space-y-1.5">
                {pendingMultiAnswerQuestions.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setShowMultiAnswerWarning(false);
                      requestAnimationFrame(() => {
                        const el = document.getElementById(`question-card-${n}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      });
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 h-5 w-5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                        <span className="text-[9px] font-black text-amber-500">{n}</span>
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Question {n}</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">Multiple Selection active, but only 1 option marked correct</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Go to →
                    </span>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-7 pt-4 pb-7">
                <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4" />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMultiAnswerWarning(false);
                      setMultiAnswerConfirmed(true);
                      handleSubmit(null, true);
                    }}
                    className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Publish Anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMultiAnswerWarning(false)}
                    className="w-full h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all"
                  >
                    Go Back & Review
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Fixed Interaction Matrix ── */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 sm:px-6 z-[100]">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 p-4 shadow-[0_15px_35px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.4)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Left section: Stats & Draft status */}
            <div className="flex items-center justify-between md:justify-start gap-6 px-2">
              {/* Grade / Points Status */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Points Configured</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-extrabold tracking-tight ${pointsOk ? 'text-slate-900 dark:text-white' : 'text-rose-500 dark:text-rose-450'}`}>
                    {totalPoints}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    / {isAutoGrade ? totalPoints : (exam.totalGrade || '—')} pts
                  </span>
                  <div className={`h-2.5 w-2.5 rounded-full ${pointsOk ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                </div>
              </div>

              {/* Local Draft Status */}
              <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <Save className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Draft Saved</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to discard your local draft and reload?")) {
                        localStorage.removeItem(`exam_draft_${id || 'new'}`);
                        window.location.reload();
                      }
                    }}
                    className="text-left text-[11px] font-medium text-rose-500 hover:text-rose-650 dark:hover:text-rose-400 hover:underline transition-all"
                  >
                    Discard Changes
                  </button>
                </div>
              </div>
            </div>

            {/* Right section: Action buttons */}
            <div className="flex items-center justify-end gap-3 px-1">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  style={{ touchAction: 'manipulation' }}
                  className="h-11 px-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider border border-slate-200 dark:border-slate-700/80 transition-all active:scale-[0.98]"
                >
                  Back
                </button>
              )}

              <button
                type="submit"
                disabled={loading || (step === 2 && !pointsOk && !isPrintable && !isQuestionsLocked)}
                style={{ touchAction: 'manipulation' }}
                className={`tour-publish-btn h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  step === 1 && isQuestionsLocked
                    ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20'
                    : step === 1
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100'
                    : step === 3
                    ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/10'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/10'
                }`}
              >
                {loading ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    <span>
                      {step === 1 && isQuestionsLocked ? 'Save Changes'
                        : step === 1 ? 'Go to Construction' 
                        : step === 2 && isPrintable ? 'Continue to Paper Details'
                        : step === 3 ? (id ? 'Update & Finalize' : 'Publish Exam')
                        : (id ? 'Update Assessment' : 'Broadcast Live')}
                    </span>
                    {step === 1 && isQuestionsLocked ? <Save className="h-4 w-4" /> : step === 3 ? <Printer className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
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
