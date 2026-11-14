import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import copy from '../../content/i18n/en.json';
import { Button } from './Button';

interface TutorialOverlayProps {
  step: number;
  onStep: (step: number) => void;
  onSkip: () => void;
  endLabel: string; // "End Sol" on Mars, "End Day" on the Moon
}

const STEPS = copy.tutorial;
const PADDING = 8;

function findTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tutorial="${name}"]`);
  for (const node of nodes) if (node.offsetParent !== null) return node;
  return null;
}

/** Spotlight tutorial. Step 4 (index 3) waits for the player to press End Sol. */
export function TutorialOverlay({ step, onStep, onSkip, endLabel }: TutorialOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = STEPS[step];
  const waitsForEndSol = step === 3;

  const measure = useCallback(() => {
    const el = findTarget(current.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [current.target]);

  useLayoutEffect(() => {
    const el = findTarget(current.target);
    el?.scrollIntoView({ block: 'center', behavior: 'auto' });
    measure();
  }, [measure, current.target]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip]);

  const below = rect ? rect.bottom + 16 + 200 < window.innerHeight : true;
  const cardStyle: CSSProperties = rect
    ? {
        top: below ? rect.bottom + 16 : Math.max(16, rect.top - 16),
        left: Math.min(Math.max(16, rect.left), window.innerWidth - 360),
        transform: below ? undefined : 'translateY(-100%)',
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-30"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tutorial-title"
    >
      {rect ? (
        <div
          className="absolute rounded-xl border-2 border-info transition-all duration-300"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgb(var(--scrim) / 0.68)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-scrim/60" />
      )}
      <div
        className="pointer-events-auto absolute w-[min(344px,calc(100vw-32px))] rounded-xl border border-info bg-panel p-4 shadow-2xl"
        style={cardStyle}
      >
        <div className="panel-title mb-1">
          Tutorial · step {step + 1} of {STEPS.length}
        </div>
        <h2 id="tutorial-title" className="text-base font-semibold">
          {current.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{current.text.replace('End Sol', endLabel)}</p>
        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-info' : 'bg-border'}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip tutorial
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button size="sm" onClick={() => onStep(step - 1)}>
                Back
              </Button>
            )}
            {waitsForEndSol ? (
              <span className="self-center text-sm text-info">Press {endLabel} to continue</span>
            ) : (
              <Button size="sm" variant="primary" onClick={() => onStep(step + 1)} autoFocus>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
