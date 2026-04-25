import React, { useEffect, useRef, useState } from 'react';
import { Sigma, CheckCircle2, Trash2, HelpCircle, Layers, Maximize2, Sparkles, ChevronDown } from 'lucide-react';

/**
 * MathRenderer: Purely for displaying LaTeX beautifully using KaTeX.
 */
const MathRenderer = ({ tex, displayMode = false, className = "" }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && window.katex) {
      try {
        window.katex.render(tex || '', containerRef.current, {
          throwOnError: false,
          displayMode: displayMode
        });
      } catch (e) {
        console.error("Katex error:", e);
      }
    }
  }, [tex, displayMode]);

  return <div ref={containerRef} className={className} />;
};

const MathInputField = ({ value, id, updateLine, handleKeyDown }) => {
  const mfRef = useRef(null);

  const lastSentValueRef = useRef(value);

  // Sync value safely without blowing up MathLive's internal shadow DOM
  useEffect(() => {
    const mf = mfRef.current;
    if (mf && value !== undefined && mf.value !== value && value !== lastSentValueRef.current) {
      mf.value = value;
    }
  }, [value]);

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    
    const onInput = (e) => {
      const val = e.target.value;
      lastSentValueRef.current = val;
      if (updateLine) updateLine(id, val);
    };
    
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (handleKeyDown) handleKeyDown({ key: 'Enter', preventDefault: ()=>{}, stopPropagation: ()=>{} }, id);
      } else if (e.key === 'Backspace') {
        // Only trigger special behavior if the field is empty
        if (mf.value === '' && handleKeyDown) {
          handleKeyDown(e, id);
        }
      }
    };
    
    mf.addEventListener('input', onInput);
    mf.addEventListener('keydown', onKey, { capture: true });
    
    // Initial sync
    if (value && mf.value !== value) {
      mf.value = value;
    }
    
    return () => {
      mf.removeEventListener('input', onInput);
      mf.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [id, updateLine, handleKeyDown]); // value omitted to avoid re-binding listeners on every character

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    
    // Minimal Context Menu: Only essential actions
    mf.menuItems = [
      { label: 'Cut', id: 'cut' },
      { label: 'Copy', id: 'copy' },
      { label: 'Paste', id: 'paste' },
      { type: 'divider' },
      { label: 'Select All', id: 'selectAll' }
    ];
  }, []);

  return (
    <div className="math-field-container w-full">
      <math-field 
        ref={mfRef} 
        id={`mf-${id}`}
        math-style="display"
        smart-mode="true"
        style={{ width: '100%', minHeight: '1.75em' }}
      />
    </div>
  );
};

