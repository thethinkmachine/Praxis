import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import AlgoInfoPopover from '@/components/shared/AlgoInfoPopover';
import { registry, type RegistryEntry } from '@/algorithms/core/registry';
import { buildRoute } from '@/lib/buildRoute';
import { ChevronDown, ChevronRight, Info, Settings2 } from '@/components/shared/Icons';
import type { AlgorithmMeta } from '@/types';
import type { ProblemCategory } from '@/types/problem';

interface AlgorithmTitleStripProps {
  meta: AlgorithmMeta;
  loadError: string | null;
  loadWarning?: string | null;
  problemCategory?: ProblemCategory;
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
  loadWarning,
  problemCategory = 'graph',
  showConfigButton = false,
  configOpen = false,
  onToggleConfig,
  actions,
  problemActions,
}: AlgorithmTitleStripProps) {
  const navigate = useNavigate();
  const [showInfo, setShowInfo] = useState(false);
  const toggleInfo = useCallback(() => setShowInfo(v => !v), []);

  const siblingAlgorithms = useMemo(() => {
    return registry.getByCategory(meta.category);
  }, [meta.category]);

  return (
    <div className="relative flex items-center gap-2 px-3 h-10 bg-[var(--titlebar)] border-b border-[var(--border)] shrink-0">
      {/* Config toggle button (optional) */}
      {showConfigButton && onToggleConfig && (
        <button
          onClick={onToggleConfig}
          title={configOpen ? 'Hide configuration' : 'Show configuration'}
          aria-label="Toggle configuration panel"
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg',
            'border transition-colors select-none',
            configOpen
              ? 'bg-[var(--accent-soft)] border-[var(--accent)]/60 text-[var(--accent)]'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
          )}
        >
          <Settings2 size={15} />
        </button>
      )}

      {/* Breadcrumbs with Dropdown */}
      <nav className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-3)] mr-2 overflow-hidden">
        <span className="uppercase tracking-widest shrink-0">{meta.category.replace('-', ' ')}</span>
        <ChevronRight size={10} className="shrink-0" />
        
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-1 text-[var(--text)] font-semibold hover:text-[var(--accent)] transition-colors group truncate">
              <span className="truncate">{meta.name}</span>
              <ChevronDown size={12} className="text-[var(--text-3)] group-hover:text-[var(--accent)] shrink-0" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content 
              className="z-50 min-w-[180px] bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100"
              sideOffset={5}
              align="start"
            >
              <div className="px-2 py-1.5 mb-1 border-b border-[var(--border)] text-[9px] uppercase tracking-widest text-[var(--text-3)] font-bold">
                Switch Algorithm
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {siblingAlgorithms.map((entry: RegistryEntry) => {
                  const siblingMeta = entry.runner.meta;
                  return (
                    <button
                      key={siblingMeta.id}
                      onClick={() => {
                        navigate(buildRoute({ category: meta.category, id: siblingMeta.id }, problemCategory));
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded text-xs font-medium transition-colors mb-px",
                        siblingMeta.id === meta.id 
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]"
                      )}
                    >
                      {siblingMeta.name}
                    </button>
                  );
                })}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </nav>

      <div className="hidden md:flex items-center gap-2">
        {meta.shortName && (
          <span className="text-[10px] text-[var(--text-3)] font-mono px-1.5 py-0.5 border border-[var(--border)] rounded bg-[var(--surface)]">
            {meta.shortName}
          </span>
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
      </div>

      {/* Info toggle */}
      <button
        onClick={toggleInfo}
        title="Algorithm info"
        aria-label="Toggle algorithm info"
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg',
          'border transition-colors select-none',
          showInfo
            ? 'bg-[var(--accent-soft)] border-[var(--accent)]/50 text-[var(--accent)]'
            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
        )}
      >
        <Info size={15} />
      </button>

      <div className="ml-auto flex items-center gap-2 min-w-0">
        {loadError && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--danger)]/40 text-[var(--danger)] bg-[var(--danger)]/10 truncate max-w-xs">
            {loadError}
          </span>
        )}

        {!loadError && loadWarning && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-[#F0883E]/35 text-[#F0883E] bg-[#F0883E]/10 truncate max-w-sm">
            {loadWarning}
          </span>
        )}

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
