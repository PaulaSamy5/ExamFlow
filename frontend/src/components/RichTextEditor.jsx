import React, { useRef, useEffect } from 'react';
import { Bold, Italic } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder, className = "" }) => {
  const editorRef = useRef(null);

  // Sync value to editor content if changed externally
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, val = null) => {
    document.execCommand(command, false, val);
    editorRef.current.focus();
    handleInput();
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        execCommand('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        execCommand('italic');
      }
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className={`flex flex-col rounded-xl border border-slate-300 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/60 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800/50">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
      </div>

      {/* Editable Area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          className="p-4 min-h-[120px] outline-none text-sm leading-relaxed text-slate-700 dark:text-slate-200 relative z-10"
        />
        {(!value || value === '' || value === '<br>' || value === '<div><br></div>') && (
          <div className="absolute top-4 left-4 text-slate-400 text-sm pointer-events-none z-0">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};

export default RichTextEditor;
