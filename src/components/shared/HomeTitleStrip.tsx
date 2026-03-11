import { TopBarControls } from '@/components/layout/TopBar';

interface HomeTitleStripProps {
  algorithmCount: number;
  liveModuleCount: number;
}

export default function HomeTitleStrip({ algorithmCount, liveModuleCount }: HomeTitleStripProps) {
  return (
    <div className="relative z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm">
      <div className="flex min-h-10 items-center gap-3 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="inline-flex shrink-0 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">
            Library
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--text)]">Praxis</p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[var(--text-3)]">
              Taxonomy, interactive modules, and concept map
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1 xl:flex">
          <span className="ui-pill ui-pill-accent whitespace-nowrap px-1.5 py-0.5 text-[9px]">
            {algorithmCount} algorithms
          </span>
          <span className="ui-pill ui-pill-success whitespace-nowrap px-1.5 py-0.5 text-[9px]">
            {liveModuleCount} live modules
          </span>
        </div>

        <div className="h-4 w-px shrink-0 bg-[var(--border-strong)]" />
        <div className="flex shrink-0 items-center gap-1">
          <TopBarControls />
        </div>
      </div>
    </div>
  );
}