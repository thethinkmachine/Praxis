import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { AlgorithmMeta } from '@/types';

interface AlgoInfoPopoverProps {
  meta: AlgorithmMeta;
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

  return `${meta.name} uses heuristic guidance to bias exploration toward promising states. That usually means fewer expansions than uninformed baselines, but the quality of the heuristic directly affects how aggressively the frontier narrows and whether optimality guarantees still hold.`;
}

function buildTradeoffs(meta: AlgorithmMeta): string[] {
  return [
    meta.complete ? 'It is complete under its standard assumptions.' : 'It can fail to find a solution in some search spaces.',
    meta.optimal ? 'It preserves optimality when its assumptions are satisfied.' : 'It may trade optimality for speed or lower memory use.',
    meta.category === 'uninformed-search'
      ? 'It is best used when you do not have a trustworthy heuristic.'
      : 'It benefits most when the heuristic tracks remaining distance or cost reasonably well.',
  ];
}

export default function AlgoInfoPopover({ meta, onClose }: AlgoInfoPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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

  return (
    <div
      ref={ref}
      className={cn(
        'absolute left-0 top-full z-30 mt-2',
        'w-[620px] max-w-[calc(100vw-2rem)]',
        'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(0,0,0,0.42)]',
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
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
            aria-label="Close info panel"
          >
            ×
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
  );
}
