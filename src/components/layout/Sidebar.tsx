import { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Search, Gamepad2, Network, ChevronRight } from '@/components/shared/Icons';

interface AlgorithmEntry {
  id: string;
  name: string;
  path: string;
}

interface CategoryEntry {
  category: 'uninformed-search' | 'informed-search' | 'local-search';
  displayName: string;
  icon: React.ReactNode;
  algorithms: AlgorithmEntry[];
}

const HOME_DESTINATIONS = [
  { id: 'algorithms', label: 'Algorithms', to: '/', icon: <Search size={14} /> },
  { id: 'games', label: 'Playgrounds', to: '/?tab=games', icon: <Gamepad2 size={14} /> },
  { id: 'graph', label: 'Graph', to: '/?tab=graph', icon: <Network size={14} /> },
] as const;

const CATEGORIES: CategoryEntry[] = [
  {
    category: 'uninformed-search',
    displayName: 'Uninformed Search',
    icon: <span className="text-[9px] font-mono font-semibold tracking-tight text-[var(--accent)]">DIR</span>,
    algorithms: [
      { id: 'bfs', name: 'BFS', path: '/search/uninformed-search/bfs' },
      { id: 'dfs', name: 'DFS', path: '/search/uninformed-search/dfs' },
      { id: 'dls', name: 'Depth-Limited', path: '/search/uninformed-search/dls' },
      { id: 'iddfs', name: 'IDDFS', path: '/search/uninformed-search/iddfs' },
      { id: 'ucs', name: 'UCS', path: '/search/uninformed-search/ucs' },
      { id: 'bidirectional-bfs', name: 'Bidirectional BFS', path: '/search/uninformed-search/bidirectional-bfs' },
      { id: 'bidirectional-ucs', name: 'Bidirectional UCS', path: '/search/uninformed-search/bidirectional-ucs' },
    ],
  },
  {
    category: 'informed-search',
    displayName: 'Informed Search',
    icon: <span className="text-[9px] font-mono font-semibold tracking-tight text-[var(--accent)]">H*</span>,
    algorithms: [
      { id: 'greedy-bfs', name: 'Greedy BFS', path: '/search/informed-search/greedy-bfs' },
      { id: 'astar', name: 'A* Search', path: '/search/informed-search/astar' },
      { id: 'rbfs', name: 'RBFS', path: '/search/informed-search/rbfs' },
      { id: 'sma-star', name: 'SMA*', path: '/search/informed-search/sma-star' },
      { id: 'smgs', name: 'SMGS', path: '/search/informed-search/smgs' },
      { id: 'bidirectional-astar', name: 'Bidirectional A*', path: '/search/informed-search/bidirectional-astar' },
      { id: 'weighted-astar', name: 'Weighted A*', path: '/search/informed-search/weighted-astar' },
      { id: 'ida-star', name: 'IDA*', path: '/search/informed-search/ida-star' },
    ],
  },
  {
    category: 'local-search',
    displayName: 'Local Search',
    icon: <span className="text-[9px] font-mono font-semibold tracking-tight text-[var(--accent)]">LS</span>,
    algorithms: [
      { id: 'random-walk', name: 'Random Walk', path: '/local/random-walk' },
      { id: 'hill-climbing-simple', name: 'Simple Hill', path: '/local/hill-climbing-simple' },
      { id: 'hill-climbing-steepest', name: 'Steepest Hill', path: '/local/hill-climbing-steepest' },
      { id: 'hill-climbing-first-choice', name: 'First-Choice Hill', path: '/local/hill-climbing-first-choice' },
      { id: 'hill-climbing-stochastic', name: 'Stochastic Hill', path: '/local/hill-climbing-stochastic' },
      { id: 'hill-climbing-sideways', name: 'Sideways Hill', path: '/local/hill-climbing-sideways' },
      { id: 'hill-climbing-random-restart', name: 'Restart Hill', path: '/local/hill-climbing-random-restart' },
      { id: 'simulated-annealing', name: 'Annealing', path: '/local/simulated-annealing' },
      { id: 'local-beam-search', name: 'Local Beam', path: '/local/local-beam-search' },
      { id: 'stochastic-beam-search', name: 'Stochastic Beam', path: '/local/stochastic-beam-search' },
      { id: 'tabu-search', name: 'Tabu Search', path: '/local/tabu-search' },
      { id: 'genetic-algorithm', name: 'Genetic Algorithm', path: '/local/genetic-algorithm' },
      { id: 'min-conflicts', name: 'Min-Conflicts', path: '/local/min-conflicts' },
    ],
  },
];

export default function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const homeTab = new URLSearchParams(search).get('tab') ?? 'algorithms';
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.category, true])),
  );

  function handleCategoryClick(cat: CategoryEntry) {
    if (!isHovered || pathname === '/') {
      navigate(`/?scroll=category-${cat.category}`);
      return;
    }
    setOpenCategories((prev) => ({ ...prev, [cat.category]: !prev[cat.category] }));
  }

  return (
    <aside
      style={{ width: isHovered ? 232 : 48 }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] transition-[width] duration-200 ease-in-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Nav — no dedicated header row; the toggle lives in HomeTitleStrip */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {/* Home destinations */}
        <div className="space-y-px">
          {HOME_DESTINATIONS.map((item) => {
            const isActive = pathname === '/' && homeTab === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                title={!isHovered ? item.label : undefined}
                className={cn(
                  'flex w-full items-center rounded-md text-[13px] font-medium transition-colors',
                  !isHovered ? 'h-8 justify-center' : 'gap-2.5 px-2.5 py-[7px]',
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
                )}
              >
                <span className={cn('shrink-0', isActive && 'text-[var(--accent)]')}>
                  {item.icon}
                </span>
                {isHovered && (
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
          {isHovered && (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
              Algorithms
            </p>
          )}

          {CATEGORIES.map((cat) => (
            <div key={cat.category}>
              <button
                onClick={() => handleCategoryClick(cat)}
                title={!isHovered ? cat.displayName : undefined}
                className={cn(
                  'flex w-full items-center rounded-md text-[13px] transition-colors text-left',
                  !isHovered ? 'h-8 justify-center' : 'gap-2.5 px-2.5 py-[7px]',
                  'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
                )}
              >
                <span className="shrink-0 flex items-center justify-center" style={{ minWidth: 14 }}>
                  {cat.icon}
                </span>
                {isHovered && (
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
                  isHovered && openCategories[cat.category] ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
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
          ))}
        </div>
      </nav>
    </aside>
  );
}
