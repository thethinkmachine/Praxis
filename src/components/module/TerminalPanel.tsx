import { useRef, useEffect } from 'react';
import { useExecutionStore } from '@/store/execution.store';
import { cn } from '@/lib/cn';
import { Terminal, Trash2 } from '@/components/shared/Icons';

export default function TerminalPanel() {
  const logs = useExecutionStore((s) => s.logs);
  const clearLogs = useExecutionStore((s) => s.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] text-[var(--text)] font-mono border-t border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-2)]/50 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-[var(--text-3)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
            Output
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="p-1 rounded hover:bg-[var(--surface-3)] text-[var(--text-3)] hover:text-[var(--danger)] transition-colors"
          title="Clear logs"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Logs container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 text-[11px] custom-scrollbar selection:bg-[var(--accent-soft)]"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[var(--text-3)] opacity-50">
            No output yet
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2 group hover:bg-[var(--surface-2)]/50 rounded px-1 -mx-1">
              <span className="text-[var(--text-3)] shrink-0 select-none">
                [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}]
              </span>
              <span
                className={cn(
                  'break-all',
                  log.level === 'info' && 'text-[var(--text-2)]',
                  log.level === 'success' && 'text-[var(--success)]',
                  log.level === 'warn' && 'text-[var(--warning)]',
                  log.level === 'error' && 'text-[var(--danger)]'
                )}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}