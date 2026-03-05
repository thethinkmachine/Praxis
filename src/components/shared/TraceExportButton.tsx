import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';
import { useExportTrace } from '@/hooks/useExportTrace';

export default function TraceExportButton() {
  const { exportJSON, exportCSV, hasTrace } = useExportTrace();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={!hasTrace}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded',
            'bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]',
            'hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <span>↓</span>
          Export Trace
          <span className="text-[var(--text-3)]">▾</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] bg-[var(--surface-2)] border border-[var(--border)] rounded shadow-lg py-1"
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            onSelect={exportJSON}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] cursor-pointer outline-none"
          >
            <span>{ }</span>
            Export as JSON
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] cursor-pointer outline-none"
          >
            <span>⊞</span>
            Export as CSV
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
