import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { Sun, Moon, Keyboard, Info } from '@/components/shared/Icons';

const SEGMENT_LABELS: Record<string, string> = {
  search: 'Search',
  maze: 'Maze',
  taxonomy: 'Taxonomy',
  'uninformed-search': 'Uninformed',
  bfs: 'BFS', dfs: 'DFS', dls: 'Depth-Limited', iddfs: 'IDDFS',
  ucs: 'UCS',
  'bidirectional-bfs': 'Bidirectional BFS',
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

export default function TopBar() {
  const { pathname } = useLocation();
  const { darkMode, toggle } = usePreferencesStore();
  const crumbs = buildBreadcrumbs(pathname);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Close modals on Escape
  useEffect(() => {
    if (!showShortcuts && !showAbout) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowAbout(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showShortcuts, showAbout]);

  return (
    <>
      <header className={cn(
        'ide-titlebar flex items-center justify-between h-10 px-2 sm:px-3 shrink-0 gap-2'
      )}>

        {/* Breadcrumb */}
        <nav className="flex-1 min-w-0 flex items-center gap-1 text-xs text-[var(--text-2)] font-mono px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)]/70">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="text-[var(--text-3)]">/</span>}
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

        {/* Right side */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Dark / light toggle */}
          <button
            onClick={() => toggle('darkMode')}
            title={darkMode ? 'Switch to light mode (T)' : 'Switch to dark mode (T)'}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-transparent text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)] hover:border-[var(--border)] transition-colors"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] rounded-md px-2 py-1 bg-[var(--surface)]/80 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={12} />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>

          <button
            onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] rounded-md px-2 py-1 bg-[var(--surface)]/80 transition-colors"
            title="About Praxis"
          >
            <Info size={12} />
            <span className="hidden sm:inline">About</span>
          </button>
        </div>
      </header>

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b11]/70 backdrop-blur-[3px]"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className={cn(
              'relative w-full max-w-md mx-4',
              'ide-surface-elevated rounded-xl shadow-2xl',
              'overflow-hidden',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">Keyboard Shortcuts</h2>
                <p className="mt-0.5 text-xs text-[var(--text-2)]">Keyboard shortcuts for Praxis</p>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded',
                  'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                  'transition-colors text-base leading-none mt-0.5',
                )}
                aria-label="Close shortcuts"
              >
                &times;
              </button>
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
          </div>
        </div>
      )}

      {/* About modal */}
      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b11]/70 backdrop-blur-[3px]"
          onClick={() => setShowAbout(false)}
        >
          <div
            className={cn(
              'relative w-full max-w-sm mx-4',
              'ide-surface-elevated rounded-xl shadow-2xl',
              'overflow-hidden',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-2xl font-bold logo-font bg-gradient-to-r from-[#58A6FF] to-[#D2A8FF] bg-clip-text text-transparent">
                  Praxis
                </h2>
                <p className="mt-1 text-xs text-[var(--text-2)]">
                  Interactive AI Algorithm Visualization
                </p>
              </div>
              <button
                onClick={() => setShowAbout(false)}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded',
                  'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                  'transition-colors text-base leading-none mt-0.5',
                )}
                aria-label="Close about"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium w-16 shrink-0">Built by</span>
                  <span className="text-xs text-[var(--text)]">Shreyan Chaubey & Claude</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium w-16 shrink-0">License</span>
                  <span className="text-[11px] px-2 py-0.5 rounded border border-[#3FB950]/40 text-[#3FB950] bg-[#3FB950]/10 font-mono">
                    CC BY-NC-SA 4.0
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium w-16 shrink-0">GitHub</span>
                  <a
                    href="https://github.com/thethinkmachine"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#58A6FF] hover:underline font-mono"
                  >
                    github.com/thethinkmachine
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-[var(--border)] bg-[var(--surface-2)]/70">
              <p className="text-[10px] text-[var(--text-3)] text-center">
                Press <KbdKey>Esc</KbdKey> or click outside to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
