import { useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function AppShell() {
  const darkMode = usePreferencesStore(s => s.darkMode);
  const toggle = usePreferencesStore(s => s.toggle);
  const { pathname } = useLocation();

  // Apply/remove data-theme on the <html> element so that the CSS rule
  //   :root[data-theme="light"] { ... }
  // can actually override the default dark-mode CSS custom properties.
  // Putting data-theme on a <div> does NOT work because :root targets <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onToggleSidebar: useCallback(() => toggle('sidebarCollapsed'), [toggle]),
    onToggleTheme: useCallback(() => toggle('darkMode'), [toggle]),
    onTogglePseudocode: useCallback(() => toggle('pseudocodeVisible'), [toggle]),
    onToggleMetrics: useCallback(() => toggle('metricsVisible'), [toggle]),
    onToggleStatePanel: useCallback(() => toggle('statePanelVisible'), [toggle]),
  });

  return (
    <div className="h-screen bg-[var(--bg)] overflow-hidden p-1 sm:p-2">
      <div className="ide-surface-elevated h-full rounded-xl overflow-hidden flex">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 ide-grid-bg opacity-[0.18] pointer-events-none" />
            <div className="relative z-10 h-full">
              <Outlet />
            </div>
          </main>

          <footer className="ide-statusbar h-7 px-3 flex items-center justify-between text-[10px] font-mono text-[var(--text-2)] shrink-0">
            <span className="truncate">workspace://praxis{pathname}</span>
            <div className="hidden sm:flex items-center gap-3">
              <span>Mode: {darkMode ? 'Dark' : 'Light'}</span>
              <span>Engine: Visual Trace</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
