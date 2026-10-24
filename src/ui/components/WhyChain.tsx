import { useState } from 'react';
import type { CausalLink } from '../../engine';
import { cx } from '../format';

function chipTone(link: CausalLink): string {
  if (link.cause.startsWith('event:')) return 'border-warn/60 bg-warn/10';
  if (link.cause.startsWith('decision:')) return 'border-info/60 bg-info/10';
  if (link.effect.startsWith('shed:') || link.magnitude < 0) return 'border-danger/50 bg-danger/10';
  return 'border-border bg-panel-2';
}

function kindLabel(link: CausalLink): string {
  if (link.cause.startsWith('event:')) return 'Event';
  if (link.cause.startsWith('decision:')) return 'Your decision';
  return 'Effect';
}

/** Causal chains as connected chips. Each chip explains itself on hover or keyboard focus. */
export function WhyChain({ chains }: { chains: CausalLink[][] }) {
  const [active, setActive] = useState<CausalLink | null>(null);

  if (chains.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing unusual happened today, so there is no chain of causes to show.
      </p>
    );
  }

  return (
    <div>
      <ol className="space-y-3">
        {chains.map((chain, i) => (
          <li key={i} className="rounded-lg border border-border p-3">
            <div className="mb-2 text-xs text-muted">Chain {i + 1}</div>
            <ol
              className="flex flex-wrap items-center gap-y-2"
              aria-label={chain.map((l) => l.label).join(', then ')}
            >
              {chain.map((link, j) => (
                <li key={link.id} className="flex items-center">
                  {j > 0 && (
                    <span aria-hidden="true" className="mx-1.5 text-muted">
                      →
                    </span>
                  )}
                  <button
                    type="button"
                    className={cx(
                      'rounded-md border px-2 py-1 text-left text-sm',
                      chipTone(link),
                      active?.id === link.id && 'ring-2 ring-info',
                    )}
                    onMouseEnter={() => setActive(link)}
                    onFocus={() => setActive(link)}
                    onClick={() => setActive(link)}
                  >
                    <span className="block text-[10px] uppercase tracking-wide text-muted">
                      {kindLabel(link)}
                    </span>
                    {link.label}
                  </button>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <p className="mt-3 min-h-[2.5rem] text-sm text-muted" aria-live="polite">
        {active ? (active.detail ?? `${active.label}.`) : 'Hover over or focus a step to see what it means.'}
      </p>
    </div>
  );
}
