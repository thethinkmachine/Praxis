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
  category: 'uninformed-search';
  displayName: string;
  icon: string;
  algorithms: AlgorithmEntry[];
}

const CATEGORIES: CategoryEntry[] = [
  {
    category: 'uninformed-search',
    displayName: 'Uninformed Search',
    icon: '🔍',
    algorithms: [
      { id: 'bfs', name: 'BFS', path: '/search/uninformed-search/bfs' },
      { id: 'dfs', name: 'DFS', path: '/search/uninformed-search/dfs' },
      { id: 'dls', name: 'Depth-Limited', path: '/search/uninformed-search/dls' },
      { id: 'iddfs', name: 'IDDFS', path: '/search/uninformed-search/iddfs' },
      { id: 'ucs', name: 'UCS', path: '/search/uninformed-search/ucs' },
      { id: 'bidirectional-bfs', name: 'Bidirectional BFS', path: '/search/uninformed-search/bidirectional-bfs' },
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
      className="flex flex-col h-full bg-[var(--surface)] border-r border-[var(--border)] overflow-hidden shrink-0"
    >
      {/* Logo row */}
      <div className="flex items-center h-11 px-3 border-b border-[var(--border)] shrink-0">
        <Link to="/" className="flex items-center flex-1 min-w-0 hover:opacity-80 transition-opacity">
          {sidebarCollapsed ? (
            /* Collapsed: tiny standalone graph ornament / "P" hint */
            <svg viewBox="0 0 24 24" width="22" height="22" aria-label="Praxis">
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
            <span className="font-bold text-sm text-[var(--text)]">
              Praxis
            </span>
          )}
        </Link>
        <button
          onClick={() => toggle('sidebarCollapsed')}
          className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors text-xs ml-1 shrink-0"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-thumb-[var(--border)]">
        {CATEGORIES.map((cat) => (
          <div key={cat.category} className="mb-1">
            {/* Category header */}
            <button
              onClick={() => handleCategoryClick(cat)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-2)] transition-colors',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <span className="text-base shrink-0" title={cat.displayName}>
                {cat.icon}
              </span>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider truncate"
                  >
                    {cat.displayName}
                  </motion.span>
                )}
              </AnimatePresence>
              {!sidebarCollapsed && (
                <span className="text-[var(--text-3)] text-xs">
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
                            'flex items-center pl-8 pr-3 py-1 text-sm transition-colors truncate',
                            isActive
                              ? 'text-[#58A6FF] bg-[#58A6FF]/10'
                              : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                          )
                        }
                      >
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
