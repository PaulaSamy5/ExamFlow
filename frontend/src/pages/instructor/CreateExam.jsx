import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import ErrorBoundary from '../../components/ErrorBoundary';
import { FieldError } from '../../components/FieldError';
import {
  Plus, Trash2, Save, ArrowLeft,
  HelpCircle, Type, CheckSquare, AlignLeft,
  Calendar, Clock, Award, Loader2, AlertCircle,
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
const QuestionCard = ({ q, qNum, onUpdate, onRemove, onOptionUpdate, onAddOption, onRemoveOption, onToggleMultiple, hasError, errorMessages = [], examType }) => (
  <div className={`rounded-[2.5rem] border backdrop-blur-sm overflow-hidden transition-all relative group/card ${
    hasError 
      ? 'border-rose-500 bg-rose-50/5 dark:bg-rose-950/5 ring-1 ring-rose-500/20' 
      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:border-indigo-500/30'
  }`}>
    {/* Card top strip with neon accent */}
    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${hasError ? 'from-transparent via-rose-500 to-transparent' : 'from-transparent via-indigo-500/20 to-transparent'}`} />

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
        {hasError && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-in fade-in duration-200">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {errorMessages.length === 1 ? 'Fix 1 issue' : `Fix ${errorMessages.length} issues`}
          </span>
        )}
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
                          className={`input-field w-full text-lg font-black ${hasTitleErr ? 'border-rose-500 dark:border-rose-500/80 bg-rose-50/40 dark:bg-rose-950/20' : ''}`}
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
                          onClick={() => onUpdate('options', JSON.stringify({ ...codingOpts, requiredLanguage: lang.id }))}
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
              try { umlOpts = q.options ? JSON.parse(q.options) : umlOpts; } catch (e) { }
              return (
                <div className="space-y-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block ml-2">Scenario Title</label>
                    <input
                      required
                      className="input-field w-full text-lg font-black bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 focus:border-cyan-500/50"
                      placeholder="e.g. Hospital Management System"
                      value={umlOpts.title || ''}
                      onChange={e => onUpdate('options', JSON.stringify({ ...umlOpts, title: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-2">Diagram Type</label>
                      <select
                        className="input-field w-full text-sm bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200"
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
                        className={`input-field w-full text-center font-bold text-amber-400 transition-all ${hasPointsError ? 'border-rose-500 dark:border-rose-500/80 bg-rose-50/40 dark:bg-rose-950/20 focus:ring-rose-500/20' : ''}`}
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
                    onClick={() => onToggleMultiple(!q.isMultiple)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${q.isMultiple ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${q.isMultiple ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

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
                                  className={`bg-transparent border-none outline-none w-full text-sm font-bold placeholder:text-slate-600 ${optHasError ? 'text-rose-600 dark:text-rose-400 placeholder:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}
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

                        {optsArr.length < 8 && (
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
                  onClick={() => onUpdate('correctAnswer', val)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm border transition-all ${q.correctAnswer === val ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
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
                  className={`bg-slate-100 dark:bg-slate-800 border outline-none focus:ring-1 transition-all rounded-lg px-3 py-2 w-full text-emerald-400 font-bold text-sm ${hasFillErr ? 'border-rose-500 dark:border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/20 focus:border-rose-500 focus:ring-rose-500/50' : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'}`}
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
                className="input-field w-full text-sm leading-relaxed"
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
      const isMultipleMode = q.isMultiple === 1 || q.isMultiple === true;
      if (isMultipleMode) {
        let ans = [];
        try { ans = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer; } catch (e) {}
        if (!Array.isArray(ans) || ans.length === 0) errs.push(`Question ${qNum}: Missing: Correct Answer`);
      } else {
        if (!q.correctAnswer || String(q.correctAnswer).trim() === '') {
          errs.push(`Question ${qNum}: Missing: Correct Answer`);
        } else if (String(q.correctAnswer).startsWith('idx:')) {
          const oIdx = parseInt(String(q.correctAnswer).split(':')[1]);
          if (isNaN(oIdx) || oIdx < 0 || oIdx >= optsArray.length) errs.push(`Question ${qNum}: Missing: Correct Answer`);
        }
      }
    } else if (q.type === 'TRUE_FALSE') {
      if (q.correctAnswer !== 'True' && q.correctAnswer !== 'False') errs.push(`Question ${qNum}: Missing: Correct Answer (True / False)`);
    } else if (q.type === 'FILL_BLANKS') {
      if (!q.correctAnswer || String(q.correctAnswer).trim() === '') errs.push(`Question ${qNum}: Missing: Correct Answer`);
    } else if (q.type === 'MATH') {
      const mathOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
      if (!mathOpts.correctFinalAnswer || String(mathOpts.correctFinalAnswer).trim() === '') errs.push(`Question ${qNum}: Missing: Correct Final Answer`);
    } else if (q.type === 'ESSAY') {
      if (!q.correctAnswer || String(q.correctAnswer).trim() === '') errs.push(`Question ${qNum}: Missing: Model Answer`);
    } else if (q.type === 'CODING') {
      const codingOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
      if (!codingOpts.title || String(codingOpts.title).trim() === '') errs.push(`Question ${qNum}: Missing: Problem Title`);
      if (!q.correctAnswer || String(q.correctAnswer).trim() === '') errs.push(`Question ${qNum}: Missing: Sample Solution`);
    } else if (q.type === 'UML') {
      const umlOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
      if (!umlOpts.title || String(umlOpts.title).trim() === '') errs.push(`Question ${qNum}: Missing: Scenario Title`);
      if (!umlOpts.modelAnswerText || String(umlOpts.modelAnswerText).trim() === '') errs.push(`Question ${qNum}: Missing: Model Answer / Expected Components`);
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
  const [validationTriggered, setValidationTriggered] = useState(false);

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
  const liveQuestionErrors = useMemo(
    () => validateAllQuestions(allQuestions),
    [allQuestions]
  );

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

  const updateSectionDescription = (id, description) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, description } : s));
  };

  const isPrintable = exam.examType === 'PRINTABLE_ONLY';
  const maxStep = isPrintable ? 3 : 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }

    // Block publish/launch if any question is incomplete — show the summary modal and mark cards
    if (liveQuestionErrors.length > 0) {
      if (step === 3) setStep(2);
      setValidationTriggered(true);
      setShowValidationModal(true);
      return;
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
        const isNotMultiple = !payload.isMultiple || payload.isMultiple === 0;
        if (payload.type === 'MCQ' && isNotMultiple && String(payload.correctAnswer).startsWith('idx:')) {
          const idx = parseInt(payload.correctAnswer.split(':')[1]);
          payload.correctAnswer = (payload.options && payload.options[idx]) ? payload.options[idx] : payload.correctAnswer;
        }
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

  const cardClass = "bg-white dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm transition-all duration-500";

  return (
    <div className="max-w-4xl mx-auto pb-8 px-6 pt-0"> {/* Strictly top-aligned */}

      {/* Dynamic Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-white hover:border-slate-300 dark:border-slate-700 transition-all shadow-xl shadow-black/20 group">
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-inner ${
                step === 1 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                : step === 2 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              }`}>
                {step === 1 ? 'Phase 01 — Blueprint' : step === 2 ? 'Phase 02 — Construction' : 'Phase 03 — Exam Paper Details'}
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
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {step === 1 ? 'Next: Build Questions' : step === 2 ? (isPrintable ? 'Next: Exam Paper Details' : 'Total Grade Allocation') : 'Final Step — Complete Details'}
            </p>
            <p className="text-sm font-black text-indigo-400">
              {step === 1 ? 'Configuration Phase' : step === 2 ? `${totalPoints} Points Established` : `${getMetaCompletion().completed} / ${getMetaCompletion().total} Fields Complete`}
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700" noValidate>

        {step === 1 && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500 max-w-3xl mx-auto">
            
            {/* ── 1. Exam Delivery Mode ── */}
            <div className={cardClass}>
               <div className="flex items-center gap-3 mb-6">
                  <div className={`p-2 rounded-xl transition-colors duration-500 ${exam.examType === 'ONLINE' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                     {exam.examType === 'ONLINE' ? <Sparkles className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Exam Delivery Mode</h3>
                    <p className="text-xs text-slate-500">Choose how students will take this exam.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-1">
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

               {/* Dynamic Features Ticker */}
               <div className="mt-4 flex items-center justify-center">
                 <div className="bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/60 rounded-full px-5 py-2 flex items-center gap-3.5 text-[11px] font-semibold text-slate-550 dark:text-slate-400 group hover:border-indigo-500/20 dark:hover:border-indigo-500/10 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-300">
                   <span className="shrink-0 uppercase tracking-widest text-slate-400 text-[10px] font-bold">Features:</span>
                   
                   <div className="relative h-5 w-[280px] sm:w-[350px] overflow-hidden">
                     {/* Online Features */}
                     <div className={`absolute inset-0 w-full flex items-center justify-between transition-all duration-500 ${exam.examType === 'ONLINE' ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95 pointer-events-none'}`}>
                       <div className="flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                         <Clock className="h-3.5 w-3.5 text-indigo-500" />
                         <span>Live Timer</span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                         <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                         <span>Auto-grading</span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                         <QrCode className="h-3.5 w-3.5 text-blue-500" />
                         <span>QR Code Join</span>
                       </div>
                     </div>

                     {/* Printable Features */}
                     <div className={`absolute inset-0 w-full flex items-center justify-between transition-all duration-500 ${exam.examType === 'PRINTABLE_ONLY' ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full opacity-0 scale-95 pointer-events-none'}`}>
                       <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                         <Printer className="h-3.5 w-3.5 text-emerald-500" />
                         <span>PDF Export</span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors">
                         <EyeOff className="h-3.5 w-3.5 text-rose-500" />
                         <span>Offline Exam</span>
                       </div>
                       <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                       <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                         <Award className="h-3.5 w-3.5 text-amber-500" />
                         <span>Manual Grading</span>
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
                  <div className={`transition-all duration-700 overflow-hidden ${exam.examType === 'PRINTABLE_ONLY' ? 'max-h-[100px] opacity-100' : 'max-h-[300px] opacity-100'}`}>
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
            <div className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Calendar className="h-5 w-5" />
                 </div>
                 <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Schedule & Timing</h2>
                    <p className="text-xs text-slate-500">
                      {exam.examType === 'PRINTABLE_ONLY' 
                        ? 'Set the duration of the exam.' 
                        : 'Set the date, time, and duration of the exam.'}
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {exam.examType !== 'PRINTABLE_ONLY' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        Start Date <span className="text-xs text-slate-400 font-normal">Optional</span>
                      </label>
                      <input
                        type="datetime-local"
                        min={minStartDatetimeLocal}
                        className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        value={exam.startTime}
                        onChange={e => {
                          let val = e.target.value;
                          if (val && val < minStartDatetimeLocal) {
                            val = minStartDatetimeLocal;
                          }
                          setExam({ ...exam, startTime: val });
                          setErrors(prev => ({ ...prev, startTime: null, endTime: null }));
                        }}
                        onBlur={e => {
                          let val = e.target.value;
                          if (val && val < minStartDatetimeLocal) {
                            setExam(prev => ({ ...prev, startTime: minStartDatetimeLocal }));
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        End Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        min={minEndDatetimeLocal}
                        className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                          endTimeStatus?.type === 'error' || errors.endTime
                            ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-950/10'
                            : endTimeStatus?.type === 'warn'
                            ? 'border-amber-400 focus:border-amber-400 bg-amber-50/30 dark:bg-amber-900/10'
                            : endTimeStatus?.type === 'ok'
                            ? 'border-emerald-500 focus:border-emerald-500'
                            : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                        }`}
                        value={exam.endTime}
                        onChange={e => {
                          let val = e.target.value;
                          if (val && val < minEndDatetimeLocal) {
                            val = minEndDatetimeLocal;
                          }
                          setExam({ ...exam, endTime: val });
                          setErrors(prev => ({ ...prev, endTime: null }));
                        }}
                        onBlur={e => {
                          if (!exam.endTime) {
                            setErrors(prev => ({ ...prev, endTime: 'End time is required' }));
                          } else {
                            let val = e.target.value;
                            if (val && val < minEndDatetimeLocal) {
                              setExam(prev => ({ ...prev, endTime: minEndDatetimeLocal }));
                            }
                          }
                        }}
                      />

                      {/* Live intelligent warning — replaces static FieldError */}
                      {(endTimeStatus?.type === 'error' || errors.endTime) && (
                        <div className="flex items-start gap-2.5 mt-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 animate-in fade-in slide-in-from-top-1 duration-200">
                          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                            {endTimeStatus?.msg || errors.endTime}
                          </p>
                        </div>
                      )}
                      {endTimeStatus?.type === 'warn' && (
                        <div className="flex items-start gap-2.5 mt-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 animate-in fade-in slide-in-from-top-1 duration-200">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                            {endTimeStatus.msg}
                          </p>
                        </div>
                      )}
                      {endTimeStatus?.type === 'ok' && (
                        <div className="flex items-center gap-2 mt-1.5 px-1">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Valid — enough time for the full exam.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className={`space-y-1.5 ${exam.examType === 'PRINTABLE_ONLY' ? 'sm:col-span-3' : ''}`}>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    Duration <span className="text-xs text-slate-400 font-normal">Minutes</span>
                  </label>
                  <input type="number" min="1"
                    className={`w-full h-11 rounded-xl border bg-white dark:bg-slate-900 px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${errors.duration ? 'border-rose-500 focus:border-rose-500 bg-rose-50/50 dark:bg-rose-950/10' : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'}`}
                    value={exam.duration}
                    onChange={e => {
                      setExam({ ...exam, duration: e.target.value });
                      if (errors.duration) setErrors(prev => ({ ...prev, duration: null }));
                    }}
                    onBlur={() => {
                      if (!exam.duration || parseFloat(exam.duration) <= 0) setErrors(prev => ({ ...prev, duration: 'Valid duration is required' }));
                    }} />
                  <FieldError message={errors.duration} />
                </div>
              </div>
            </div>

          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
            {/* Sections explainer — subtle, always visible */}
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
                        className="w-full bg-transparent border-none outline-none text-xl sm:text-2xl font-black text-slate-900 dark:text-white hover:text-indigo-500 focus:text-indigo-500 dark:hover:text-indigo-400 dark:focus:text-indigo-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={section.title}
                        onChange={e => updateSectionTitle(section.id, e.target.value)}
                        placeholder="Section Title (e.g. Multiple Choice Questions)"
                      />
                      <input
                        className="w-full bg-transparent border-none outline-none text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 focus:text-slate-700 dark:focus:text-slate-300 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={section.description || ''}
                        onChange={e => updateSectionDescription(section.id, e.target.value)}
                        placeholder="Optional: instructions or notes for this section — e.g. 'Answer all questions. Each is worth 5 points.'"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 rounded-lg">
                        {section.questions.length} {section.questions.length === 1 ? 'question' : 'questions'}
                      </span>
                      {sections.length > 1 && (
                        <button type="button" onClick={() => removeSection(section.id)}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pl-6 border-l-2 border-indigo-200/60 dark:border-slate-800 space-y-6">
                    {section.questions.length === 0 && (
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
                      const qErrors = validationTriggered
                        ? liveQuestionErrors.filter(err => err.startsWith(`Question ${qN}:`))
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
                            />
                          </ErrorBoundary>
                          <AddBar onAddQuestion={type => addQuestionToSection(section.id, type, qIdx)} />
                        </div>
                      );
                    })}
                  </div>

                  {sIdx === sections.length - 1 && (
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
                  className="h-11 px-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider border border-slate-200 dark:border-slate-700/80 transition-all active:scale-[0.98]"
                >
                  Back
                </button>
              )}

              <button
                type="submit"
                disabled={loading || (step === 2 && !pointsOk && !isPrintable)}
                className={`h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  step === 1
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
                      {step === 1 ? 'Go to Construction' 
                        : step === 2 && isPrintable ? 'Continue to Paper Details'
                        : step === 3 ? (id ? 'Update & Finalize' : 'Publish Exam')
                        : (id ? 'Update Assessment' : 'Broadcast Live')}
                    </span>
                    {step === 3 ? <Printer className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
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
