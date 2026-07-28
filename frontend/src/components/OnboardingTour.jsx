import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../store/TourContext';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const SPOTLIGHT_PADDING  = 12;
const TOOLTIP_OFFSET     = 20;
const TOOLTIP_WIDTH      = 340;
const ELEMENT_WAIT_MAX   = 6000;   // ms to wait for element to appear
const SCROLL_STABLE_FRAMES = 8;    // consecutive stable frames = scroll done
const SCROLL_HARD_TIMEOUT  = 1600; // ms hard cap for scroll+settle

// ─── Scroll-key set (Space, PgUp, PgDn, Home, End, Arrow ↑↓) ────────────────
const SCROLL_KEYS = new Set([32, 33, 34, 35, 36, 38, 40]);

// ─── Prevent any user-initiated wheel / touch / keyboard scroll ──────────────
function lockUserScroll(e) {
  e.preventDefault();
}
function lockScrollKeys(e) {
  // Allow normal typing in form elements
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag)) return;
  if (SCROLL_KEYS.has(e.keyCode)) e.preventDefault();
}

// ─── Wait for a selector to appear (MutationObserver + hard timeout) ─────────
function waitForElement(selector, callback) {
  if (!selector) { callback(null); return () => {}; }

  let done = false;
  const finish = (el) => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(timeout);
    callback(el);
  };

  const check = () => {
    const el = document.querySelector(selector);
    if (el) { finish(el); return true; }
    return false;
  };

  if (check()) return () => { done = true; };

  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  const timeout = setTimeout(() => {
    observer.disconnect();
    if (!done) { done = true; callback(document.querySelector(selector)); }
  }, ELEMENT_WAIT_MAX);

  return () => { done = true; observer.disconnect(); clearTimeout(timeout); };
}

// ─── Tour-controlled scroll: scrolls el into view then waits until
//     its bounding rect has been stable for SCROLL_STABLE_FRAMES frames ───────
function scrollIntoViewAndWait(el) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const fullyVisible =
      r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    if (fullyVisible) {
      setTimeout(resolve, 100);
      return;
    }

    let stableFrames = 0;
    let prevTop      = null;
    let cancelled    = false;

    const hardStop = setTimeout(() => { cancelled = true; resolve(); }, SCROLL_HARD_TIMEOUT);

    const poll = () => {
      if (cancelled) return;
      const rect = el.getBoundingClientRect();
      if (prevTop !== null && Math.abs(rect.top - prevTop) < 0.5) {
        if (++stableFrames >= SCROLL_STABLE_FRAMES) {
          clearTimeout(hardStop);
          resolve();
          return;
        }
      } else {
        stableFrames = 0;
      }
      prevTop = rect.top;
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

// ─── Tooltip position: side-by-side on desktop, above/below on mobile ────────
function computeTooltipPos(rect, vw, vh) {
  if (!rect) return { top: vh / 2 - 100, left: vw / 2 - TOOLTIP_WIDTH / 2 };
  const tooltipH = 230;

  if (vw >= 800) {
    if (rect.x + rect.width / 2 < vw / 2) {
      const left = rect.x + rect.width + TOOLTIP_OFFSET;
      if (left + TOOLTIP_WIDTH < vw - 16) {
        return { top: Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16)), left };
      }
    } else {
      const left = rect.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
      if (left > 16) {
        return { top: Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16)), left };
      }
    }
  }

  const leftIdeal = rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2;
  const left      = Math.max(16, Math.min(leftIdeal, vw - TOOLTIP_WIDTH - 16));
  const below     = rect.y + rect.height + SPOTLIGHT_PADDING + TOOLTIP_OFFSET;
  const above     = rect.y - SPOTLIGHT_PADDING - TOOLTIP_OFFSET - tooltipH;

  if (below + tooltipH < vh) return { top: below, left };
  if (above > 0)             return { top: above, left };
  return { top: vh / 2 - tooltipH / 2, left };
}

