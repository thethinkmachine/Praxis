import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { X } from '@/components/shared/Icons';
import type { AlgorithmMeta } from '@/types';

interface AlgoInfoPopoverProps {
  meta: AlgorithmMeta;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

function complexityTone(value: string): string {
  if (value.includes('d/2') || value.includes('bd')) return 'text-[var(--success)]';
  if (value.includes('b^m') || value.includes('b^d')) return 'text-[var(--accent)]';
  return 'text-[var(--text)]';
}

function buildNarrative(meta: AlgorithmMeta): string {
  if (meta.longDescription) return meta.longDescription;

  if (meta.category === 'uninformed-search') {
    return `${meta.name} explores the state space without a heuristic estimate. It relies on the structure of the frontier and the order in which nodes are expanded, which makes it a useful baseline when you want to understand raw search behavior before adding domain knowledge.`;
  }

  if (meta.category === 'game-playing') {
    return `${meta.name} evaluates adversarial game states under alternating turns. Depending on the algorithm, the trace may show exact tree backup, chance-node averaging, pruning, or simulation-guided estimates before the final move is selected.`;
  }

  if (meta.category === 'local-search') {
    return `${meta.name} improves a complete candidate state by repeatedly evaluating nearby alternatives. The trace emphasizes objective values, accepted moves, plateaus, and escape mechanisms such as randomness, restarts, or memory.`;
  }

  return `${meta.name} uses heuristic guidance to bias exploration toward promising states. That usually means fewer expansions than uninformed baselines, but the quality of the heuristic directly affects how aggressively the frontier narrows and whether optimality guarantees still hold.`;
}

function buildTradeoffs(meta: AlgorithmMeta): string[] {
  return [
    meta.complete ? 'It is complete under its standard assumptions.' : 'It can fail to find a solution in some search spaces.',
    meta.optimal ? 'It preserves optimality when its assumptions are satisfied.' : 'It may trade optimality for speed or lower memory use.',
    meta.category === 'uninformed-search'
      ? 'It is best used when you do not have a trustworthy heuristic.'
      : meta.category === 'game-playing'
        ? 'It is best used when you need to reason about forced wins, defensive replies, stochastic opponents, or simulation-guided move quality.'
        : meta.category === 'local-search'
          ? 'It is best used when you can score complete states cheaply and want fast improvement without exploring full search trees.'
        : 'It benefits most when the heuristic tracks remaining distance or cost reasonably well.',
  ];
}

export default function AlgoInfoPopover({ meta, anchorRef, onClose }: AlgoInfoPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 52, left: 16 });

  useEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const width = Math.min(620, window.innerWidth - 32);
      const nextLeft = Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16);
      const nextTop = Math.max(16, rect.bottom + 10);
      setPosition({ top: nextTop, left: nextLeft });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const anchor = anchorRef.current;
      if (anchor && anchor.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) {
        onClose();
      }
    };
    const id = window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const narrative = buildNarrative(meta);
  const tradeoffs = buildTradeoffs(meta);

  return createPortal((
    <div
      ref={ref}
      style={{ top: position.top, left: position.left }}
      className={cn(
        'ui-panel-elevated fixed z-[120]',
        'w-[min(620px,calc(100vw-2rem))]',
        'overflow-hidden rounded-2xl',
      )}
    >
      <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(88,166,255,0.08),transparent)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[var(--text)]">{meta.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-3)]">
              {meta.category.replace('-', ' ')} {meta.shortName ? `• ${meta.shortName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ui-btn ui-btn-icon h-8 w-8 rounded-xl"
            aria-label="Close info panel"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">{narrative}</p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">How To Read It</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
              {meta.description}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Tradeoffs</p>
            <div className="mt-2 space-y-2">
              {tradeoffs.map((tradeoff) => (
                <div key={tradeoff} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2 text-sm text-[var(--text-2)]">
                  {tradeoff}
                </div>
              ))}
            </div>
          </div>

          {meta.relatedAlgorithms && meta.relatedAlgorithms.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Related Algorithms</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {meta.relatedAlgorithms.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-mono text-[var(--text-2)]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Time Complexity</p>
              <p className={cn('mt-2 font-mono text-lg', complexityTone(meta.timeComplexity))}>{meta.timeComplexity}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Space Complexity</p>
              <p className={cn('mt-2 font-mono text-lg', complexityTone(meta.spaceComplexity))}>{meta.spaceComplexity}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Guarantees</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[var(--text-3)]">Complete</p>
                <p className={cn('mt-1 font-semibold', meta.complete ? 'text-[var(--success)]' : 'text-[var(--text)]')}>
                  {meta.complete ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-3)]">Optimal</p>
                <p className={cn('mt-1 font-semibold', meta.optimal ? 'text-[var(--success)]' : 'text-[var(--text)]')}>
                  {meta.optimal ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Reference</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">{meta.bookChapter}</p>
            {meta.tags && meta.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-3)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
