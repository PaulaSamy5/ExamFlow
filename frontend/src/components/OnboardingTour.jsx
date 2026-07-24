import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../store/TourContext';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

// Padding around the spotlight rectangle
const SPOTLIGHT_PADDING = 12;
const TOOLTIP_OFFSET = 20;
const TOOLTIP_WIDTH = 340;
const ELEMENT_WAIT_MAX = 5000;
const ELEMENT_WAIT_INTERVAL = 100;

/**
 * Smoothly scrolls the target element into view if it's outside the viewport.
 */
function scrollIntoViewIfNeeded(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const isVisible =
    rect.top >= 0 && rect.bottom <= vh &&
    rect.left >= 0 && rect.right <= vw;
  if (!isVisible) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

/**
 * Polls the DOM for an element matching the given selector, up to ELEMENT_WAIT_MAX ms.
 */
function waitForElement(selector, callback) {
  if (!selector) { callback(null); return; }
  let elapsed = 0;
  const timer = setInterval(() => {
    const el = document.querySelector(selector);
    if (el) { clearInterval(timer); callback(el); }
    else if ((elapsed += ELEMENT_WAIT_INTERVAL) >= ELEMENT_WAIT_MAX) {
      clearInterval(timer);
      callback(null);
    }
  }, ELEMENT_WAIT_INTERVAL);
  return () => clearInterval(timer);
}

/**
 * Compute the tooltip position so it stays within the viewport.
 * Prefers side-positioning (left/right) on desktop screens to avoid covering controls.
 */
function computeTooltipPos(rect, vw, vh) {
  if (!rect) return { top: vh / 2 - 100, left: vw / 2 - TOOLTIP_WIDTH / 2 };

  const tooltipH = 220; // estimated
  const isDesktop = vw >= 800;

  if (isDesktop) {
    // If target is on the left half of screen, place tooltip on the right
    if (rect.x + rect.width / 2 < vw / 2) {
      const left = rect.x + rect.width + TOOLTIP_OFFSET;
      if (left + TOOLTIP_WIDTH < vw - 16) {
        const top = Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16));
        return { top, left };
      }
    }
    // If target is on the right half, place tooltip on the left
    else {
      const left = rect.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
      if (left > 16) {
        const top = Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16));
        return { top, left };
      }
    }
  }

  // Fallback for mobile / narrow spaces: below or above
  const spotBottom = rect.y + rect.height + SPOTLIGHT_PADDING;
  const spotTop    = rect.y - SPOTLIGHT_PADDING;
  const leftIdeal  = rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2;
  const left       = Math.max(16, Math.min(leftIdeal, vw - TOOLTIP_WIDTH - 16));

  if (spotBottom + TOOLTIP_OFFSET + tooltipH < vh) {
    return { top: spotBottom + TOOLTIP_OFFSET, left };
  }
  if (spotTop - TOOLTIP_OFFSET - tooltipH > 0) {
    return { top: spotTop - TOOLTIP_OFFSET - tooltipH, left };
  }
  return { top: vh / 2 - tooltipH / 2, left };
}

