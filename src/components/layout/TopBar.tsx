import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { Sun, Moon, Keyboard, Info, X, Maximize2, Minimize2 } from '@/components/shared/Icons';

const SEGMENT_LABELS: Record<string, string> = {
  search: 'Search',
  play: 'Play',
  maze: 'Maze',
  taxonomy: 'Taxonomy',
  'uninformed-search': 'Uninformed',
  'informed-search': 'Informed',
  'game-playing': 'Game Playing',
  'local-search': 'Local Search',
  bfs: 'BFS', dfs: 'DFS', dls: 'Depth-Limited', iddfs: 'IDDFS',
  ucs: 'UCS',
  'bidirectional-bfs': 'Bidirectional BFS',
  'bidirectional-ucs': 'Bidirectional UCS',
  rbfs: 'RBFS',
  'sma-star': 'SMA*',
  'bidirectional-astar': 'Bidirectional A*',
  minimax: 'Minimax',
  'alpha-beta': 'Alpha-Beta',
  negamax: 'Negamax',
  local: 'Local Search',
  'random-walk': 'Random Walk',
  'hill-climbing-simple': 'Simple Hill',
  'hill-climbing-steepest': 'Steepest Hill',
  'hill-climbing-first-choice': 'First-Choice Hill',
  'hill-climbing-stochastic': 'Stochastic Hill',
  'hill-climbing-sideways': 'Sideways Hill',
  'hill-climbing-random-restart': 'Restart Hill',
  'simulated-annealing': 'Annealing',
  'local-beam-search': 'Local Beam',
  'stochastic-beam-search': 'Stochastic Beam',
  'tabu-search': 'Tabu Search',
  'genetic-algorithm': 'Genetic Algorithm',
  'min-conflicts': 'Min-Conflicts',
};

interface ShortcutEntry {
  key: string;
  label: string;
}

interface ShortcutSection {
  heading: string;
  items: ShortcutEntry[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    heading: 'Playback',
    items: [
      { key: 'Space', label: 'Play / Pause' },
      { key: '\u2190', label: 'Step backward' },
      { key: '\u2192', label: 'Step forward' },
      { key: 'Home', label: 'Jump to start' },
      { key: 'End', label: 'Jump to end' },
      { key: 'R', label: 'Reset algorithm' },
      { key: '1\u20136', label: 'Speed presets' },
    ],
  },
  {
    heading: 'Navigation',
    items: [
      { key: '/', label: 'Search algorithms' },
      { key: 'S', label: 'Toggle sidebar' },
      { key: 'T', label: 'Toggle theme' },
      { key: 'F', label: 'Toggle Fullscreen' },
    ],
  },
  {
    heading: 'Panels',
    items: [
      { key: 'P', label: 'Toggle pseudocode' },
      { key: 'M', label: 'Toggle metrics' },
      { key: 'I', label: 'Toggle state inspector' },
      { key: '[ / ]', label: 'Switch tabs' },
    ],
  },
  {
    heading: 'Graph Editing',
    items: [
      { key: 'N', label: 'Add node mode' },
      { key: 'E', label: 'Add edge mode' },
      { key: 'D', label: 'Delete mode' },
      { key: 'V', label: 'Select mode' },
      { key: 'F', label: 'Fit graph to view' },
    ],
  },
];

interface Crumb { label: string; path: string }

function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Home', path: '/' }];

  const crumbs: Crumb[] = [{ label: 'Home', path: '/' }];
  let accumulated = '';
  for (const seg of segments) {
    accumulated += `/${seg}`;
    crumbs.push({ label: SEGMENT_LABELS[seg] ?? seg, path: accumulated });
  }
  return crumbs;
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.75rem] h-[1.5rem] px-1.5',
        'font-mono text-[11px] font-medium',
        'bg-[var(--surface-2)] text-[var(--text)]',
        'border border-[var(--border)] border-b-2',
        'rounded-md shadow-sm',
        'select-none leading-none',
      )}
    >
      {children}
    </kbd>
  );
}

/** Utility toolbar buttons (theme, fullscreen, shortcuts, about) — used by both
 *  the standalone TopBar on non-algorithm pages and the unified header on algorithm pages. */
