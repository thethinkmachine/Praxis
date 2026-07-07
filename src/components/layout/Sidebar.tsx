import { useMemo, useState } from 'react';
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
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] transition-[width] duration-200 ease-in-out"
    >
      {/* Collapse/expand toggle — pinned to the rail it controls, not a distant title strip */}
      <div className={cn('flex shrink-0 items-center px-2 pt-2', isExpanded ? 'justify-end' : 'justify-center')}>
        <button
          onClick={() => toggleSidebar('sidebarCollapsed')}
          title={sidebarCollapsed ? 'Expand sidebar (S)' : 'Collapse sidebar (S)'}
          aria-label="Toggle sidebar"
          className={cn(
            'ui-btn ui-btn-ghost ui-btn-icon h-7 w-7 rounded-md select-none shrink-0',
            isExpanded && 'ui-btn-active',
          )}
        >
          <PanelLeft size={15} />
        </button>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
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
        <div className="space-y-px">
          {isExpanded && (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
              Algorithms
            </p>
          )}

          {categories.map((cat) => {
            const CategoryIcon = CATEGORY_ICONS[cat.category];
            return (
              <div key={cat.category}>
                <button
                  onClick={() => handleCategoryClick(cat.category)}
                  title={!isExpanded ? cat.displayName : undefined}
                  className={cn(
                    'flex w-full items-center rounded-md text-[13px] transition-colors text-left',
                    !isExpanded ? 'h-8 justify-center' : 'gap-2.5 px-2.5 py-[7px]',
                    'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
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
      </nav>
    </aside>
  );
}
