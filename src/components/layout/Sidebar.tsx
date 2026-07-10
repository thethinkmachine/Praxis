import { useMemo, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Search, Gamepad2, Network, ChevronRight, PanelLeft } from '@/components/shared/Icons';
import {
  UninformedSearchIcon, InformedSearchIcon, GamePlayingIcon,
  LocalSearchIcon, PlanningIcon, ConstraintSatisfactionIcon,
} from '@/components/shared/CategoryIcons';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { HOME_DESTINATIONS, getNavigationCategoryGroups } from '@/lib/navigation';
import type { AlgorithmCategory } from '@/types';

function renderHomeDestinationIcon(icon: 'search' | 'gamepad2' | 'network') {
  if (icon === 'gamepad2') return <Gamepad2 size={14} />;
  if (icon === 'network') return <Network size={14} />;
  return <Search size={14} />;
}

const CATEGORY_ICONS: Record<AlgorithmCategory, typeof UninformedSearchIcon> = {
  'uninformed-search': UninformedSearchIcon,
  'informed-search': InformedSearchIcon,
  'game-playing': GamePlayingIcon,
  'local-search': LocalSearchIcon,
  'planning': PlanningIcon,
  'constraint-satisfaction': ConstraintSatisfactionIcon,
};

function SidebarTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          align="center"
          sideOffset={8}
          className="z-[120] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text)] shadow-lg backdrop-blur-md"
        >
          {label}
          <Tooltip.Arrow className="fill-[var(--surface)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const sidebarCollapsed = usePreferencesStore((state) => state.sidebarCollapsed);
  const toggleSidebar = usePreferencesStore((state) => state.toggle);
  const homeTab = new URLSearchParams(search).get('tab') ?? 'algorithms';
  const categories = useMemo(() => getNavigationCategoryGroups(), []);
  const [rawOpenCategories, setRawOpenCategories] = useState<Record<string, boolean>>({});
  const isExpanded = !sidebarCollapsed;
  const openCategories = useMemo(() => ({
    ...Object.fromEntries(categories.map((category) => [category.category, true])),
    ...rawOpenCategories,
  }), [categories, rawOpenCategories]);

  function handleCategoryClick(categoryId: string) {
    if (!isExpanded || pathname === '/') {
      navigate(`/?scroll=category-${categoryId}`);
      return;
    }
    setRawOpenCategories((prev) => ({ ...prev, [categoryId]: !openCategories[categoryId] }));
  }

  return (
    <aside
      style={{ width: isExpanded ? 232 : 48 }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-in-out"
    >
      {/* Collapse/expand toggle — same height/border/background as the title strip beside it,
          so the two form one continuous bar instead of two boxes glued together. The toggle's
          own cell stays a fixed 48px (matching the collapsed rail) instead of stretching to the
          expanded width, and the leftover space is filled with the wordmark rather than left
          empty. The vertical divider only starts below, on <nav>, not up here. */}
      <div className="relative z-20 flex h-12 shrink-0 items-center border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center">
          <button
            onClick={() => toggleSidebar('sidebarCollapsed')}
            title={sidebarCollapsed ? 'Expand sidebar (S)' : 'Collapse sidebar (S)'}
            aria-label="Toggle sidebar"
            className={cn(
              'ui-btn ui-btn-ghost ui-btn-icon h-7 w-7 rounded-md select-none',
              isExpanded && 'ui-btn-active',
            )}
          >
            <PanelLeft size={15} />
          </button>
        </div>
        {isExpanded && (
          <Link
            to="/"
            className="truncate pr-3 font-mono text-lg font-extrabold tracking-tight text-[var(--accent)] transition-opacity hover:opacity-80"
          >
            Praxis
          </Link>
        )}
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden border-r border-[var(--border)] px-2 py-3">
        {/* Home destinations */}
        <div className="space-y-px">
          {HOME_DESTINATIONS.map((item) => {
            const isActive = pathname === '/' && homeTab === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                title={!isExpanded ? item.label : undefined}
                className={cn(
                  'flex w-full items-center rounded-md text-[13px] font-medium transition-colors',
                  !isExpanded ? 'h-8 justify-center' : 'gap-2.5 px-2.5 py-[7px]',
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
                )}
              >
                <span className={cn('shrink-0', isActive && 'text-[var(--accent)]')}>
                  {renderHomeDestinationIcon(item.icon)}
                </span>
                {isExpanded && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-[var(--border)]" />

        {/* Algorithm categories */}
        <Tooltip.Provider delayDuration={180} skipDelayDuration={80}>
        <div className="space-y-px">
          {isExpanded && (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
              Algorithms
            </p>
          )}

          {categories.map((cat) => {
            const CategoryIcon = CATEGORY_ICONS[cat.category];
            const categoryButton = (
              <button
                onClick={() => handleCategoryClick(cat.category)}
                aria-label={cat.displayName}
                className={cn(
                  'flex w-full items-center rounded-md text-[13px] transition-colors text-left',
                  !isExpanded ? 'h-8 justify-center' : 'gap-2.5 px-2.5 py-[7px]',
                  'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20',
                )}
              >
                <span className="shrink-0 flex items-center justify-center text-[var(--accent)]" style={{ minWidth: 14 }}>
                  <CategoryIcon size={14} />
                </span>
                {isExpanded && (
                  <>
                    <span className="flex-1 truncate font-medium">{cat.displayName}</span>
                    <ChevronRight
                      size={12}
                      className={cn(
                        'shrink-0 text-[var(--text-3)] transition-transform',
                        openCategories[cat.category] && 'rotate-90',
                      )}
                    />
                  </>
                )}
              </button>
            );
            return (
              <div key={cat.category}>
                {isExpanded ? categoryButton : <SidebarTip label={cat.displayName}>{categoryButton}</SidebarTip>}

                <div
                  key={cat.category + '-collapse'}
                  className={cn(
                    'grid transition-[grid-template-rows] duration-150 ease-in-out',
                    isExpanded && openCategories[cat.category] ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-5 mt-px border-l border-[var(--border)] pl-3 pb-1">
                      {cat.algorithms.map((algo) => (
                        <NavLink
                          key={algo.id}
                          to={algo.path}
                          className={({ isActive }) => cn(
                            'flex items-center rounded-md px-2 py-1.5 text-[12px] font-mono transition-colors',
                            isActive
                              ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                              : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]',
                          )}
                        >
                          <span className="truncate">{algo.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </Tooltip.Provider>
      </nav>
    </aside>
  );
}
