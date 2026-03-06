import { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { Search, Gamepad2, Network, ChevronLeft, ChevronRight } from '@/components/shared/Icons';

interface AlgorithmEntry {
  id: string;
  name: string;
  path: string;
}

interface CategoryEntry {
  category: 'uninformed-search' | 'informed-search';
  displayName: string;
  hint: string;
  icon: React.ReactNode;
  algorithms: AlgorithmEntry[];
}

const HOME_DESTINATIONS = [
  { id: 'algorithms', label: 'Algorithms', to: '/', icon: <Search size={15} /> },
  { id: 'games', label: 'Games', to: '/?tab=games', icon: <Gamepad2 size={15} /> },
  { id: 'graph', label: 'Relationship Graph', to: '/?tab=graph', icon: <Network size={15} /> },
] as const;

const CATEGORIES: CategoryEntry[] = [
  {
    category: 'uninformed-search',
    displayName: 'Uninformed Search',
    hint: 'Level order, depth-first, and cost-blind baselines',
    icon: <span className="text-[10px] font-mono uppercase tracking-[0.18em]">DIR</span>,
    algorithms: [
      { id: 'bfs', name: 'BFS', path: '/search/uninformed-search/bfs' },
      { id: 'dfs', name: 'DFS', path: '/search/uninformed-search/dfs' },
      { id: 'dls', name: 'Depth-Limited', path: '/search/uninformed-search/dls' },
      { id: 'iddfs', name: 'IDDFS', path: '/search/uninformed-search/iddfs' },
      { id: 'ucs', name: 'UCS', path: '/search/uninformed-search/ucs' },
      { id: 'bidirectional-bfs', name: 'Bidirectional BFS', path: '/search/uninformed-search/bidirectional-bfs' },
    ],
  },
  {
    category: 'informed-search',
    displayName: 'Informed Search',
    hint: 'Heuristic-guided strategies and A* variants',
    icon: <span className="text-[10px] font-mono uppercase tracking-[0.18em]">H*</span>,
    algorithms: [
      { id: 'greedy-bfs', name: 'Greedy BFS', path: '/search/informed-search/greedy-bfs' },
      { id: 'astar', name: 'A* Search', path: '/search/informed-search/astar' },
      { id: 'weighted-astar', name: 'Weighted A*', path: '/search/informed-search/weighted-astar' },
      { id: 'ida-star', name: 'IDA*', path: '/search/informed-search/ida-star' },
    ],
  },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggle } = usePreferencesStore();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const homeTab = new URLSearchParams(search).get('tab') ?? 'algorithms';
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((category) => [category.category, true])),
  );

  function handleCategoryClick(cat: CategoryEntry) {
    if (sidebarCollapsed || pathname === '/') {
      navigate(`/?scroll=category-${cat.category}`);
      return;
    }

    setOpenCategories((prev) => ({ ...prev, [cat.category]: !prev[cat.category] }));
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 68 : 292 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="flex flex-col h-full bg-[var(--titlebar)] border-r border-[var(--border-strong)] overflow-hidden shrink-0"
    >
      <div
        className={cn(
          'flex items-center h-12 border-b border-[var(--border)] shrink-0 ide-titlebar transition-all',
          sidebarCollapsed ? 'justify-center px-0' : 'px-3',
        )}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] text-[11px] font-mono">
              PX
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-[var(--text)] tracking-wide truncate">Praxis</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-3)] truncate">Navigation Console</p>
            </div>
          </div>
        )}
        <button
          onClick={() => toggle('sidebarCollapsed')}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]',
            !sidebarCollapsed && 'ml-2',
          )}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="px-3 py-3 border-b border-[var(--border)] bg-[var(--surface)]/65">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Quick Access</p>
          <p className="mt-1 text-xs text-[var(--text-2)]">Jump between the algorithm index, game labs, the relationship map, and live workspaces.</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className="px-2 space-y-1.5">
          {HOME_DESTINATIONS.map((item) => {
            const isActive = pathname === '/' && homeTab === item.id;

            return (
              <Link
                key={item.id}
                to={item.to}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  isActive
                    ? 'border-[var(--accent)]/45 bg-[var(--accent-soft)] text-[var(--text)]'
                    : 'border-transparent text-[var(--text-2)] hover:border-[var(--border)] hover:bg-[var(--surface)]',
                  sidebarCollapsed && 'justify-center px-0',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{item.label}</span>
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)] truncate">
                      Home module
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 px-2">
          {!sidebarCollapsed && (
            <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">
              Search Families
            </p>
          )}

          {CATEGORIES.map((cat) => (
            <div key={cat.category} className="mb-2">
              <button
                onClick={() => handleCategoryClick(cat)}
                title={sidebarCollapsed ? cat.displayName : undefined}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors',
                  'hover:bg-[var(--surface)] hover:border-[var(--border)]',
                  sidebarCollapsed && 'justify-center px-0',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]">
                  {cat.icon}
                </span>
                {!sidebarCollapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--text)] truncate">{cat.displayName}</span>
                      <span className="block text-[11px] text-[var(--text-3)] truncate">{cat.hint}</span>
                    </span>
                    <ChevronRight
                      size={15}
                      className={cn(
                        'shrink-0 text-[var(--text-3)] transition-transform',
                        openCategories[cat.category] && 'rotate-90',
                      )}
                    />
                  </>
                )}
              </button>

              <AnimatePresence initial={false}>
                {!sidebarCollapsed && openCategories[cat.category] && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="overflow-hidden pl-3 pr-1 pt-1"
                  >
                    {cat.algorithms.map((algo) => (
                      <li key={algo.id}>
                        <NavLink
                          to={algo.path}
                          className={({ isActive }) => cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-mono transition-colors',
                            isActive
                              ? 'bg-[var(--accent-soft)] text-[var(--text)] border-[var(--accent)]/35'
                              : 'border-transparent text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
                          )}
                        >
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">fn</span>
                          <span className="truncate">{algo.name}</span>
                        </NavLink>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </nav>
    </motion.aside>
  );
}
