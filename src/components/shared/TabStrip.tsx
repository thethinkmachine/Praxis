import { cn } from '@/lib/cn';

interface TabStripProps {
  tabs: { id: string; label: string; disabled?: boolean }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabStrip({ tabs, activeTab, onTabChange }: TabStripProps) {
  return (
    <div className="px-2 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm shrink-0">
      <div className="flex gap-1 h-[30px] items-center">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded-t transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-[var(--text)] border-[var(--accent)]'
                : 'text-[var(--text-2)] border-transparent hover:text-[var(--text)]',
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
