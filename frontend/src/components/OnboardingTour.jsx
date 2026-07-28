import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../store/TourContext';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

// Padding around the spotlight rectangle
const SPOTLIGHT_PADDING = 12;
const TOOLTIP_OFFSET    = 20;
const TOOLTIP_WIDTH     = 340;
// Max ms to wait for the target element to appear in the DOM
const ELEMENT_WAIT_MAX  = 6000;

/**
 * Wait for `selector` to appear in the DOM.
 * Returns a cancel function.
 */
function waitForElement(selector, callback) {
  if (!selector) { callback(null); return () => {}; }

  // First try a MutationObserver for instant detection
  let done = false;
  const finish = (el) => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(timeoutId);
    callback(el);
  };

  const check = () => {
    const el = document.querySelector(selector);
    if (el) finish(el);
    return el;
  };

  // Immediate check
  if (check()) return () => { done = true; };

  const observer = new MutationObserver(() => { check(); });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // Fallback timeout
  const timeoutId = setTimeout(() => {
    observer.disconnect();
    if (!done) { done = true; callback(document.querySelector(selector)); }
  }, ELEMENT_WAIT_MAX);

  return () => {
    done = true;
    observer.disconnect();
    clearTimeout(timeoutId);
  };
}

/**
 * Smoothly scroll element to the center of the viewport,
 * then resolve only when the element is fully visible (scroll settled).
 * Uses a rAF loop that checks the rect until stable for ~5 consecutive frames.
 */
function scrollAndWait(el) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const fullyVisible =
      r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;

    if (fullyVisible) { resolve(); return; }

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // Poll until the element's viewport position is stable (scroll has stopped)
    let stableFrames = 0;
    let prevTop = null;
    let cancelled = false;
    const STABLE_NEEDED = 6; // frames with no change → scroll settled

    const poll = () => {
      if (cancelled) return;
      const rect = el.getBoundingClientRect();
      if (prevTop !== null && Math.abs(rect.top - prevTop) < 0.5) {
        stableFrames++;
        if (stableFrames >= STABLE_NEEDED) { resolve(); return; }
      } else {
        stableFrames = 0;
      }
      prevTop = rect.top;
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);

    // Hard timeout so we never hang
    setTimeout(() => { cancelled = true; resolve(); }, 1200);
  });
}

/**
 * Compute the tooltip position so it stays within the viewport.
 * Prefers side-positioning (left/right) on desktop screens.
 */
function computeTooltipPos(rect, vw, vh) {
  if (!rect) return { top: vh / 2 - 100, left: vw / 2 - TOOLTIP_WIDTH / 2 };

  const tooltipH = 220;
  const isDesktop = vw >= 800;

  if (isDesktop) {
    if (rect.x + rect.width / 2 < vw / 2) {
      const left = rect.x + rect.width + TOOLTIP_OFFSET;
      if (left + TOOLTIP_WIDTH < vw - 16) {
        const top = Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16));
        return { top, left };
      }
    } else {
      const left = rect.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
      if (left > 16) {
        const top = Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16));
        return { top, left };
      }
    }
  }

  const spotBottom = rect.y + rect.height + SPOTLIGHT_PADDING;
  const spotTop    = rect.y - SPOTLIGHT_PADDING;
  const leftIdeal  = rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2;
  const left       = Math.max(16, Math.min(leftIdeal, vw - TOOLTIP_WIDTH - 16));

  if (spotBottom + TOOLTIP_OFFSET + tooltipH < vh) return { top: spotBottom + TOOLTIP_OFFSET, left };
  if (spotTop - TOOLTIP_OFFSET - tooltipH > 0)    return { top: spotTop - TOOLTIP_OFFSET - tooltipH, left };
  return { top: vh / 2 - tooltipH / 2, left };
}

// ---------------------------------------------------------------------------

