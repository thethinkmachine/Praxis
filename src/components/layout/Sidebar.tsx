import { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/usePreferencesStore';

interface AlgorithmEntry {
  id: string;
  name: string;
  path: string;
}

interface CategoryEntry {
  category: 'uninformed-search' | 'informed-search';
  displayName: string;
  icon: string;
  algorithms: AlgorithmEntry[];
}

const CATEGORIES: CategoryEntry[] = [
  {
    category: 'uninformed-search',
    displayName: 'Uninformed Search',
    icon: 'DIR',
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
    icon: 'H*',
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
  const { pathname } = useLocation();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.category, true]))
  );

  function handleCategoryClick(cat: CategoryEntry) {
    if (sidebarCollapsed) {
      // When collapsed, navigate to homepage and scroll to the category
      navigate(`/?scroll=category-${cat.category}`);
    } else if (pathname === '/') {
      // When expanded and already on homepage, scroll to the category
      const el = document.getElementById(`category-${cat.category}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Also toggle the accordion
      setOpenCategories((prev) => ({ ...prev, [cat.category]: !prev[cat.category] }));
    } else {
      // On another page, just toggle accordion
      setOpenCategories((prev) => ({ ...prev, [cat.category]: !prev[cat.category] }));
    }
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 48 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col h-full bg-[var(--titlebar)] border-r border-[var(--border-strong)] overflow-hidden shrink-0"
    >
      {/* Logo row */}
      <div className="flex items-center h-10 px-2.5 border-b border-[var(--border)] shrink-0 ide-titlebar">
        <Link to="/" className="flex items-center flex-1 min-w-0 hover:opacity-85 transition-opacity">
          {sidebarCollapsed ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-label="Praxis">
              <defs>
                <linearGradient id="slg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#58A6FF" />
                  <stop offset="100%" stopColor="#D2A8FF" />
                </linearGradient>
              </defs>
              <circle cx="7"  cy="5"  r="2.5" fill="url(#slg)" />
              <circle cx="17" cy="12" r="2"   fill="url(#slg)" />
              <circle cx="8"  cy="19" r="2"   fill="url(#slg)" />
              <line x1="7"  y1="5"  x2="17" y2="12" stroke="url(#slg)" strokeWidth="1.2" />
              <line x1="17" y1="12" x2="8"  y2="19" stroke="url(#slg)" strokeWidth="1.2" />
              <line x1="7"  y1="5"  x2="8"  y2="19" stroke="url(#slg)" strokeWidth="1.2" strokeDasharray="2 1.5" />
            </svg>
          ) : (
            <div className="min-w-0">
              <p className="font-semibold text-xs text-[var(--text)] tracking-wide uppercase">Praxis</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => toggle('sidebarCollapsed')}
          className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors text-xs ml-1 shrink-0 w-6 h-6 rounded border border-transparent hover:border-[var(--border)]"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]/70">
          <p className="ide-title text-[var(--text-3)]">Explorer</p>
          <p className="text-[11px] text-[var(--text-2)] mt-1 truncate font-mono">src/algorithms/search</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-thumb-[var(--border)]">
        <div className="mb-2 px-1">
          <NavLink
            to="/maze"
            className={({ isActive }) => cn(
              'mx-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md border-l-2 border-transparent text-[12px] font-mono transition-colors',
              isActive
                ? 'text-[var(--accent)] bg-[var(--accent-soft)] border-l-[var(--accent)]'
                : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/60',
              sidebarCollapsed && 'justify-center px-1',
            )}
          >
            <span className="text-[10px] text-[var(--text-3)]">app</span>
            {!sidebarCollapsed && <span>Maze Lab</span>}
          </NavLink>
        </div>

        {CATEGORIES.map((cat) => (
          <div key={cat.category} className="mb-1">
            {/* Category header */}
            <button
              onClick={() => handleCategoryClick(cat)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-2)]/70 transition-colors',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)] bg-[var(--surface-2)] shrink-0 font-mono" title={cat.displayName}>
                {cat.icon}
              </span>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-[11px] font-semibold text-[var(--text-2)] uppercase tracking-wide truncate"
                  >
                    {cat.displayName}
                  </motion.span>
                )}
              </AnimatePresence>
              {!sidebarCollapsed && (
                <span className="text-[var(--text-3)] text-[10px]">
                  {openCategories[cat.category] ? '▾' : '▸'}
                </span>
              )}
            </button>

            {/* Algorithm list */}
            <AnimatePresence initial={false}>
              {openCategories[cat.category] && !sidebarCollapsed && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  {cat.algorithms.map((algo) => (
                    <li key={algo.id}>
                      <NavLink
                        to={algo.path}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2 pl-7 pr-3 py-1.5 text-[12px] transition-colors truncate font-mono rounded-r-md border-l-2 border-transparent mx-1',
                            isActive
                              ? 'text-[var(--accent)] bg-[var(--accent-soft)] border-l-[var(--accent)]'
                              : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/60'
                          )
                        }
                      >
                        <span className="text-[9px] text-[var(--text-3)]">fn</span>
                        {algo.name}
                      </NavLink>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        ))}
      </nav>

    </motion.aside>
  );
}
