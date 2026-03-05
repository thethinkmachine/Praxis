import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import AlgoInfoPopover from '@/components/shared/AlgoInfoPopover';
import type { AlgorithmMeta } from '@/types';

interface AlgorithmTitleStripProps {
  meta: AlgorithmMeta;
  loadError: string | null;
  /** Show the gear/config toggle button */
  showConfigButton?: boolean;
  /** Is config panel currently open */
  configOpen?: boolean;
  /** Toggle config panel */
  onToggleConfig?: () => void;
  /** Right-side action buttons (Random, Demo picker, etc.) */
  actions?: React.ReactNode;
  /** Problem import/export actions */
  problemActions?: React.ReactNode;
}

export default function AlgorithmTitleStrip({
  meta,
  loadError,
  showConfigButton = false,
  configOpen = false,
  onToggleConfig,
  actions,
  problemActions,
}: AlgorithmTitleStripProps) {
  const [showInfo, setShowInfo] = useState(false);
  const toggleInfo = useCallback(() => setShowInfo(v => !v), []);

  return (
    <div className="relative flex items-center gap-3 px-4 h-9 bg-[var(--surface)] border-b border-[var(--border)] shrink-0">
      {/* Config toggle button (optional) */}
      {showConfigButton && onToggleConfig && (
        <button
          onClick={onToggleConfig}
          title={configOpen ? 'Hide configuration' : 'Show configuration'}
          aria-label="Toggle configuration panel"
          className={cn(
            'flex items-center justify-center w-[22px] h-[22px] rounded text-[13px]',
            'border transition-colors select-none',
            configOpen
              ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]'
              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
          )}
        >
          ⚙
        </button>
      )}

      <h1 className="text-sm font-semibold text-[var(--text)]">{meta.name}</h1>
      {meta.shortName && (
        <span className="text-xs text-[var(--text-3)] font-mono">{meta.shortName}</span>
      )}
      <AlgorithmBadge category={meta.category} size="sm" />

      {/* Complete badge */}
      {meta.complete && (
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--success)]/40 text-[var(--success)] bg-[var(--success)]/10">
          Complete
        </span>
      )}
      {/* Optimal badge */}
      {meta.optimal && (
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10">
          Optimal
        </span>
      )}

      {/* Info toggle */}
      <button
        onClick={toggleInfo}
        title="Algorithm info"
        aria-label="Toggle algorithm info"
        className={cn(
          'flex items-center justify-center w-[22px] h-[22px] rounded-full text-[11px] font-bold',
          'border transition-colors select-none',
          showInfo
            ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]'
            : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
        )}
      >
        i
      </button>

      {/* Error badge */}
      {loadError && (
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded border border-[var(--danger)]/40 text-[var(--danger)] bg-[var(--danger)]/10 truncate max-w-xs">
          {loadError}
        </span>
      )}

      {/* Action slots */}
      <div className={cn('flex items-center gap-2', loadError ? '' : 'ml-auto')}>
        {actions}
        {problemActions}
      </div>

      {/* Inline info popover */}
      {showInfo && (
        <AlgoInfoPopover meta={meta} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
