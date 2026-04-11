import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { Sun, Moon, Keyboard, Info, Maximize2, Minimize2 } from '@/components/shared/Icons';
import DialogHeader from '@/components/shared/DialogHeader';
import SurfaceCard from '@/components/shared/SurfaceCard';
import { getNavigationSegmentLabel } from '@/lib/navigation';

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
      { key: 'Ctrl/Cmd+K', label: 'Open algorithm search' },
      { key: 'S', label: 'Toggle sidebar' },
      { key: 'T', label: 'Toggle theme' },
      { key: 'F', label: 'Toggle Fullscreen' },
    ],
  },
  {
    heading: 'Panels',
    items: [
      { key: 'C', label: 'Toggle configuration' },
      { key: 'P', label: 'Toggle pseudocode' },
      { key: 'M', label: 'Toggle metrics' },
      { key: 'I', label: 'Toggle state inspector' },
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
    crumbs.push({ label: getNavigationSegmentLabel(seg), path: accumulated });
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
        className="ui-btn ui-btn-ghost ui-btn-icon h-8 rounded-md"
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
        className="ui-btn ui-btn-ghost ui-btn-icon h-8 rounded-md"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <button
        onClick={() => setShowShortcuts(true)}
        className="ui-btn ui-btn-ghost h-8 rounded-md px-2 text-[11px]"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={12} />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>

      <button
        onClick={() => setShowAbout(true)}
        className="ui-btn ui-btn-ghost h-8 rounded-md px-2 text-[11px]"
        title="About Praxis"
      >
        <Info size={12} />
        <span className="hidden sm:inline">About</span>
      </button>

      {/* Shortcuts modal */}
      <Dialog.Root open={showShortcuts} onOpenChange={setShowShortcuts}>
        <Dialog.Portal>
          <Dialog.Overlay className="ui-overlay fixed inset-0 z-50 animate-in fade-in duration-200" />
          <Dialog.Content
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-md mx-4',
              'ui-panel-elevated rounded-xl overflow-hidden',
              'animate-in zoom-in-95 fade-in duration-200',
            )}
          >
            <DialogHeader title="Keyboard Shortcuts" description="Keyboard shortcuts for Praxis" closeLabel="Close shortcuts" />

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
          <Dialog.Overlay className="ui-overlay fixed inset-0 z-50 animate-in fade-in duration-200" />
          <Dialog.Content
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-sm mx-4',
              'ui-panel-elevated rounded-xl overflow-hidden',
              'animate-in zoom-in-95 fade-in duration-200',
            )}
          >
            <DialogHeader
              title="Praxis"
              description="Symbolic AI Algorithm Library & Playground"
              closeLabel="Close about"
              titleClassName="text-4xl font-bold font-mono tracking-tight text-[var(--text)]"
            />

            {/* Body */}
            <div className="px-5 pb-5 space-y-4">
              <SurfaceCard tone="muted" padding="sm" className="rounded-lg">
                <p className="text-sm text-[var(--text)] leading-relaxed">
                  Praxis aims to be a GOFAI playground and a comprehensive, continuously expanding algorithm library.
                </p>
              </SurfaceCard>

              <SurfaceCard tone="muted" padding="sm" className="rounded-lg space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Author</p>
                <p className="text-sm font-medium text-[var(--text)]">Shreyan Chaubey</p>
                <p className="text-[11px] text-[var(--text-3)]">
                  License:{' '}
                  <span className="font-mono text-[var(--text-2)]">CC-BY-NC-SA 4.0</span>
                </p>
                <a
                  href="https://github.com/thethinkmachine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                >
                  github.com/thethinkmachine
                </a>
              </SurfaceCard>
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
