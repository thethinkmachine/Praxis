import { useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function AppShell() {
  const darkMode = usePreferencesStore(s => s.darkMode);
  const toggle = usePreferencesStore(s => s.toggle);

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
    <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
