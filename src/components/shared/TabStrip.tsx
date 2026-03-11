import HeaderTabs from '@/components/shared/HeaderTabs';

interface TabStripProps {
  tabs: { id: string; label: string; disabled?: boolean }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabStrip({ tabs, activeTab, onTabChange }: TabStripProps) {
  return (
    <div className="px-3 pt-1 border-b border-[var(--border)]/80 bg-[var(--surface)]/55 backdrop-blur-sm shrink-0">
      <HeaderTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
