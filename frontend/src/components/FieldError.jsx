import { AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Inline field error — shown below an invalid input.
 * Animates in when message is truthy, disappears cleanly when cleared.
 */
export const FieldError = ({ message }) => {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
};

/**
 * Inline field success — shown below a valid input when positive feedback is needed.
 */
export const FieldSuccess = ({ message }) => {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-1 duration-200">
      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
};

/** Utility: builds input border/ring class based on error state */
export const inputStateClass = (error) =>
  error
    ? 'border-rose-400 dark:border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20'
    : '';
