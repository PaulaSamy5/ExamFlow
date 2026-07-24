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
 * Prefers below the spotlight; flips to above if there's not enough room.
 */
function computeTooltipPos(rect, vw, vh) {
  if (!rect) return { top: vh / 2 - 100, left: vw / 2 - TOOLTIP_WIDTH / 2 };

  const spotBottom = rect.y + rect.height + SPOTLIGHT_PADDING;
  const spotTop    = rect.y - SPOTLIGHT_PADDING;
  const tooltipH   = 220; // estimated
  const leftIdeal  = rect.x + rect.width / 2 - TOOLTIP_WIDTH / 2;
  const left       = Math.max(16, Math.min(leftIdeal, vw - TOOLTIP_WIDTH - 16));

  if (spotBottom + TOOLTIP_OFFSET + tooltipH < vh) {
    return { top: spotBottom + TOOLTIP_OFFSET, left };
  }
  if (spotTop - TOOLTIP_OFFSET - tooltipH > 0) {
    return { top: spotTop - TOOLTIP_OFFSET - tooltipH, left };
  }
  // Fallback: centre vertically
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
  const cancelWaitRef = useRef(null);

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isWelcomeOrFinish = !currentStep?.selector;

  // Locate the target element and compute spotlight rect
  const locateElement = useCallback(() => {
    if (!isActive || !currentStep) return;
    setIsTransitioning(true);
    setActionDone(false);

    if (cancelWaitRef.current) cancelWaitRef.current();

    if (!currentStep.selector) {
      // Centre-screen step (welcome / finish)
      setSpotRect(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 110,
        left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
      });
      setTimeout(() => setIsTransitioning(false), 300);
      return;
    }

    const cancel = waitForElement(currentStep.selector, (el) => {
      if (!el) {
        // Element not found — still show centred tooltip, don't crash
        setSpotRect(null);
        setTooltipPos({
          top: window.innerHeight / 2 - 110,
          left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
        });
        setIsTransitioning(false);
        return;
      }

      scrollIntoViewIfNeeded(el);

      // Wait a frame after scroll so getBoundingClientRect is accurate
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const rect = {
          x: r.left - SPOTLIGHT_PADDING,
          y: r.top  - SPOTLIGHT_PADDING,
          width:  r.width  + SPOTLIGHT_PADDING * 2,
          height: r.height + SPOTLIGHT_PADDING * 2,
        };
        setSpotRect(rect);
        setTooltipPos(computeTooltipPos(rect, window.innerWidth, window.innerHeight));
        setIsTransitioning(false);
      });
    });

    cancelWaitRef.current = cancel;
  }, [isActive, currentStep]);

  // Re-locate when the active step changes
  useEffect(() => { locateElement(); }, [locateElement]);

  // Recalculate on resize
  useEffect(() => {
    if (!isActive) return;
    const onResize = () => locateElement();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isActive, locateElement]);

  // Prevent body scroll while tour is active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isActive]);

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

  // SVG mask spotlight path (full rect minus the cutout)
  const svgMask = spotRect
    ? `M0,0 H${vw} V${vh} H0 Z M${spotRect.x},${spotRect.y} H${spotRect.x + spotRect.width} V${spotRect.y + spotRect.height} H${spotRect.x} Z`
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990]"
      style={{ pointerEvents: 'all' }}
      onMouseDown={(e) => {
        // Allow clicks inside the spotlight rect or tooltip
        const tooltipEl = document.getElementById('tour-tooltip-card');
        if (tooltipEl && tooltipEl.contains(e.target)) return;
        if (spotRect) {
          const { clientX: cx, clientY: cy } = e;
          const inSpot =
            cx >= spotRect.x && cx <= spotRect.x + spotRect.width &&
            cy >= spotRect.y && cy <= spotRect.y + spotRect.height;
          if (inSpot) return; // allow interaction with highlighted element
        }
        // Block all other clicks
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* SVG Backdrop */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="tour-blur">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          {svgMask && (
            <clipPath id="spotlight-clip">
              <path d={svgMask} fillRule="evenodd" />
            </clipPath>
          )}
        </defs>

        {/* Dimmed overlay */}
        {svgMask ? (
          <path
            d={svgMask}
            fillRule="evenodd"
            fill="rgba(10, 14, 30, 0.72)"
            className="transition-all duration-500"
          />
        ) : (
          <rect
            x="0" y="0" width={vw} height={vh}
            fill="rgba(10, 14, 30, 0.72)"
          />
        )}

        {/* Spotlight glow ring */}
        {spotRect && (
          <rect
            x={spotRect.x - 1}
            y={spotRect.y - 1}
            width={spotRect.width + 2}
            height={spotRect.height + 2}
            rx="12"
            ry="12"
            fill="none"
            stroke="rgba(99,102,241,0.7)"
            strokeWidth="1.5"
            className="transition-all duration-500"
          />
        )}
      </svg>

      {/* Tour Tooltip Card */}
      <div
        id="tour-tooltip-card"
        className={`absolute transition-all duration-400 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_WIDTH,
          pointerEvents: 'all',
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

            {/* Action hint for interactive steps */}
            {currentStep?.requiresAction && !actionDone && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
                  Perform the action above to continue
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
                {!currentStep?.requiresAction || actionDone ? (
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
