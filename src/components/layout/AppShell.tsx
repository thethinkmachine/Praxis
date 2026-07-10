import { useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import TerminalPanel from '../module/TerminalPanel';
import { cn } from '@/lib/cn';
import { rememberRecentLocation } from '@/lib/recently-opened';

export default function AppShell() {
  const darkMode = usePreferencesStore(s => s.darkMode);
  const terminalExpanded = usePreferencesStore(s => s.terminalExpanded);
  const toggle = usePreferencesStore(s => s.toggle);
  const setPreference = usePreferencesStore(s => s.set);
  const { pathname, search } = useLocation();
  const isAlgoPage = /^\/(?:search|play|local|maze|planning|csp)\//.test(pathname);
  const showStandaloneTopBar = pathname !== '/' && !isAlgoPage;
  const lastPathname = useRef(pathname);

  // Auto-collapse sidebar on smaller screens or when entering an algorithm page
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    const isEnteringAlgoPage = isAlgoPage && !/^\/(?:search|play|local|maze)\//.test(lastPathname.current);

    if (isMobile || isEnteringAlgoPage) {
      setPreference('sidebarCollapsed', true);
    }
    
    lastPathname.current = pathname;
  }, [pathname, isAlgoPage, setPreference]);

  useEffect(() => {
    rememberRecentLocation(pathname, search);
  }, [pathname, search]);

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
    onToggleConfig: useCallback(() => toggle('configVisible'), [toggle]),
    onToggleOutput: useCallback(() => toggle('terminalExpanded'), [toggle]),
  });

  return (
    <div className="h-screen bg-[var(--bg)] overflow-hidden p-1 sm:p-2">
      <div className="ide-surface-elevated h-full rounded-xl overflow-hidden flex">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          {showStandaloneTopBar && <TopBar />}
          <main className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 ide-grid-bg opacity-[0.18] pointer-events-none" />
            <div className="relative z-10 h-full">
              <Outlet />
            </div>
          </main>

          {/* Integrated Terminal Drawer — CSS grid-rows collapse, always mounted */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-[220ms] ease-in-out overflow-hidden border-t border-[var(--border)] bg-[var(--surface)]',
              terminalExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="h-[180px]">
                <TerminalPanel />
              </div>
            </div>
          </div>
 
          <StatusBar isAlgoRoute={isAlgoPage} />
        </div>
      </div>
    </div>
  );
}
