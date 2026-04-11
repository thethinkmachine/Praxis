import { useEffect } from 'react';
import { useExecutionStore } from '@/store/execution.store';
import { SPEEDS } from '@/components/controls/SpeedSlider';

export interface KeyboardShortcutHandlers {
  onToggleSidebar?: () => void;
  onToggleTheme?: () => void;
  onTogglePseudocode?: () => void;
  onToggleMetrics?: () => void;
  onToggleStatePanel?: () => void;
  onToggleConfig?: () => void;
  onSwitchTab?: (direction: 'prev' | 'next') => void;
  onFocusSearch?: () => void;
}

export function useKeyboardShortcuts(handlers?: KeyboardShortcutHandlers) {
  const isPlaying = useExecutionStore(s => s.isPlaying);
  const play = useExecutionStore(s => s.play);
  const pause = useExecutionStore(s => s.pause);
  const stepForward = useExecutionStore(s => s.stepForward);
  const stepBackward = useExecutionStore(s => s.stepBackward);
  const reset = useExecutionStore(s => s.reset);
  const jumpToStart = useExecutionStore(s => s.jumpToStart);
  const jumpToEnd = useExecutionStore(s => s.jumpToEnd);
  const setSpeed = useExecutionStore(s => s.setSpeed);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire inside input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Ctrl+K / Cmd+K — focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handlers?.onFocusSearch?.();
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Space':
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
        case 'h':
          e.preventDefault();
          stepBackward();
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            reset();
          }
          break;
        case 'Home':
          e.preventDefault();
          jumpToStart();
          break;
        case 'End':
          e.preventDefault();
          jumpToEnd();
          break;

        // Navigation shortcuts
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlers?.onToggleSidebar?.();
          }
          break;
        case 't':
        case 'T':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlers?.onToggleTheme?.();
          }
          break;

        // Panel toggles
        case 'c':
        case 'C':
          if (!e.ctrlKey && !e.metaKey) {
            handlers?.onToggleConfig?.();
          }
          break;
        case 'p':
        case 'P':
          if (!e.ctrlKey && !e.metaKey) {
            handlers?.onTogglePseudocode?.();
          }
          break;
        case 'm':
        case 'M':
          if (!e.ctrlKey && !e.metaKey) {
            handlers?.onToggleMetrics?.();
          }
          break;
        case 'i':
        case 'I':
          if (!e.ctrlKey && !e.metaKey) {
            handlers?.onToggleStatePanel?.();
          }
          break;

        // Tab switching
        case '[':
          handlers?.onSwitchTab?.('prev');
          break;
        case ']':
          handlers?.onSwitchTab?.('next');
          break;

        // Search focus
        case '/':
          if (handlers?.onFocusSearch) {
            e.preventDefault();
            handlers.onFocusSearch();
          }
          break;

        // Speed presets (1-6 map to SPEEDS array)
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6': {
          const idx = parseInt(e.key) - 1;
          if (idx >= 0 && idx < SPEEDS.length) {
            setSpeed(SPEEDS[idx]);
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause, stepForward, stepBackward, reset, jumpToStart, jumpToEnd, setSpeed, handlers]);
}
