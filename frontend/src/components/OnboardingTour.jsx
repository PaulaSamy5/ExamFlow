import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../store/TourContext';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const SPOTLIGHT_PADDING    = 12;
const TOOLTIP_OFFSET       = 20;
const TOOLTIP_WIDTH        = 340;
const ELEMENT_WAIT_MAX     = 6000;
const SCROLL_STABLE_FRAMES = 8;
const SCROLL_HARD_TIMEOUT  = 1600;
const SCROLL_KEYS          = new Set([32, 33, 34, 35, 36, 38, 40]);

// ─── User-scroll prevention handlers ─────────────────────────────────────────
function lockWheel(e)  { e.preventDefault(); }
function lockTouch(e)  { e.preventDefault(); }
function lockKeys(e) {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag)) return;
  if (SCROLL_KEYS.has(e.keyCode)) e.preventDefault();
}

// ─── Wait for DOM element (MutationObserver + hard timeout) ──────────────────
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
  const check = () => { const el = document.querySelector(selector); if (el) finish(el); };
  check();
  if (done) return () => {};
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  const timeout = setTimeout(() => { observer.disconnect(); if (!done) { done = true; callback(document.querySelector(selector)); } }, ELEMENT_WAIT_MAX);
  return () => { done = true; observer.disconnect(); clearTimeout(timeout); };
}

