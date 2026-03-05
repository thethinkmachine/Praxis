import { useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useExecutionStore } from '@/store/execution.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/cn';
import { Activity, Zap, Layers, Target } from '@/components/shared/Icons';

export default function AppShell() {
  const darkMode = usePreferencesStore(s => s.darkMode);
  const toggle = usePreferencesStore(s => s.toggle);
  const { pathname } = useLocation();

  const isPlaying = useExecutionStore(s => s.isPlaying);
  const currentIndex = useExecutionStore(s => s.currentIndex);
  const totalSteps = useExecutionStore(s => s.totalSteps);
  const step = useExecutionStore(s => s.currentStep);

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
            <div className="flex items-center gap-4 overflow-hidden">
               <div className="flex items-center gap-1.5 shrink-0">
                 <div className={cn(
                   'w-2 h-2 rounded-full',
                   isPlaying ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-3)]'
                 )} />
                 <span className="uppercase tracking-wider">
                   {isPlaying ? 'Running' : (currentIndex >= totalSteps - 1 && totalSteps > 0) ? 'Finished' : 'Idle'}
                 </span>
               </div>
               <div className="w-px h-3 bg-[var(--border-strong)] shrink-0" />
               <span className="truncate opacity-70">workspace://praxis{pathname}</span>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {step && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[var(--accent)]" title="Step">
                    <Zap size={10} />
                    <span>{currentIndex + 1}/{totalSteps}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--warning)]" title="Frontier Size">
                    <Layers size={10} />
                    <span>F:{step.metrics.frontierSize}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--success)]" title="Nodes Expanded">
                    <Target size={10} />
                    <span>E:{step.metrics.nodesExpanded}</span>
                  </div>
                </div>
              )}
              <div className="hidden sm:flex items-center gap-1.5 opacity-60">
                <Activity size={10} />
                <span>Engine: Visual Trace</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
