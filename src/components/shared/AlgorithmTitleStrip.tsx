import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';
import AlgoInfoPopover from '@/components/shared/AlgoInfoPopover';
import { registry, type RegistryEntry } from '@/algorithms/core/registry';
import { buildRoute } from '@/lib/buildRoute';
import { ChevronDown, Home, Info, Settings2 } from '@/components/shared/Icons';
import { TopBarControls } from '@/components/layout/TopBar';
import type { AlgorithmMeta } from '@/types';
import type { ProblemCategory } from '@/types/problem';

interface AlgorithmTitleStripProps {
  meta: AlgorithmMeta;
  loadError: string | null;
  loadWarning?: string | null;
  problemCategory?: ProblemCategory;
  buildAlgorithmRoute?: (algorithmId: string) => string;
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
  buildAlgorithmRoute,
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
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const hasActionContent = Boolean(actions) || Boolean(problemActions);

  const siblingAlgorithms = useMemo(() => {
    return registry.getByCategory(meta.category);
  }, [meta.category]);

  return (
    <div className="relative z-20 shrink-0 bg-[var(--surface)]/95 backdrop-blur-sm">
      <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-3">
        {unifiedMode && (
          <>
            <Link
              to="/"
              className="ui-btn ui-btn-ghost ui-btn-icon h-7 w-7 rounded-md shrink-0"
              title="Home"
              aria-label="Go to home"
            >
              <Home size={14} />
            </Link>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-3)] overflow-hidden">
              <span className="shrink-0">/</span>
              <span className="truncate">{categoryLabel}</span>
            </div>
          </>
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
                <button className="group flex min-w-0 max-w-[min(22rem,38vw)] items-center gap-1 rounded-md text-left text-[13px] font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent)]">
                  <span className="truncate">{meta.name}</span>
                  <ChevronDown size={12} className="shrink-0 text-[var(--text-3)] transition-colors group-hover:text-[var(--accent)]" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="ui-panel-elevated z-[100] w-[min(20rem,calc(100vw-2rem))] rounded-lg p-1 animate-in fade-in zoom-in-95 duration-100"
                  sideOffset={6}
                  align="start"
                  collisionPadding={12}
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
                            navigate(buildAlgorithmRoute?.(siblingMeta.id) ?? buildRoute({ category: meta.category, id: siblingMeta.id }, problemCategory));
                          }}
                          className={cn(
                            'w-full truncate text-left px-2.5 py-1.5 rounded text-xs font-medium transition-colors mb-px',
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

            <div className="hidden xl:flex items-center gap-1 min-w-0">
              {meta.complete && (
                <span className="ui-pill ui-pill-success text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                  Complete
                </span>
              )}
              {meta.optimal && (
                <span className="ui-pill ui-pill-accent text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                  Optimal
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5">
          <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto overflow-y-hidden scrollbar-none">
            {actions}
            {problemActions}
          </div>

          {(hasActionContent || showConfigButton || unifiedMode) && (
            <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border-strong)]" />
          )}

          <div className="flex shrink-0 items-center gap-1">
            {showConfigButton && onToggleConfig && (
              <button
                onClick={onToggleConfig}
                title={configOpen ? 'Hide configuration' : 'Show configuration'}
                aria-label="Toggle configuration panel"
                className={cn(
                  'ui-btn ui-btn-icon h-7 w-7 rounded-md select-none',
                  configOpen ? 'ui-btn-active' : '',
                )}
              >
                <Settings2 size={14} />
              </button>
            )}

            <button
              ref={infoButtonRef}
              onClick={toggleInfo}
              title="Algorithm info"
              aria-label="Toggle algorithm info"
              className={cn(
                'ui-btn ui-btn-icon h-7 w-7 rounded-md select-none',
                showInfo ? 'ui-btn-active' : '',
              )}
            >
              <Info size={13} />
            </button>
          </div>

          {unifiedMode && (
            <>
              <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border-strong)]" />
              <TopBarControls />
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div className="ui-banner ui-banner-danger px-3 py-1.5">
          <p className="text-[10px] text-[var(--danger)] truncate">
            {loadError}
          </p>
        </div>
      )}

      {!loadError && loadWarning && (
        <div className="ui-banner ui-banner-warning px-3 py-1.5">
          <p className="text-[10px] text-[var(--warning)] truncate">
            {loadWarning}
          </p>
        </div>
      )}

      {showInfo && (
        <AlgoInfoPopover meta={meta} anchorRef={infoButtonRef} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