// ─── Tour-controlled scroll: scrollIntoView then wait for rect stability ─────
function scrollIntoViewAndWait(el) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }
    const r  = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const alreadyCentred = r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    if (alreadyCentred) { setTimeout(resolve, 80); return; }
    let prevTop = null, stableFrames = 0, cancelled = false;
    const hardStop = setTimeout(() => { cancelled = true; resolve(); }, SCROLL_HARD_TIMEOUT);
    const poll = () => {
      if (cancelled) return;
      const top = el.getBoundingClientRect().top;
      if (prevTop !== null && Math.abs(top - prevTop) < 0.5) {
        if (++stableFrames >= SCROLL_STABLE_FRAMES) { clearTimeout(hardStop); resolve(); return; }
      } else { stableFrames = 0; }
      prevTop = top;
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

// ─── Tooltip positioning ──────────────────────────────────────────────────────
function computeTooltipPos(rect, vw, vh) {
  if (!rect) return { top: vh / 2 - 100, left: vw / 2 - TOOLTIP_WIDTH / 2 };
  const tooltipH = 230;
  if (vw >= 800) {
    if (rect.x + rect.width / 2 < vw / 2) {
      const left = rect.x + rect.width + TOOLTIP_OFFSET;
      if (left + TOOLTIP_WIDTH < vw - 16)
        return { top: Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16)), left };
    } else {
      const left = rect.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
      if (left > 16)
        return { top: Math.max(16, Math.min(rect.y + rect.height / 2 - tooltipH / 2, vh - tooltipH - 16)), left };
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
  const { isActive, currentStep, currentStepIndex, totalSteps,
          nextStep, prevStep, skipTour, completeTour } = useTour();

  const [spotRect,         setSpotRect]         = useState(null);
  const [tooltipPos,       setTooltipPos]        = useState({ top: 0, left: 0 });
  const [isTransitioning,  setIsTransitioning]   = useState(false);
  const [actionDone,       setActionDone]        = useState(false);
  const [canProceed,       setCanProceed]        = useState(true);
  const [isOptionalFilled, setIsOptionalFilled]  = useState(false);

  const cancelWaitRef      = useRef(null);
  const stepGenRef         = useRef(0);
  // Ref mirror of isTransitioning — always synchronously current in event handlers
  const isTransitioningRef = useRef(false);
  const settledScrollTopRef  = useRef(0);
  const settledScrollLeftRef = useRef(0);

  const isLastStep        = currentStepIndex === totalSteps - 1;
  const isWelcomeOrFinish = !currentStep?.selector;

  // Helper: update both ref and state atomically
  const setTransitioning = (val) => {
    isTransitioningRef.current = val;
    setIsTransitioning(val);
  };

  // ── Step change pipeline ────────────────────────────────────────────────────
  const updateSpotlight = useCallback(async () => {
    if (!isActive || !currentStep) return;

    const gen   = ++stepGenRef.current;
    const stale = () => gen !== stepGenRef.current;

    if (cancelWaitRef.current) { cancelWaitRef.current(); cancelWaitRef.current = null; }

    setTransitioning(true);
    setSpotRect(null);
    setActionDone(false);
    setCanProceed(true);
    setIsOptionalFilled(false);

    // Centre-screen (welcome / finish)
    if (!currentStep.selector) {
      if (stale()) return;
      setTooltipPos({ top: window.innerHeight / 2 - 110, left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2 });
      settledScrollTopRef.current  = window.scrollY;
      settledScrollLeftRef.current = window.scrollX;
      setTimeout(() => { if (!stale()) setTransitioning(false); }, 200);
      return;
    }

    // 1. Wait for element
    let el = document.querySelector(currentStep.selector);
    if (!el) {
      await new Promise((resolve) => {
        const cancel = waitForElement(currentStep.selector, (found) => { el = found; resolve(); });
        cancelWaitRef.current = cancel;
      });
      cancelWaitRef.current = null;
    }
    if (stale()) return;

    if (!el) {
      setTooltipPos({ top: window.innerHeight / 2 - 110, left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2 });
      setTransitioning(false);
      return;
    }

    // 2. Scroll + wait for stability
    await scrollIntoViewAndWait(el);
    if (stale()) return;

    // 3. Compute spotlight
    const r        = el.getBoundingClientRect();
    const nextRect = {
      x: r.left - SPOTLIGHT_PADDING, y: r.top - SPOTLIGHT_PADDING,
      width: r.width + SPOTLIGHT_PADDING * 2, height: r.height + SPOTLIGHT_PADDING * 2,
    };
    setSpotRect(nextRect);
    setTooltipPos(computeTooltipPos(nextRect, window.innerWidth, window.innerHeight));

    // 4. Record settled scroll
    settledScrollTopRef.current  = window.scrollY || document.documentElement.scrollTop  || document.body.scrollTop;
    settledScrollLeftRef.current = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft;

    // 5. Reveal
    setTransitioning(false);
  }, [isActive, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { updateSpotlight(); }, [currentStepIndex, updateSpotlight]);

  // ── Global scroll lock ──────────────────────────────────────────────────────
  // Uses the REF (not state) so handler is never stale, even during React batching
  useEffect(() => {
    if (!isActive) return;
    const handleScroll = () => {
      if (isTransitioningRef.current) return; // allow programmatic smooth scroll
      window.scrollTo(0, settledScrollTopRef.current);
      if (document.documentElement) {
        document.documentElement.scrollTop  = settledScrollTopRef.current;
        document.documentElement.scrollLeft = 0;
      }
      if (document.body) {
        document.body.scrollTop  = settledScrollTopRef.current;
        document.body.scrollLeft = 0;
      }
    };
    window.addEventListener('wheel',     lockWheel,     { passive: false });
    window.addEventListener('touchmove', lockTouch,     { passive: false });
    window.addEventListener('keydown',   lockKeys,      { passive: false });
    window.addEventListener('scroll',    handleScroll,  { passive: true  });
    return () => {
      window.removeEventListener('wheel',     lockWheel);
      window.removeEventListener('touchmove', lockTouch);
      window.removeEventListener('keydown',   lockKeys);
      window.removeEventListener('scroll',    handleScroll);
    };
  }, [isActive]); // stable — ref handles isTransitioning updates without re-adding

  // ── Continuous RAF tracking (keeps spotlight on element after scroll settles) ─
  useEffect(() => {
    if (!isActive || isTransitioning) return;
    let active = true;
    const loop = () => {
      if (!active) return;
      if (currentStep?.selector) {
        const el = document.querySelector(currentStep.selector);
        if (el) {
          const r        = el.getBoundingClientRect();
          const nextRect = {
            x: r.left - SPOTLIGHT_PADDING, y: r.top - SPOTLIGHT_PADDING,
            width: r.width + SPOTLIGHT_PADDING * 2, height: r.height + SPOTLIGHT_PADDING * 2,
          };
          setSpotRect(prev => {
            if (!prev ||
                Math.abs(prev.x - nextRect.x) > 0.5 || Math.abs(prev.y - nextRect.y) > 0.5 ||
                Math.abs(prev.width - nextRect.width) > 0.5 || Math.abs(prev.height - nextRect.height) > 0.5) {
              setTooltipPos(computeTooltipPos(nextRect, window.innerWidth, window.innerHeight));
              return nextRect;
            }
            return prev;
          });
        } else {
          setSpotRect(null);
        }
      }
      if (typeof currentStep?.canAdvance === 'function') {
        const ok = currentStep.canAdvance();
        setCanProceed(prev => prev !== ok ? ok : prev);
      } else {
        setCanProceed(true);
      }
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

  // ── Block clicks on specific selectors (Create Exam btn during overview) ────
  useEffect(() => {
    if (!isActive || !currentStep?.blockSelectors?.length) return;
    const s = document.createElement('style');
    s.id = 'tour-block-selectors-style';
    s.innerHTML = `${currentStep.blockSelectors.join(', ')} { pointer-events: none !important; opacity: 0.65; cursor: not-allowed !important; }`;
    document.head.appendChild(s);
    return () => { if (s.parentNode) s.parentNode.removeChild(s); };
  }, [isActive, currentStep, currentStepIndex]);

  // ── Action steps: click the highlighted element to advance ──────────────────
  useEffect(() => {
    if (!isActive || !currentStep?.requiresAction || !currentStep?.selector || actionDone) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) return;
    const handle = () => { setActionDone(true); setTimeout(() => nextStep(), 400); };
    el.addEventListener('click', handle, { once: true });
    return () => el.removeEventListener('click', handle);
  }, [isActive, currentStep, actionDone, nextStep]);

  if (!isActive) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Finish screen ───────────────────────────────────────────────────────────
  if (isLastStep && isWelcomeOrFinish) {
    return createPortal(
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ pointerEvents: 'all' }}>
        <div className="absolute inset-0 bg-[rgba(10,14,30,0.85)] backdrop-blur-sm" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="absolute rounded-full animate-bounce" style={{
              width: Math.random() * 8 + 4, height: Math.random() * 8 + 4,
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              background: ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899'][Math.floor(Math.random() * 6)],
              animationDelay: `${Math.random() * 2}s`, animationDuration: `${1.5 + Math.random() * 2}s`, opacity: 0.7,
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
          <button onClick={completeTour}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] flex items-center justify-center gap-2">
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

      {/* SVG backdrop overlay with cutout hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9991 }}>
        <path
          d={
            spotRect
              ? `M 0 0 H ${vw} V ${vh} H 0 Z M ${spotRect.x} ${spotRect.y} H ${spotRect.x + spotRect.width} V ${spotRect.y + spotRect.height} H ${spotRect.x} Z`
              : `M 0 0 H ${vw} V ${vh} H 0 Z`
          }
          fill="rgba(10, 14, 30, 0.72)"
          fillRule="evenodd"
          className="pointer-events-auto transition-all duration-300"
        />
      </svg>

      {/* Spotlight ring */}
      {spotRect && (
        <div className="absolute border-2 border-indigo-500/60 rounded-2xl pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
             style={{ left: spotRect.x, top: spotRect.y, width: spotRect.width, height: spotRect.height }} />
      )}

      {/* Tooltip card */}
      <div
        id="tour-tooltip-card"
        className={`absolute pointer-events-auto transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: TOOLTIP_WIDTH, zIndex: 9999 }}
      >
        {/* Outer glow */}
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-indigo-500/40 via-violet-500/20 to-indigo-500/40 blur-[2px]" />

        <div className="relative rounded-[26px] overflow-hidden bg-[#0b0f1e]/95 backdrop-blur-2xl border border-white/[0.07] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7),0_0_0_1px_rgba(99,102,241,0.12)]">
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

            {/* Action hint — only for requiresAction steps */}
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
              {/* Dot progress */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-400 ${
                    i === currentStepIndex ? 'w-4 h-1.5 bg-indigo-400'
                    : i < currentStepIndex ? 'w-1.5 h-1.5 bg-indigo-700'
                    : 'w-1.5 h-1.5 bg-white/10'
                  }`} />
                ))}
              </div>

              {/* Nav buttons */}
              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button onClick={prevStep}
                    className="h-8 px-3.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/8 flex items-center gap-1 transition-all border border-white/5 hover:border-white/10">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}

                {/* requiresAction steps: hide Next entirely — user must click the element */}
                {currentStep?.requiresAction && !actionDone ? null : (
                  canProceed ? (
                    <button
                      onClick={isLastStep ? completeTour : nextStep}
                      className="relative h-8 px-4 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 transition-all active:scale-95 overflow-hidden group"
                      style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
                    >
                      <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-200 rounded-xl" />
                      <span className="relative">
                        {isLastStep ? '🎉 Finish' : (currentStep?.isOptional && !isOptionalFilled) ? 'Skip' : 'Next'}
                      </span>
                      {!isLastStep && <ChevronRight className="h-3.5 w-3.5 relative" />}
                    </button>
                  ) : (
                    <button disabled
                      className="h-8 px-4 rounded-xl text-[11px] font-bold text-white/30 bg-white/5 border border-white/5 flex items-center gap-1.5 cursor-not-allowed">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )
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