const OnboardingTour = () => {
  const {
    isActive, currentStep, currentStepIndex, totalSteps,
    nextStep, prevStep, skipTour, completeTour
  } = useTour();

  const [spotRect,        setSpotRect]        = useState(null);
  const [tooltipPos,      setTooltipPos]      = useState({ top: 0, left: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [actionDone,      setActionDone]      = useState(false);
  const [canProceed,      setCanProceed]      = useState(true);
  const [isOptionalFilled,setIsOptionalFilled]= useState(false);

  // Ref holding the cancellation fn for the active waitForElement call
  const cancelWaitRef = useRef(null);
  // Sequential step-change counter so stale async callbacks can be ignored
  const stepGenRef    = useRef(0);

  const isLastStep        = currentStepIndex === totalSteps - 1;
  const isWelcomeOrFinish = !currentStep?.selector;

  // ---------------------------------------------------------------------------
  // CORE: run when the step changes.
  //   1. Cancel any previous wait.
  //   2. Hide spotlight while transitioning.
  //   3. Wait for the element → scroll → wait for scroll to settle → show spotlight.
  // ---------------------------------------------------------------------------
  const updateSpotlight = useCallback(async () => {
    if (!isActive || !currentStep) return;

    // Each invocation gets a unique generation number so we can abort stale ones
    const gen = ++stepGenRef.current;
    const stale = () => gen !== stepGenRef.current;

    // Cancel any outstanding waitForElement from a previous step
    if (cancelWaitRef.current) { cancelWaitRef.current(); cancelWaitRef.current = null; }

    // Reset state for the new step
    setIsTransitioning(true);
    setSpotRect(null);
    setActionDone(false);
    setCanProceed(true);
    setIsOptionalFilled(false);

    // Centre-screen (welcome / finish) — no element needed
    if (!currentStep.selector) {
      if (stale()) return;
      setTooltipPos({
        top:  window.innerHeight / 2 - 110,
        left: window.innerWidth  / 2 - TOOLTIP_WIDTH / 2,
      });
      // Small paint delay so the fade-in feels intentional
      setTimeout(() => { if (!stale()) setIsTransitioning(false); }, 180);
      return;
    }

    // ── 1. Locate the element (wait for it if it isn't in the DOM yet) ──
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
      // Element never appeared — show tooltip centred
      setTooltipPos({
        top:  window.innerHeight / 2 - 110,
        left: window.innerWidth  / 2 - TOOLTIP_WIDTH / 2,
      });
      setIsTransitioning(false);
      return;
    }

    // ── 2. Scroll the element into view and wait until scroll settles ──
    await scrollAndWait(el);

    if (stale()) return;

    // ── 3. Now compute the spotlight from the settled rect ──
    const r = el.getBoundingClientRect();
    const nextRect = {
      x:      r.left  - SPOTLIGHT_PADDING,
      y:      r.top   - SPOTLIGHT_PADDING,
      width:  r.width  + SPOTLIGHT_PADDING * 2,
      height: r.height + SPOTLIGHT_PADDING * 2,
    };
    setSpotRect(nextRect);
    setTooltipPos(computeTooltipPos(nextRect, window.innerWidth, window.innerHeight));

    // ── 4. Reveal tooltip ──
    setIsTransitioning(false);

  }, [isActive, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run whenever the step index changes
  useEffect(() => {
    updateSpotlight();
  }, [currentStepIndex, updateSpotlight]);

  // ---------------------------------------------------------------------------
  // Continuous RAF loop — keeps the spotlight locked to the element while the
  // user scrolls, resizes, or interacts with the page.
  // Only runs after isTransitioning is false so it never races the initial setup.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive || isTransitioning) return;

    let active = true;
    const updateLoop = () => {
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
          const r = el.getBoundingClientRect();
          let nextRect = {
            x:      r.left  - SPOTLIGHT_PADDING,
            y:      r.top   - SPOTLIGHT_PADDING,
            width:  r.width  + SPOTLIGHT_PADDING * 2,
            height: r.height + SPOTLIGHT_PADDING * 2,
          };

          // Expand spotlight to cover any open date/time picker dropdown
          const dropdown = el.querySelector('.tour-picker-dropdown');
          if (dropdown) {
            const dr = dropdown.getBoundingClientRect();
            const minX = Math.min(nextRect.x, dr.left  - SPOTLIGHT_PADDING);
            const minY = Math.min(nextRect.y, dr.top   - SPOTLIGHT_PADDING);
            const maxX = Math.max(nextRect.x + nextRect.width,  dr.right  + SPOTLIGHT_PADDING);
            const maxY = Math.max(nextRect.y + nextRect.height, dr.bottom + SPOTLIGHT_PADDING);
            nextRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }

          setSpotRect(prev => {
            if (!prev ||
                Math.abs(prev.x      - nextRect.x)      > 0.5 ||
                Math.abs(prev.y      - nextRect.y)      > 0.5 ||
                Math.abs(prev.width  - nextRect.width)  > 0.5 ||
                Math.abs(prev.height - nextRect.height) > 0.5) {
              setTooltipPos(computeTooltipPos(nextRect, window.innerWidth, window.innerHeight));
              return nextRect;
            }
            return prev;
          });
        } else {
          setSpotRect(null);
          setTooltipPos({
            top:  window.innerHeight / 2 - 110,
            left: window.innerWidth  / 2 - TOOLTIP_WIDTH / 2,
          });
        }
      }

      // Poll canAdvance
      if (typeof currentStep?.canAdvance === 'function') {
        const allowed = currentStep.canAdvance();
        setCanProceed(prev => prev !== allowed ? allowed : prev);
      } else {
        setCanProceed(true);
      }

      // Poll optional fill
      if (currentStep?.isOptional && typeof currentStep?.checkOptionalFilled === 'function') {
        const filled = currentStep.checkOptionalFilled();
        setIsOptionalFilled(prev => prev !== filled ? filled : prev);
      } else {
        setIsOptionalFilled(false);
      }

      requestAnimationFrame(updateLoop);
    };

    requestAnimationFrame(updateLoop);
    return () => { active = false; };
  }, [isActive, isTransitioning, currentStep, currentStepIndex]);

  // ---------------------------------------------------------------------------
  // Body-scroll locking.
  // Lock scroll ONLY for purely informational steps (no canAdvance, no
  // requiresAction) — i.e. steps where the user only reads and clicks Next.
  // Form-interaction steps MUST allow scrolling so the user can reach inputs.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const needsInteraction = currentStep?.requiresAction || currentStep?.canAdvance || currentStep?.isOptional;
    if (isActive && !needsInteraction) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isActive, currentStep]);

  // ---------------------------------------------------------------------------
  // Block clicks on specific selectors (e.g. Create Exam btn during overview)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive || !currentStep?.blockSelectors?.length) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'tour-block-selectors-style';
    styleEl.innerHTML = `${currentStep.blockSelectors.join(', ')} { pointer-events: none !important; opacity: 0.65; cursor: not-allowed !important; }`;
    document.head.appendChild(styleEl);
    return () => { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); };
  }, [isActive, currentStep, currentStepIndex]);

  // ---------------------------------------------------------------------------
  // Action steps — auto-advance when the user clicks the highlighted element
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive || !currentStep?.requiresAction || !currentStep?.selector || actionDone) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) return;
    const handleClick = () => {
      setActionDone(true);
      setTimeout(() => nextStep(), 400);
    };
    el.addEventListener('click', handleClick, { once: true });
    return () => el.removeEventListener('click', handleClick);
  }, [isActive, currentStep, actionDone, nextStep]);

  // ---------------------------------------------------------------------------
  // Nothing to render while tour is inactive
  // ---------------------------------------------------------------------------
  if (!isActive) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ---------------------------------------------------------------------------
  // Last step — full-screen celebration card
  // ---------------------------------------------------------------------------
  if (isLastStep && isWelcomeOrFinish) {
    return createPortal(
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ pointerEvents: 'all' }}>
        <div className="absolute inset-0 bg-[rgba(10,14,30,0.8)] backdrop-blur-sm" />

        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-bounce"
              style={{
                width:  Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                left:   `${Math.random() * 100}%`,
                top:    `${Math.random() * 100}%`,
                background: ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899'][Math.floor(Math.random() * 6)],
                animationDelay:    `${Math.random() * 2}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 bg-white dark:bg-[#0f1729] border border-slate-200/80 dark:border-indigo-500/20 rounded-3xl shadow-2xl shadow-indigo-500/20 p-8 max-w-sm w-full text-center animate-in zoom-in-90 fade-in duration-500">
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-in zoom-in duration-700 delay-150">
            <svg viewBox="0 0 52 52" className="w-10 h-10" fill="none">
              <circle cx="26" cy="26" r="25" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M14 27l8 8 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                className="[stroke-dasharray:50] [stroke-dashoffset:50] animate-[drawCheck_0.6s_0.3s_ease-out_forwards]"
              />
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

  // ---------------------------------------------------------------------------
  // Main overlay
  // ---------------------------------------------------------------------------
  return createPortal(
    <div className="fixed inset-0 z-[9990] pointer-events-none">

      {/* Backdrop panels (4-sided cut-out around spotlight) */}
      {!spotRect ? (
        <div className="absolute inset-0 bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto" />
      ) : (
        <>
          {/* Top */}
          <div
            className="absolute left-0 top-0 w-full bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{ height: Math.max(0, spotRect.y) }}
          />
          {/* Bottom */}
          <div
            className="absolute left-0 w-full bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{ top: spotRect.y + spotRect.height, height: Math.max(0, vh - (spotRect.y + spotRect.height)) }}
          />
          {/* Left */}
          <div
            className="absolute left-0 bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{ top: spotRect.y, height: spotRect.height, width: Math.max(0, spotRect.x) }}
          />
          {/* Right */}
          <div
            className="absolute bg-[rgba(10,14,30,0.72)] backdrop-blur-[1.5px] pointer-events-auto transition-all duration-300"
            style={{ top: spotRect.y, left: spotRect.x + spotRect.width, height: spotRect.height, width: Math.max(0, vw - (spotRect.x + spotRect.width)) }}
          />

          {/* Spotlight ring */}
          <div
            className="absolute border-2 border-indigo-500/60 rounded-2xl pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            style={{ left: spotRect.x, top: spotRect.y, width: spotRect.width, height: spotRect.height }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        id="tour-tooltip-card"
        className={`absolute pointer-events-auto transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: TOOLTIP_WIDTH, zIndex: 9999 }}
      >
        {/* Outer glow ring */}
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-indigo-500/40 via-violet-500/20 to-indigo-500/40 blur-[2px]" />

        <div className="relative rounded-[26px] overflow-hidden bg-[#0b0f1e]/95 backdrop-blur-2xl border border-white/[0.07] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7),0_0_0_1px_rgba(99,102,241,0.12)]">

          {/* Top ambient strip */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Progress bar */}
          <div className="h-[2px] bg-white/5 w-full">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400 transition-all duration-700 ease-out"
              style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
            />
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
              <button
                onClick={skipTour}
                className="h-7 w-7 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                title="Skip tour"
              >
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
                <p className="text-[11.5px] font-semibold text-indigo-300">Click the highlighted element above to continue</p>
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
              {/* Dot progress */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-400 ${
                      i === currentStepIndex ? 'w-4 h-1.5 bg-indigo-400'
                      : i < currentStepIndex ? 'w-1.5 h-1.5 bg-indigo-700'
                      : 'w-1.5 h-1.5 bg-white/10'
                    }`}
                  />
                ))}
              </div>

              {/* Nav buttons */}
              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    onClick={prevStep}
                    className="h-8 px-3.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/8 flex items-center gap-1 transition-all border border-white/5 hover:border-white/10"
                  >
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
                        : (currentStep?.isOptional && !isOptionalFilled)
                          ? 'Skip'
                          : 'Next'}
                    </span>
                    {!isLastStep && <ChevronRight className="h-3.5 w-3.5 relative" />}
                  </button>
                ) : (
                  <button
                    disabled
                    className="h-8 px-4 rounded-xl text-[11px] font-bold text-white/30 bg-white/5 border border-white/5 flex items-center gap-1.5 cursor-not-allowed"
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
