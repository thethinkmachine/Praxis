import { useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';
import AlgoInfoPopover from '@/components/shared/AlgoInfoPopover';
import { registry, type RegistryEntry } from '@/algorithms/core/registry';
import { buildRoute } from '@/lib/buildRoute';
import { ChevronDown, Info, Settings2 } from '@/components/shared/Icons';
import { TopBarControls } from '@/components/layout/TopBar';
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
  /** When true, renders as a single unified header (replaces TopBar): adds Home
   *  breadcrumb on the left and utility controls (theme/fullscreen/shortcuts/about)
   *  on the right. */
  unifiedMode?: boolean;
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
  unifiedMode = false,
}: AlgorithmTitleStripProps) {
  const navigate = useNavigate();
  const [showInfo, setShowInfo] = useState(false);
  const toggleInfo = useCallback(() => setShowInfo(v => !v), []);
  const categoryLabel = meta.category.replace(/-/g, ' ');

  const siblingAlgorithms = useMemo(() => {
    return registry.getByCategory(meta.category);
  }, [meta.category]);

  return (
    <div className="relative shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm">
      <div className="flex h-10 items-center gap-2 px-3">
        {unifiedMode && (
          <>
            <Link
              to="/"
              className="shrink-0 text-[11px] font-mono text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              Home
            </Link>
            <span className="text-[var(--text-3)] font-mono text-[11px] shrink-0">/</span>
          </>
        )}
        {showConfigButton && onToggleConfig && (
          <button
            onClick={onToggleConfig}
            title={configOpen ? 'Hide configuration' : 'Show configuration'}
            aria-label="Toggle configuration panel"
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md shrink-0',
              'border transition-colors select-none',
              configOpen
                ? 'bg-[var(--accent-soft)] border-[var(--accent)]/60 text-[var(--accent)]'
                : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
            )}
          >
            <Settings2 size={15} />
          </button>
        )}

        <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
          <span className={cn(
            'shrink-0 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]',
            unifiedMode ? 'inline-flex' : 'hidden sm:inline-flex',
          )}>
            {categoryLabel}
          </span>

          {meta.shortName && !unifiedMode && (
            <span className="hidden lg:inline-flex shrink-0 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.14em] text-[var(--text-2)]">
              {meta.shortName}
            </span>
          )}

          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <Popover.Root>
              <Popover.Trigger asChild>
                <button className="group flex min-w-0 items-center gap-1 rounded-md text-left text-[13px] font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent)]">
                  <span className="truncate">{meta.name}</span>
                  <ChevronDown size={12} className="shrink-0 text-[var(--text-3)] transition-colors group-hover:text-[var(--accent)]" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 min-w-[180px] bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100"
                  sideOffset={6}
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
                            'w-full text-left px-2.5 py-1.5 rounded text-xs font-medium transition-colors mb-px',
                            siblingMeta.id === meta.id
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                              : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]',
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

            <button
              onClick={toggleInfo}
              title="Algorithm info"
              aria-label="Toggle algorithm info"
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
                'border transition-colors select-none',
                showInfo
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)]/50 text-[var(--accent)]'
                  : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
              )}
            >
              <Info size={13} />
            </button>

            <div className="hidden xl:flex items-center gap-1 min-w-0">
              {meta.complete && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--success)]/40 text-[var(--success)] bg-[var(--success)]/10 whitespace-nowrap">
                  Complete
                </span>
              )}
              {meta.optimal && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10 whitespace-nowrap">
                  Optimal
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto overflow-y-hidden scrollbar-none">
          {actions}
          {problemActions}
          {unifiedMode && (
            <>
              <div className="w-px h-4 bg-[var(--border-strong)] shrink-0 mx-0.5" />
              <TopBarControls />
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div className="border-t border-[var(--danger)]/20 bg-[var(--danger)]/6 px-3 py-1.5">
          <p className="text-[10px] text-[var(--danger)] truncate">
            {loadError}
          </p>
        </div>
      )}

      {!loadError && loadWarning && (
        <div className="border-t border-[#F0883E]/20 bg-[#F0883E]/6 px-3 py-1.5">
          <p className="text-[10px] text-[#F0883E] truncate">
            {loadWarning}
          </p>
        </div>
      )}

      {showInfo && (
        <AlgoInfoPopover meta={meta} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