const OnboardingTour = () => {
  const {
    isActive, currentStep, currentStepIndex, totalSteps,
    nextStep, prevStep, skipTour, completeTour
  } = useTour();

  const [spotRect, setSpotRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [canProceed, setCanProceed] = useState(true);
  const cancelWaitRef = useRef(null);

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isWelcomeOrFinish = !currentStep?.selector;

  // Locate the target element and handle page transitions
  const updateSpotlight = useCallback(() => {
    if (!isActive || !currentStep) return;

    setIsTransitioning(true);
    setActionDone(false);
    setCanProceed(true); // will be corrected by the RAF poll immediately

    if (cancelWaitRef.current) cancelWaitRef.current();

    if (!currentStep.selector) {
      // Centre-screen step (welcome / finish)
      setSpotRect(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 110,
        left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
      });
      setTimeout(() => setIsTransitioning(false), 200);
      return;
    }

    const el = document.querySelector(currentStep.selector);
    if (!el) {
      const cancel = waitForElement(currentStep.selector, (foundEl) => {
        if (!foundEl) {
          setSpotRect(null);
          setTooltipPos({
            top: window.innerHeight / 2 - 110,
            left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
          });
          setIsTransitioning(false);
          return;
        }
        scrollIntoViewIfNeeded(foundEl);
        setIsTransitioning(false);
      });
      cancelWaitRef.current = cancel;
      return;
    }

    // Element exists immediately
    scrollIntoViewIfNeeded(el);
    setIsTransitioning(false);
  }, [isActive, currentStep]);

  // Re-locate when the active step changes
  useEffect(() => {
    updateSpotlight();
  }, [currentStepIndex, updateSpotlight]);

  // Continuous real-time coordinate tracking loop
  useEffect(() => {
    if (!isActive) return;

    let active = true;
    const updateLoop = () => {
      if (!active) return;

      if (!currentStep?.selector) {
        setSpotRect(null);
        setTooltipPos({
          top: window.innerHeight / 2 - 110,
          left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
        });
      } else {
        const el = document.querySelector(currentStep.selector);
        if (el) {
          const r = el.getBoundingClientRect();
          const nextRect = {
            x: r.left - SPOTLIGHT_PADDING,
            y: r.top  - SPOTLIGHT_PADDING,
            width:  r.width  + SPOTLIGHT_PADDING * 2,
            height: r.height + SPOTLIGHT_PADDING * 2,
          };

          setSpotRect(prev => {
            // Check if coordinates changed significantly to avoid infinite state updates
            if (!prev || 
                Math.abs(prev.x - nextRect.x) > 0.5 || 
                Math.abs(prev.y - nextRect.y) > 0.5 || 
                Math.abs(prev.width - nextRect.width) > 0.5 || 
                Math.abs(prev.height - nextRect.height) > 0.5) {
              
              setTooltipPos(computeTooltipPos(nextRect, window.innerWidth, window.innerHeight));
              return nextRect;
            }
            return prev;
          });
        } else {
          // Element temporarily missing (e.g. during page render)
          setSpotRect(null);
          setTooltipPos({
            top: window.innerHeight / 2 - 110,
            left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
          });
        }
      }

      // Poll canAdvance if the step defines one
      if (typeof currentStep?.canAdvance === 'function') {
        const allowed = currentStep.canAdvance();
        setCanProceed(prev => prev !== allowed ? allowed : prev);
      } else {
        setCanProceed(true);
      }

      requestAnimationFrame(updateLoop);
    };

    requestAnimationFrame(updateLoop);
    return () => {
      active = false;
    };
  }, [isActive, currentStep, currentStepIndex]);

  // Prevent body scroll only if not in an interactive step
  useEffect(() => {
    if (isActive && !currentStep?.requiresAction) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isActive, currentStep]);

  // Listen for "action" steps: if the selector element is clicked, auto-advance
  useEffect(() => {
    if (!isActive || !currentStep?.requiresAction || !currentStep?.selector || actionDone) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) return;

    const handleClick = () => {
      setActionDone(true);
      // Small delay so the click registers on the page, then advance
      setTimeout(() => nextStep(), 400);
    };
    el.addEventListener('click', handleClick, { once: true });
    return () => el.removeEventListener('click', handleClick);
  }, [isActive, currentStep, actionDone, nextStep]);

  if (!isActive) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Full-screen celebration card for the finish step
  if (isLastStep && isWelcomeOrFinish) {
    return createPortal(
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ pointerEvents: 'all' }}>
        {/* Dimmed backdrop */}
        <div className="absolute inset-0 bg-[rgba(10,14,30,0.8)] backdrop-blur-sm" />

        {/* Confetti particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-bounce"
              style={{
                width: Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899'][Math.floor(Math.random() * 6)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        {/* Finish card */}
        <div className="relative z-10 bg-white dark:bg-[#0f1729] border border-slate-200/80 dark:border-indigo-500/20 rounded-3xl shadow-2xl shadow-indigo-500/20 p-8 max-w-sm w-full text-center animate-in zoom-in-90 fade-in duration-500">
          {/* Animated checkmark */}
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-in zoom-in duration-700 delay-150">
            <svg viewBox="0 0 52 52" className="w-10 h-10" fill="none">
              <circle cx="26" cy="26" r="25" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M14 27l8 8 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                className="[stroke-dasharray:50] [stroke-dashoffset:50] animate-[drawCheck_0.6s_0.3s_ease-out_forwards]"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
            🎉 You're All Set!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            Welcome aboard! You now know everything you need to run seamless, professional exams on ExamFlow.
          </p>

          <button
            onClick={completeTour}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Start Building Exams
          </button>

          {/* Progress indicator */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // SVG mask spotlight path (full rect minus the cutout)
  const svgMask = spotRect
    ? `M0,0 H${vw} V${vh} H0 Z M${spotRect.x},${spotRect.y} H${spotRect.x + spotRect.width} V${spotRect.y + spotRect.height} H${spotRect.x} Z`
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] pointer-events-none"
    >
      {/* Backdrops / Blocker Panels */}
      {!spotRect ? (
        // Full screen cover if no spotlight
        <div
          className="absolute inset-0 bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto"
        />
      ) : (
        <>
          {/* Top Panel */}
          <div
            className="absolute left-0 top-0 w-full bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{ height: Math.max(0, spotRect.y) }}
          />
          {/* Bottom Panel */}
          <div
            className="absolute left-0 w-full bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{
              top: spotRect.y + spotRect.height,
              height: Math.max(0, vh - (spotRect.y + spotRect.height))
            }}
          />
          {/* Left Panel */}
          <div
            className="absolute left-0 bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{
              top: spotRect.y,
              height: spotRect.height,
              width: Math.max(0, spotRect.x)
            }}
          />
          {/* Right Panel */}
          <div
            className="absolute bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{
              top: spotRect.y,
              left: spotRect.x + spotRect.width,
              height: spotRect.height,
              width: Math.max(0, vw - (spotRect.x + spotRect.width))
            }}
          />

          {/* Spotlight Highlight Ring */}
          <div
            className="absolute border-2 border-indigo-500/60 rounded-2xl pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            style={{
              left: spotRect.x,
              top: spotRect.y,
              width: spotRect.width,
              height: spotRect.height
            }}
          />
        </>
      )}

      {/* Tour Tooltip Card */}
      <div
        id="tour-tooltip-card"
        className={`absolute transition-all duration-400 pointer-events-auto ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_WIDTH,
          zIndex: 9999,
        }}
      >
        <div className="bg-white dark:bg-[#0f1729] border border-slate-200/80 dark:border-indigo-500/20 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden backdrop-blur-xl">
          
          {/* Progress bar */}
          <div className="h-[3px] bg-slate-100 dark:bg-slate-800/80 w-full">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
              style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-500 dark:text-indigo-400">
                    Step {currentStepIndex + 1} of {totalSteps}
                  </p>
                </div>
              </div>
              <button
                onClick={skipTour}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Skip tour"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 leading-snug">
              {currentStep?.title}
            </h3>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
              {currentStep?.description}
            </p>

            {/* Action hint for interactive steps (requiresAction = click-to-advance) */}
            {currentStep?.requiresAction && !actionDone && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
                  Perform the action above to continue
                </p>
              </div>
            )}

            {/* canAdvance gate — shows helper text while blocked */}
            {currentStep?.canAdvance && !canProceed && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                  {currentStep.blockedHelperText ?? 'Complete the action above to continue.'}
                </p>
              </div>
            )}

            {/* Footer: nav buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === currentStepIndex
                        ? 'w-5 h-1.5 bg-indigo-500'
                        : i < currentStepIndex
                        ? 'w-1.5 h-1.5 bg-indigo-300 dark:bg-indigo-700'
                        : 'w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    onClick={prevStep}
                    className="h-8 px-3 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}

                {/* Next / Finish — blocked when requiresAction or canAdvance not met */}
                {((!currentStep?.requiresAction || actionDone) && canProceed) ? (
                  <button
                    onClick={isLastStep ? completeTour : nextStep}
                    className="h-8 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/25 active:scale-95"
                  >
                    {isLastStep ? 'Finish' : 'Next'}
                    {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <button
                    disabled
                    className="h-8 px-4 rounded-xl text-xs font-bold text-white bg-indigo-300 dark:bg-indigo-800 flex items-center gap-1.5 cursor-not-allowed opacity-60"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;
