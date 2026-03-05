import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { AlgorithmMeta } from '@/types';

interface AlgoInfoPopoverProps {
  meta: AlgorithmMeta;
  onClose: () => void;
}

export default function AlgoInfoPopover({ meta, onClose }: AlgoInfoPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on outside click — deferred so the trigger click does not instantly close
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

  return (
    <div
      ref={ref}
      className={cn(
        'absolute left-0 top-full z-30 mt-1',
        'w-[500px] max-w-[calc(100vw-2rem)]',
        'bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)] leading-snug">{meta.name}</p>
          {meta.shortName && (
            <p className="text-[10px] font-mono text-[var(--text-3)] mt-0.5">{meta.shortName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-5 h-5 rounded shrink-0 ml-3 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors text-sm leading-none"
          aria-label="Close info panel"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Description */}
        <p className="text-xs text-[var(--text-2)] leading-relaxed">{meta.description}</p>

        {/* Complexity + properties row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium">Time</span>
            <code className="text-[11px] font-mono bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)] rounded px-1.5 py-0.5">
              {meta.timeComplexity}
            </code>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium">Space</span>
            <code className="text-[11px] font-mono bg-[var(--surface-2)] text-[var(--purple)] border border-[var(--border)] rounded px-1.5 py-0.5">
              {meta.spaceComplexity}
            </code>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium">Complete</span>
            <span className={cn('text-[11px] font-medium', meta.complete ? 'text-[var(--success)]' : 'text-[var(--text-2)]')}>
              {meta.complete ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium">Optimal</span>
            <span className={cn('text-[11px] font-medium', meta.optimal ? 'text-[var(--success)]' : 'text-[var(--text-2)]')}>
              {meta.optimal ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* AIMA book chapter */}
        {meta.bookChapter && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium">AIMA Ref</span>
            <span className="text-[11px] text-[var(--text-2)]">{meta.bookChapter}</span>
          </div>
        )}

        {/* Related algorithms */}
        {meta.relatedAlgorithms && meta.relatedAlgorithms.length > 0 && (
          <div>
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium mb-1.5">
              Related Algorithms
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meta.relatedAlgorithms.map((name) => (
                <span
                  key={name}
                  className="text-[11px] px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] font-mono"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {meta.tags && meta.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {meta.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
