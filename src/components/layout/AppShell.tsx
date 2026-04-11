import { useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useExecutionStore } from '@/store/execution.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import TerminalPanel from '../module/TerminalPanel';
import { cn } from '@/lib/cn';
import { Zap, Layers, Target, Terminal } from '@/components/shared/Icons';

function LatestLogDisplay() {
  const lastLog = useExecutionStore(s => s.logs.length > 0 ? s.logs[s.logs.length - 1] : null);

  if (!lastLog) {
    return <span className="opacity-40 italic">Ready</span>;
  }

  return (
    <span className={cn(
      "opacity-90",
      lastLog.level === 'success' && 'text-[var(--success)]',
      lastLog.level === 'warn' && 'text-[var(--warning)]',
      lastLog.level === 'error' && 'text-[var(--danger)]'
    )}>
      <span className="opacity-50 mr-2">[{new Date(lastLog.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}]</span>
      {lastLog.message}
    </span>
  );
}

function StatusBar() {
  const terminalExpanded = usePreferencesStore(s => s.terminalExpanded);
  const toggle = usePreferencesStore(s => s.toggle);

  const isPlaying = useExecutionStore(s => s.isPlaying);
  const currentIndex = useExecutionStore(s => s.currentIndex);
  const totalSteps = useExecutionStore(s => s.totalSteps);
  const step = useExecutionStore(s => s.currentStep);

  return (
    <footer 
      onClick={() => toggle('terminalExpanded')}
      className="ide-statusbar h-7 px-3 flex items-center justify-between text-[10px] font-mono text-[var(--text-2)] shrink-0 cursor-pointer hover:bg-[var(--surface-3)]/40 transition-colors"
    >
      <div className="flex items-center gap-4 overflow-hidden flex-1">
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
         
         <div className="flex-1 truncate">
           <LatestLogDisplay />
         </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 px-2">
        {step && (
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[var(--accent)]" title="Step">
              <Zap size={10} />
              <span>{currentIndex + 1}/{totalSteps}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--warning)]" title="Frontier Size">
              <Layers size={10} />
              <span>F:{Array.isArray(step.metrics) ? (step.metrics.find(m => m.label === 'Frontier' || m.label === 'Candidates')?.value ?? '-') : step.metrics?.frontierSize ?? '-'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--success)]" title="Nodes Expanded">
              <Target size={10} />
              <span>E:{Array.isArray(step.metrics) ? (step.metrics.find(m => m.label === 'Expanded' || m.label === 'Evaluated')?.value ?? '-') : step.metrics?.nodesExpanded ?? '-'}</span>
            </div>
          </div>
        )}
        <div className="hidden sm:flex items-center gap-1.5 opacity-60">
           <Terminal size={10} className={cn(terminalExpanded && "text-[var(--accent)]")} />
           <span>Output</span>
        </div>
      </div>
    </footer>
  );
}

export default function AppShell() {
  const darkMode = usePreferencesStore(s => s.darkMode);
  const terminalExpanded = usePreferencesStore(s => s.terminalExpanded);
  const toggle = usePreferencesStore(s => s.toggle);
  const setPreference = usePreferencesStore(s => s.set);
  const { pathname } = useLocation();
  const isAlgoPage = /^\/(?:search|play|local|maze)\//.test(pathname);
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
 
          <StatusBar />
        </div>
      </div>
    </div>
  );
}
