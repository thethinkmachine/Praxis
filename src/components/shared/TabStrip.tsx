import { cn } from '@/lib/cn';

interface TabStripProps {
  tabs: { id: string; label: string; disabled?: boolean }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabStrip({ tabs, activeTab, onTabChange }: TabStripProps) {
  return (
    <div className="px-3 pt-1 border-b border-[var(--border)]/80 bg-[var(--surface)]/55 backdrop-blur-sm shrink-0">
      <div className="flex gap-1 h-8 items-end">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded-t-md transition-colors border border-b-0 font-mono tracking-wide',
              activeTab === tab.id
                ? 'text-[var(--text)] border-[var(--border)] bg-[var(--surface-2)]'
                : 'text-[var(--text-3)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface)]/50',
              tab.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