// ═════════════════════════════════════════════════════════════════════════════
const OnboardingTour = () => {
  const {
    isActive, currentStep, currentStepIndex, totalSteps,
    nextStep, prevStep, skipTour, completeTour
  } = useTour();

  const [spotRect,         setSpotRect]         = useState(null);
  const [tooltipPos,       setTooltipPos]        = useState({ top: 0, left: 0 });
  const [isTransitioning,  setIsTransitioning]   = useState(false);
  const [actionDone,       setActionDone]        = useState(false);
  const [canProceed,       setCanProceed]        = useState(true);
  const [isOptionalFilled, setIsOptionalFilled]  = useState(false);

  const cancelWaitRef = useRef(null);
  const stepGenRef    = useRef(0);        // stale-check counter

  // Settled scroll position refs to lock/restore position if user scrolls
  const settledScrollTopRef  = useRef(0);
  const settledScrollLeftRef = useRef(0);

  const isLastStep        = currentStepIndex === totalSteps - 1;
  const isWelcomeOrFinish = !currentStep?.selector;

  // ── Global scroll lock (tour owns scrolling, user cannot scroll) ────────────
  useEffect(() => {
    if (!isActive) return;

    // Reset/lock scroll event handler
    const handleScroll = (e) => {
      if (isTransitioning) return; // let programmatic smooth scroll run
      
      // Force scroll positions back to settled values
      window.scrollTo(settledScrollLeftRef.current, settledScrollTopRef.current);
      if (document.documentElement) {
        document.documentElement.scrollTop = settledScrollTopRef.current;
        document.documentElement.scrollLeft = settledScrollLeftRef.current;
      }
      if (document.body) {
        document.body.scrollTop = settledScrollTopRef.current;
        document.body.scrollLeft = settledScrollLeftRef.current;
      }
    };

    window.addEventListener('wheel',     lockUserScroll,  { passive: false });
    window.addEventListener('touchmove', lockUserScroll,  { passive: false });
    window.addEventListener('keydown',   lockScrollKeys,  { passive: false });
    window.addEventListener('scroll',    handleScroll,    { passive: false });
    
    return () => {
      window.removeEventListener('wheel',     lockUserScroll);
      window.removeEventListener('touchmove', lockUserScroll);
      window.removeEventListener('keydown',   lockScrollKeys);
      window.removeEventListener('scroll',    handleScroll);
    };
  }, [isActive, isTransitioning]);

  // ── Core: run on every step change ─────────────────────────────────────────
  // Pipeline:
  //   1. Cancel previous wait
  //   2. Hide spotlight (isTransitioning = true)
  //   3. Wait for element to exist in DOM
  //   4. Scroll element into view + wait for scroll to settle
  //   5. Compute spotlight rect from settled position
  //   6. Capture settled scroll positions
  //   7. Reveal (isTransitioning = false) → RAF loop takes over tracking
  const updateSpotlight = useCallback(async () => {
    if (!isActive || !currentStep) return;

    const gen   = ++stepGenRef.current;
    const stale = () => gen !== stepGenRef.current;

    // Cancel any previous outstanding wait
    if (cancelWaitRef.current) { cancelWaitRef.current(); cancelWaitRef.current = null; }

    // Hide while transitioning
    setIsTransitioning(true);
    setSpotRect(null);
    setActionDone(false);
    setCanProceed(true);
    setIsOptionalFilled(false);

    // ── Centre-screen step (welcome / finish) ──────────────────────────────
    if (!currentStep.selector) {
      if (stale()) return;
      setTooltipPos({
        top:  window.innerHeight / 2 - 110,
        left: window.innerWidth  / 2 - TOOLTIP_WIDTH / 2,
      });
      setTimeout(() => { if (!stale()) setIsTransitioning(false); }, 200);
      return;
    }

    // ── 1. Locate element (wait for it if not yet rendered) ────────────────
    let el = document.querySelector(currentStep.selector);
    if (!el) {
      await new Promise((resolve) => {
        const cancel = waitForElement(currentStep.selector, (found) => {
          el = found;
          resolve();
        });
        cancelWaitRef.current = cancel;
      });
      cancelWaitRef.current = null;
    }
    if (stale()) return;

    if (!el) {
      // Element never appeared → show tooltip centred
      setTooltipPos({
        top:  window.innerHeight / 2 - 110,
        left: window.innerWidth  / 2 - TOOLTIP_WIDTH / 2,
      });
      setIsTransitioning(false);
      return;
    }

    // ── 2. Scroll element into view and wait until settled ──────────────────
    await scrollIntoViewAndWait(el);
    if (stale()) return;

    // ── 3. Compute spotlight from the settled viewport position ─────────────
    const r        = el.getBoundingClientRect();
    const nextRect = {
      x:      r.left   - SPOTLIGHT_PADDING,
      y:      r.top    - SPOTLIGHT_PADDING,
      width:  r.width  + SPOTLIGHT_PADDING * 2,
      height: r.height + SPOTLIGHT_PADDING * 2,
    };
    setSpotRect(nextRect);
    setTooltipPos(computeTooltipPos(nextRect, window.innerWidth, window.innerHeight));

    // ── 4. Record settled scroll positions ──────────────────────────────────
    settledScrollTopRef.current = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    settledScrollLeftRef.current = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft;

    // ── 5. Reveal ──────────────────────────────────────────────────────────
    setIsTransitioning(false);
  }, [isActive, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateSpotlight();
  }, [currentStepIndex, updateSpotlight]);

  // ── Continuous RAF tracking loop (only runs after scroll settled) ───────────
  // Keeps the spotlight glued to the element while it resizes, animates, etc.
  useEffect(() => {
    if (!isActive || isTransitioning) return;
    let active = true;

    const loop = () => {
      if (!active) return;

      if (!currentStep?.selector) {
        setSpotRect(null);
        setTooltipPos({
          top:  window.innerHeight / 2 - 110,
          left: window.innerWidth  / 2 - TOOLTIP_WIDTH / 2,
        });
      } else {
        const el = document.querySelector(currentStep.selector);
        if (el) {
          const r   = el.getBoundingClientRect();
          let rect  = {
            x:      r.left   - SPOTLIGHT_PADDING,
            y:      r.top    - SPOTLIGHT_PADDING,
            width:  r.width  + SPOTLIGHT_PADDING * 2,
            height: r.height + SPOTLIGHT_PADDING * 2,
          };

          // Expand to include any open date/time picker dropdown
          const dd = el.querySelector('.tour-picker-dropdown');
          if (dd) {
            const dr = dd.getBoundingClientRect();
            rect = {
              x:      Math.min(rect.x,              dr.left   - SPOTLIGHT_PADDING),
              y:      Math.min(rect.y,              dr.top    - SPOTLIGHT_PADDING),
              width:  Math.max(rect.x + rect.width, dr.right  + SPOTLIGHT_PADDING) - Math.min(rect.x, dr.left - SPOTLIGHT_PADDING),
              height: Math.max(rect.y + rect.height,dr.bottom + SPOTLIGHT_PADDING) - Math.min(rect.y, dr.top  - SPOTLIGHT_PADDING),
            };
          }

          setSpotRect(prev => {
            if (!prev ||
                Math.abs(prev.x      - rect.x)      > 0.5 ||
                Math.abs(prev.y      - rect.y)      > 0.5 ||
                Math.abs(prev.width  - rect.width)  > 0.5 ||
                Math.abs(prev.height - rect.height) > 0.5) {
              setTooltipPos(computeTooltipPos(rect, window.innerWidth, window.innerHeight));
              return rect;
            }
            return prev;
          });
        } else {
          setSpotRect(null);
        }
      }

      // Poll canAdvance
      if (typeof currentStep?.canAdvance === 'function') {
        const ok = currentStep.canAdvance();
        setCanProceed(prev => prev !== ok ? ok : prev);
      } else {
        setCanProceed(true);
      }

      // Poll optional fill
      if (currentStep?.isOptional && typeof currentStep.checkOptionalFilled === 'function') {
        const filled = currentStep.checkOptionalFilled();
        setIsOptionalFilled(prev => prev !== filled ? filled : prev);
      } else {
        setIsOptionalFilled(false);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => { active = false; };
  }, [isActive, isTransitioning, currentStep, currentStepIndex]);

  // ── Block clicks on specific selectors (e.g. Create Exam btn during overview)
  useEffect(() => {
    if (!isActive || !currentStep?.blockSelectors?.length) return;
    const s = document.createElement('style');
    s.id = 'tour-block-selectors-style';
    s.innerHTML = `${currentStep.blockSelectors.join(', ')} { pointer-events: none !important; opacity: 0.65; cursor: not-allowed !important; }`;
    document.head.appendChild(s);
    return () => { if (s.parentNode) s.parentNode.removeChild(s); };
  }, [isActive, currentStep, currentStepIndex]);

  // ── Action steps: auto-advance when user clicks highlighted element ─────────
  useEffect(() => {
    if (!isActive || !currentStep?.requiresAction || !currentStep?.selector || actionDone) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) return;
    const handle = () => {
      setActionDone(true);
      setTimeout(() => nextStep(), 400);
    };
    el.addEventListener('click', handle, { once: true });
    return () => el.removeEventListener('click', handle);
  }, [isActive, currentStep, actionDone, nextStep]);

  if (!isActive) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Last step: full-screen celebration ─────────────────────────────────────
  if (isLastStep && isWelcomeOrFinish) {
    return createPortal(
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ pointerEvents: 'all' }}>
        <div className="absolute inset-0 bg-[rgba(10,14,30,0.8)] backdrop-blur-sm" />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute rounded-full animate-bounce" style={{
              width:  Math.random() * 8 + 4,
              height: Math.random() * 8 + 4,
              left:   `${Math.random() * 100}%`,
              top:    `${Math.random() * 100}%`,
              background: ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899'][Math.floor(Math.random() * 6)],
              animationDelay:    `${Math.random() * 2}s`,
              animationDuration: `${1.5 + Math.random() * 2}s`,
              opacity: 0.7,
            }} />
          ))}
        </div>

        <div className="relative z-10 bg-white dark:bg-[#0f1729] border border-slate-200/80 dark:border-indigo-500/20 rounded-3xl shadow-2xl shadow-indigo-500/20 p-8 max-w-sm w-full text-center animate-in zoom-in-90 fade-in duration-500">
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
            <svg viewBox="0 0 52 52" className="w-10 h-10" fill="none">
              <circle cx="26" cy="26" r="25" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M14 27l8 8 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                className="[stroke-dasharray:50] [stroke-dashoffset:50] animate-[drawCheck_0.6s_0.3s_ease-out_forwards]" />
            </svg>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">🎉 You're All Set!</h2>
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

  // ── Main overlay ────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[9990] pointer-events-none">

      {/* 4-panel backdrop with spotlight cut-out */}
      {!spotRect ? (
        <div className="absolute inset-0 bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto" />
      ) : (
        <>
          <div className="absolute left-0 top-0 w-full bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
               style={{ height: Math.max(0, spotRect.y) }} />
          <div className="absolute left-0 w-full bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
               style={{ top: spotRect.y + spotRect.height, height: Math.max(0, vh - (spotRect.y + spotRect.height)) }} />
          <div className="absolute left-0 bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
               style={{ top: spotRect.y, height: spotRect.height, width: Math.max(0, spotRect.x) }} />
          <div className="absolute bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
               style={{ top: spotRect.y, left: spotRect.x + spotRect.width, height: spotRect.height, width: Math.max(0, vw - (spotRect.x + spotRect.width)) }} />

          {/* Spotlight ring */}
          <div className="absolute border-2 border-indigo-500/60 rounded-2xl pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
               style={{ left: spotRect.x, top: spotRect.y, width: spotRect.width, height: spotRect.height }} />
        </>
      )}

      {/* Tooltip card */}
      <div
        id="tour-tooltip-card"
        className={`absolute pointer-events-auto transition-all duration-300 ${
          isTransitioning ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'
        }`}
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: TOOLTIP_WIDTH, zIndex: 9999 }}
      >
        {/* Glow ring */}
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-indigo-500/40 via-violet-500/20 to-indigo-500/40 blur-[2px]" />

        <div className="relative rounded-[26px] overflow-hidden bg-[#0b0f1e]/95 backdrop-blur-2xl border border-white/[0.07] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7),0_0_0_1px_rgba(99,102,241,0.12)]">
          {/* Top strip */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Progress bar */}
          <div className="h-[2px] bg-white/5 w-full">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400 transition-all duration-700 ease-out"
                 style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }} />
          </div>

          <div className="p-5 relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-600 opacity-30 blur-sm -z-10" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
                  Step {currentStepIndex + 1} / {totalSteps}
                </p>
              </div>
              <button onClick={skipTour}
                className="h-7 w-7 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                title="Skip tour">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <h3 className="text-[15px] font-extrabold text-white mb-1.5 leading-snug tracking-tight">
              {currentStep?.title}
            </h3>
            <p className="text-[12.5px] text-slate-400 leading-relaxed mb-4">
              {currentStep?.description}
            </p>

            {/* Action hint */}
            {currentStep?.requiresAction && !actionDone && (
              <div className="mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                <p className="text-[11.5px] font-semibold text-indigo-300">Click the highlighted element to continue</p>
              </div>
            )}

            {/* canAdvance blocker */}
            {currentStep?.canAdvance && !canProceed && (
              <div className="mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <p className="text-[11.5px] font-semibold text-amber-300">
                  {currentStep.blockedHelperText ?? 'Complete the action above to continue.'}
                </p>
              </div>
            )}

            <div className="h-px bg-white/5 mb-4" />

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-400 ${
                    i === currentStepIndex ? 'w-4 h-1.5 bg-indigo-400'
                    : i < currentStepIndex ? 'w-1.5 h-1.5 bg-indigo-700'
                    : 'w-1.5 h-1.5 bg-white/10'
                  }`} />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button onClick={prevStep}
                    className="h-8 px-3.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/8 flex items-center gap-1 transition-all border border-white/5 hover:border-white/10">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}

                {((!currentStep?.requiresAction || actionDone) && canProceed) ? (
                  <button
                    onClick={isLastStep ? completeTour : nextStep}
                    className="relative h-8 px-4 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 transition-all active:scale-95 overflow-hidden group"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
                  >
                    <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-200 rounded-xl" />
                    <span className="relative">
                      {isLastStep
                        ? '🎉 Finish'
                        : (currentStep?.isOptional && !isOptionalFilled) ? 'Skip' : 'Next'}
                    </span>
                    {!isLastStep && <ChevronRight className="h-3.5 w-3.5 relative" />}
                  </button>
                ) : (
                  <button disabled
                    className="h-8 px-4 rounded-xl text-[11px] font-bold text-white/30 bg-white/5 border border-white/5 flex items-center gap-1.5 cursor-not-allowed">
                    Next <ChevronRight className="h-3.5 w-3.5" />
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