export function TopBarControls() {
  const { darkMode, toggle } = usePreferencesStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message}`));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync state if user uses F11 or Esc
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Dark / light toggle */}
      <button
        onClick={() => toggle('darkMode')}
        title={darkMode ? 'Switch to light mode (T)' : 'Switch to dark mode (T)'}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-transparent text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)] hover:border-[var(--border)] transition-colors"
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-transparent text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)] hover:border-[var(--border)] transition-colors"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <button
        onClick={() => setShowShortcuts(true)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface)]/70 hover:text-[var(--text)]"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={12} />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>

      <button
        onClick={() => setShowAbout(true)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface)]/70 hover:text-[var(--text)]"
        title="About Praxis"
      >
        <Info size={12} />
        <span className="hidden sm:inline">About</span>
      </button>

      {/* Shortcuts modal */}
      <Dialog.Root open={showShortcuts} onOpenChange={setShowShortcuts}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#060b11]/70 backdrop-blur-[3px] animate-in fade-in duration-200" />
          <Dialog.Content
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-md mx-4',
              'ide-surface-elevated rounded-xl shadow-2xl overflow-hidden',
              'animate-in zoom-in-95 fade-in duration-200',
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div>
                <Dialog.Title className="text-sm font-semibold text-[var(--text)]">Keyboard Shortcuts</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[var(--text-2)]">Keyboard shortcuts for Praxis</Dialog.Description>
              </div>
              <Dialog.Close
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded',
                  'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                  'transition-colors text-base leading-none mt-0.5',
                )}
                aria-label="Close shortcuts"
              >
                <X size={14} />
              </Dialog.Close>
            </div>

            {/* Sections */}
            <div className="px-5 pb-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {SHORTCUT_SECTIONS.map((section) => (
                <div key={section.heading}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-2">
                    {section.heading}
                  </p>
                  <div className="space-y-1">
                    {section.items.map(({ key, label }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-4 py-0.5"
                      >
                        <span className="text-xs text-[var(--text-2)]">{label}</span>
                        <KbdKey>{key}</KbdKey>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-[var(--border)] bg-[var(--surface-2)]/70">
              <p className="text-[10px] text-[var(--text-3)] text-center">
                Press <KbdKey>Esc</KbdKey> or click outside to close
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* About modal */}
      <Dialog.Root open={showAbout} onOpenChange={setShowAbout}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#060b11]/70 backdrop-blur-[3px] animate-in fade-in duration-200" />
          <Dialog.Content
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-sm mx-4',
              'ide-surface-elevated rounded-xl shadow-2xl overflow-hidden',
              'animate-in zoom-in-95 fade-in duration-200',
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div>
                <Dialog.Title className="text-2xl font-bold logo-font bg-gradient-to-r from-[#58A6FF] to-[#D2A8FF] bg-clip-text text-transparent">
                  Praxis
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-[var(--text-2)]">
                  Interactive AI Algorithm Visualization
                </Dialog.Description>
              </div>
              <Dialog.Close
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded',
                  'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                  'transition-colors text-base leading-none mt-0.5',
                )}
                aria-label="Close about"
              >
                <X size={14} />
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="px-5 pb-5 space-y-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-3">
                <p className="text-sm text-[var(--text)] leading-relaxed">
                  Praxis is an interactive playground for studying and comparing classical AI algorithms through visual execution traces, rich graph editors, and game-oriented labs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Focus</p>
                  <p className="mt-1 text-xs text-[var(--text-2)]">Search, game playing, and local search</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Mode</p>
                  <p className="mt-1 text-xs text-[var(--text-2)]">Visualization-first learning</p>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export default function TopBar() {
  const { pathname } = useLocation();
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <header className={cn(
      'ide-titlebar flex items-center justify-between h-10 px-3 sm:px-4 shrink-0 gap-3'
    )}>
      <nav className="flex-1 min-w-0 flex items-center gap-1 text-[11px] text-[var(--text-3)] font-mono">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <span className="text-[var(--text-3)]"> / </span>}
            {i === crumbs.length - 1 ? (
              <span className="text-[var(--text)] truncate">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-1 shrink-0">
        <TopBarControls />
      </div>
    </header>
  );
}