export default function MathEditor({ value, onChange }) {
  const data = typeof value === 'string' ? (() => {
    try { 
      const parsed = JSON.parse(value);
      if (parsed.lines && Array.isArray(parsed.lines)) return parsed;
      return { steps: parsed.steps || '', finalAnswer: parsed.finalAnswer || '', lines: null };
    } catch(e) { 
      return { steps: value, finalAnswer: '', lines: null }; 
    }
  })() : value || { steps: '', finalAnswer: '', lines: null };

  const [lines, setLines] = useState(() => {
    if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) return data.lines;
    const initialSplit = (data.steps || '').split('\n').filter(Boolean);
    const newLines = initialSplit.map((text, i) => ({ id: Date.now() + i, text }));
    if (newLines.length === 0) newLines.push({ id: Date.now(), text: '' });
    return newLines;
  });

  const [finalAnswer, setFinalAnswer] = useState(data.finalAnswer || '');

  // --- Undo/Redo System ---
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const pushToHistory = React.useCallback((currentLines, currentFinal) => {
    const state = JSON.stringify({ lines: currentLines, finalAnswer: currentFinal });
    setHistory(prev => {
      const newHist = prev.slice(0, historyIdx + 1);
      if (newHist[newHist.length - 1] === state) return prev;
      return [...newHist, state].slice(-50); // Keep last 50 steps
    });
    setHistoryIdx(prev => prev + 1);
  }, [historyIdx]);

  const undo = React.useCallback(() => {
    if (historyIdx > 0) {
      const prevState = JSON.parse(history[historyIdx - 1]);
      setLines(prevState.lines);
      setFinalAnswer(prevState.finalAnswer);
      setHistoryIdx(prev => prev - 1);
    }
  }, [history, historyIdx]);

  const redo = React.useCallback(() => {
    if (historyIdx < history.length - 1) {
      const nextState = JSON.parse(history[historyIdx + 1]);
      setLines(nextState.lines);
      setFinalAnswer(nextState.finalAnswer);
      setHistoryIdx(prev => prev + 1);
    }
  }, [history, historyIdx]);

  // Initial history push
  useEffect(() => {
    if (history.length === 0) {
      setHistory([JSON.stringify({ lines, finalAnswer })]);
      setHistoryIdx(0);
    }
  }, []);

  // Global Keydown for Undo/Redo
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [undo, redo]);

  // Compile and sync data backend with DEBOUNCE
  useEffect(() => {
    const timer = setTimeout(() => {
      const stepsString = lines.map(l => l.text).join('\n');
      onChange(JSON.stringify({ 
        steps: stepsString, 
        finalAnswer: finalAnswer,
        lines: lines 
      }));
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [lines, finalAnswer, onChange]);

  const updateLine = React.useCallback((id, newText) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, text: newText } : l));
  }, []);

  // Debounced history push for typing
  useEffect(() => {
    const timer = setTimeout(() => {
      pushToHistory(lines, finalAnswer);
    }, 1000); // Wait 1s of inactivity to push to history
    return () => clearTimeout(timer);
  }, [lines, finalAnswer, pushToHistory]);

  const handleKeyDown = React.useCallback((e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setLines(prev => {
        const idx = prev.findIndex(l => l.id === id);
        if (idx === -1) return prev;
        const newId = Date.now();
        const next = [...prev];
        next.splice(idx + 1, 0, { id: newId, text: '' });
        setTimeout(() => document.getElementById(`mf-${newId}`)?.focus(), 20);
        pushToHistory(next, finalAnswer);
        return next;
      });
    } else if (e.key === 'Backspace') {
      setLines(prev => {
        const idx = prev.findIndex(l => l.id === id);
        if (idx !== -1 && prev[idx].text === '' && prev.length > 1) {
          e.preventDefault();
          const next = prev.filter(l => l.id !== id);
          setTimeout(() => document.getElementById(`mf-${prev[idx - 1].id}`)?.focus(), 20);
          pushToHistory(next, finalAnswer);
          return next;
        }
        return prev;
      });
    }
  }, [finalAnswer, pushToHistory]);

  const insertMathToActive = (cmd) => {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName.toLowerCase() === 'math-field') {
      activeEl.insert(cmd);
      activeEl.focus();
    } else {
      // Default to last line
      const lastId = lines[lines.length - 1].id;
      const mf = document.getElementById(`mf-${lastId}`);
      if (mf) {
        mf.insert(cmd);
        mf.focus();
      }
    }
  };

  return (
    <div className="math-editor-system space-y-4 animate-fade-in">
      <style>{`
        math-field {
          --caret-color: #6366f1;
          --selection-background-color: rgba(99, 102, 241, 0.2);
          --placeholder-color: transparent !important;
          --placeholder-opacity: 0 !important;
          font-size: 1.25rem;
          padding: 4px 16px;
          border: none;
          background: transparent;
          color: inherit;
        }
        math-field::part(placeholder) {
          border: none !important;
          background: transparent !important;
          color: transparent !important;
          opacity: 0 !important;
        }
        math-field:focus-within { outline: none; }
        .math-field-container { transition: all 0.2s ease; }
        math-field::part(virtual-keyboard-toggle) { display: none; }
      `}</style>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg">
             <Layers className="h-4 w-4 text-indigo-500" />
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Natural Math Workspace</h3>
        </div>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Normal Text Actions • Real Math Formatting</span>
      </div>

      <div className="relative bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden focus-within:border-indigo-500/40 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col">
        
        {/* Solution Workspace (Steps) - Real WYSIWYG Multiline Feel */}
        <div 
          className="flex flex-col min-h-[220px] p-4 cursor-text"
          onClick={(e) => {
            if (e.target === e.currentTarget && document.activeElement?.tagName.toLowerCase() !== 'math-field') {
              document.getElementById(`mf-${lines[lines.length - 1].id}`)?.focus();
            }
          }}
        >
          {lines.map((line) => (
             <div key={line.id} className="relative group transition-colors rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 my-0.5">
                <MathInputField 
                  id={line.id} // Pass raw number ID to match perfectly in handleKeyDown
                  value={line.text}
                  updateLine={updateLine}
                  handleKeyDown={handleKeyDown}
                />
             </div>
          ))}
        </div>

        {/* Embedded Dedicated Final Answer Input */}
        <div className="bg-amber-500/[0.04] border-t border-amber-500/20 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors focus-within:bg-amber-500/[0.08]">
           <div className="flex items-center gap-2 shrink-0">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest mt-0.5">Final Result:</span>
           </div>
           <div className="flex-1 bg-white dark:bg-slate-900 border border-amber-500/30 shadow-inner rounded-xl px-2">
              <MathInputField 
                 id="final-answer"
                 value={finalAnswer}
                 updateLine={(_, val) => setFinalAnswer(val)}
                 handleKeyDown={(e) => {
                   // Allow standard backspace/delete in final answer
                   if (e.key === 'Backspace' || e.key === 'Delete') {
                     return; // Let MathLive handle it
                   }
                 }} 
              />
           </div>
        </div>

        {/* Unified Toolbar Segment */}
        <div className="bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/5 p-3 flex flex-wrap gap-2 items-center z-10 shrink-0">
           {[
             { label: 'Fraction', cmd: '\\frac{#@}{#?}', icon: '÷' },
             { label: 'Power', cmd: '#@^{#?}', icon: 'xⁿ' },
             { label: 'Root', cmd: '\\sqrt{#@}', icon: '√' },
             { label: 'Subscript', cmd: '#@_{#?}', icon: 'xₙ' },
             { label: 'Sum', cmd: '\\sum_{#?}^{#?}', icon: 'Σ' },
             { label: 'Integral', cmd: '\\int_{#?}^{#?}', icon: '∫' },
             { label: 'Group', cmd: '(#@)', icon: '( )' },
           ].map(tool => (
             <button
               key={tool.label}
               type="button"
               onClick={(e) => { e.stopPropagation(); insertMathToActive(tool.cmd); }}
               className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-500 transition-all shadow-sm active:scale-95"
             >
               {tool.icon} <span className="ml-1 opacity-50 hidden sm:inline">{tool.label}</span>
             </button>
           ))}
           
           <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />
           <button
             type="button"
             onClick={(e) => {
               e.stopPropagation();
               setLines([{ id: Date.now(), text: '' }]);
               setFinalAnswer('');
             }}
             className="p-2 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
             title="Clear Entire Workspace"
           >
             <Trash2 className="h-4 w-4" />
           </button>
        </div>
      </div>

      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-4">
         <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
         <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-1">Standard Text Experience</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              You are now using a <strong>Natural Text Editor</strong>! Press <kbd className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-500 font-bold">Enter</kbd> to move lines exactly like Word or Notepad, and press <kbd className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-500 font-bold">Space</kbd> normally. Any mathematical equations you write (or insert from the buttons below) will instantly render beautifully in-line!
            </p>
         </div>
      </div>
    </div>
  );
}
