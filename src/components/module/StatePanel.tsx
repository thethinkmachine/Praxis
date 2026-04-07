import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import EmptyState from '@/components/shared/EmptyState';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import { useEditorStore } from '@/store/useEditorStore';
import type { AlgorithmStep, AlgorithmCategory, PanelSection } from '@/types';

interface StatePanelProps {
  step: AlgorithmStep | null;
  algorithmCategory?: AlgorithmCategory;
}

function Section({ 
  title, 
  count, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  count?: number; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) {
  return <CollapsibleSection title={title} count={count} defaultOpen={defaultOpen} bodyClassName="p-0">{children}</CollapsibleSection>;
}

type ChipVariant = 'frontier' | 'current' | 'explored' | 'path';

const CHIP_STYLES: Record<ChipVariant, string> = {
  frontier: 'bg-[var(--color-frontier)]/7 text-[var(--color-frontier)] border-[var(--color-frontier)]/20',
  current: 'bg-[var(--color-current)]/10 text-[var(--color-current)] border-[var(--color-current)]/30',
  explored: 'bg-[var(--color-explored)]/10 text-[var(--text-2)] border-[var(--color-explored)]/20',
  path: 'bg-[var(--color-goal)]/10 text-[var(--color-goal)] border-[var(--color-goal)]/25',
};

function ChipBadge({
  children,
  variant,
  title,
}: {
  children: React.ReactNode;
  variant: ChipVariant;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center px-[7px] py-[2px] rounded-[3px]',
        'font-mono text-[9px] border whitespace-nowrap',
        CHIP_STYLES[variant],
      )}
    >
      {children}
    </span>
  );
}

function NodeEntry({
  id,
  label,
  detail,
  color,
}: {
  id: string;
  label?: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5 hover:bg-[var(--surface-2)]/50 transition-colors">
      <span className={cn('text-xs font-mono truncate', color ?? 'text-[var(--text)]')}>
        {label ?? id}
      </span>
      {detail && (
        <span className="ml-auto text-[10px] text-[var(--text-2)] shrink-0">{detail}</span>
      )}
    </div>
  );
}

function renderPanel(panel: PanelSection, idx: number, lbl: (id: string) => string) {
  return (
    <Section key={idx} title={panel.title} count={panel.count}>
      {panel.type === 'key-value' && (
        <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
          {panel.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span>{item.key}</span>
              <span className="font-mono text-[var(--text)]">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {panel.type === 'chips' && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5">
          {panel.items.length > 0 ? panel.items.map((item, i) => (
            item.variant === 'path' ? (
              <span key={i} className="inline-flex items-center gap-1">
                <ChipBadge variant="path" title={item.detail}>{lbl(item.id) ?? item.label}</ChipBadge>
                {i < panel.items.length - 1 && <span className="text-[9px] text-[var(--text-3)]">&rarr;</span>}
              </span>
            ) : (
              <ChipBadge key={i} variant={item.variant ?? 'explored'} title={item.detail}>
                {lbl(item.id) ?? item.label}
              </ChipBadge>
            )
          )) : (
            <div className="text-[var(--text-3)]">Empty</div>
          )}
        </div>
      )}
      {panel.type === 'nodes' && (
        <div className="py-1">
          {panel.items.length > 0 ? panel.items.map((item, i) => (
            <NodeEntry key={i} id={item.id} label={lbl(item.id) ?? item.label} detail={item.detail} />
          )) : (
            <div className="px-3 py-1 text-[var(--text-3)]">Empty</div>
          )}
        </div>
      )}
    </Section>
  );
}

export default function StatePanel({ step, algorithmCategory }: StatePanelProps) {
  // Build a stable id→label map so every node ID can be shown with its user-visible name.
  // Selecting nodes array (reference changes only on topology/label updates).
  const editorNodes = useEditorStore(state => state.nodes);
  const nodeLabelMap = useMemo(
    () => new Map(editorNodes.map(n => [n.id, n.label ?? n.id])),
    [editorNodes],
  );
  const lbl = (id: string) => nodeLabelMap.get(id) ?? id;

  if (!step) {
    return (
      <EmptyState title="No step selected" description="Run or step through an algorithm to inspect its active state." className="bg-[var(--surface)]" />
    );
  }

  const st = (step.state as Record<string, unknown>) ?? {};
  if (step.statePanels && step.statePanels.length > 0) {
    return (
      <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
        <div className="flex-1 overflow-y-auto text-xs divide-y divide-[var(--border)]">
          {step.statePanels.map((panel, idx) => renderPanel(panel, idx, lbl))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      <div className="flex-1 overflow-y-auto text-xs divide-y divide-[var(--border)]">
        {/* ──── Search-oriented sections ──── */}
        {/* Legacy Search Fallback Removed. UI completely driven by algorithm payloads. */}

        {algorithmCategory === 'game-playing' && (
          <>
            <Section title="Position">
              <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
                <div className="flex items-center justify-between gap-2">
                  <span>Current player</span>
                  <span className="font-mono text-[var(--text)]">{String(st.currentPlayer ?? '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Maximizing player</span>
                  <span className="font-mono text-[var(--text)]">{String(st.maximizingPlayer ?? '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Terminal winner</span>
                  <span className="font-mono text-[var(--text)]">{String(st.terminalWinner ?? '-')}</span>
                </div>
              </div>
            </Section>

            <Section title="Best Move">
              <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
                <div className="flex items-center justify-between gap-2">
                  <span>Current candidate</span>
                  <span className="font-mono text-[var(--text)]">
                    {typeof st.currentMove === 'number' ? `move ${Number(st.currentMove) + 1}` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Best move</span>
                  <span className="font-mono text-[var(--text)]">
                    {typeof st.bestMove === 'number' ? `move ${Number(st.bestMove) + 1}` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Best score</span>
                  <span className="font-mono text-[var(--text)]">{String(st.bestScore ?? st.currentScore ?? '-')}</span>
                </div>
                {(st.alpha !== undefined || st.beta !== undefined) && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Window</span>
                    <span className="font-mono text-[var(--text)]">{`[${String(st.alpha ?? '-')}, ${String(st.beta ?? '-')}]`}</span>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Evaluated Moves" count={Array.isArray(st.evaluatedMoves) ? st.evaluatedMoves.length : 0}>
              {Array.isArray(st.evaluatedMoves) && st.evaluatedMoves.length > 0 ? (
                <div className="py-1">
                  {st.evaluatedMoves.map((item, index) => {
                    const move = item as { move?: number; score?: number };
                    return (
                      <NodeEntry
                        key={`${move.move ?? 'm'}-${index}`}
                        id={String(move.move ?? index)}
                        label={typeof move.move === 'number' ? `move ${move.move + 1}` : 'move'}
                        detail={move.score === undefined ? undefined : String(move.score)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-1 text-[var(--text-3)]">Empty</div>
              )}
            </Section>

            <Section title="Recursion Stack" count={Array.isArray(st.recursionStack) ? st.recursionStack.length : 0}>
              {Array.isArray(st.recursionStack) && st.recursionStack.length > 0 ? (
                <div className="py-1">
                  {st.recursionStack.map((frame, index) => {
                    const item = frame as { depth?: number; role?: string; move?: number | null; bestScore?: number | null };
                    const moveLabel = typeof item.move === 'number' ? `move ${item.move + 1}` : 'root';
                    const roleLabel = item.role ? `${String(item.role).toUpperCase()} d${String(item.depth ?? 0)}` : `d${String(item.depth ?? 0)}`;
                    const detail = item.bestScore == null ? moveLabel : `${moveLabel} best=${item.bestScore}`;
                    return (
                      <NodeEntry
                        key={`${item.depth ?? 0}-${item.move ?? 'root'}-${index}`}
                        id={String(index)}
                        label={roleLabel}
                        detail={detail}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-1 text-[var(--text-3)]">Empty</div>
              )}
            </Section>
          </>
        )}

        {algorithmCategory === 'local-search' && (
          <>
            <Section title="Current State">
              <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
                <div className="flex items-center justify-between gap-2">
                  <span>{String(st.stateLabel ?? 'State')}</span>
                  <span className="font-mono text-[var(--text)] text-right">{String(st.currentSummary ?? '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{String(st.objectiveLabel ?? 'Objective')}</span>
                  <span className="font-mono text-[var(--text)]">{String(st.currentDisplayValue ?? st.currentValue ?? '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Score</span>
                  <span className="font-mono text-[var(--text)]">{String(st.currentScore ?? '-')}</span>
                </div>
                {Array.isArray(st.currentStats) && st.currentStats.map((item, index) => {
                  const stat = item as { label?: string; value?: string | number };
                  return (
                    <div key={`${stat.label ?? 'stat'}-${index}`} className="flex items-center justify-between gap-2">
                      <span>{String(stat.label ?? 'stat')}</span>
                      <span className="font-mono text-[var(--text)]">{String(stat.value ?? '-')}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Best So Far">
              <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
                <div className="flex items-center justify-between gap-2">
                  <span>{String(st.stateLabel ?? 'State')}</span>
                  <span className="font-mono text-[var(--text)] text-right">{String(st.bestSummary ?? '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{String(st.objectiveLabel ?? 'Objective')}</span>
                  <span className="font-mono text-[var(--text)]">{String(st.bestDisplayValue ?? st.bestValue ?? '-')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Restarts</span>
                  <span className="font-mono text-[var(--text)]">{String(st.restartCount ?? 0)}</span>
                </div>
                {Array.isArray(st.bestStats) && st.bestStats.map((item, index) => {
                  const stat = item as { label?: string; value?: string | number };
                  return (
                    <div key={`${stat.label ?? 'best'}-${index}`} className="flex items-center justify-between gap-2">
                      <span>{String(stat.label ?? 'stat')}</span>
                      <span className="font-mono text-[var(--text)]">{String(stat.value ?? '-')}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={Array.isArray(st.populationPreview) && st.populationPreview.length > 0 ? 'Candidates / Population' : 'Candidate Moves'} count={Array.isArray(st.candidateMoves) ? st.candidateMoves.length : 0}>
              {Array.isArray(st.candidateMoves) && st.candidateMoves.length > 0 ? (
                <div className="py-1">
                  {st.candidateMoves.map((candidate, index) => {
                    const item = candidate as { label?: string; displayValue?: string; delta?: number };
                    return (
                      <NodeEntry
                        key={`${item.label ?? 'candidate'}-${index}`}
                        id={String(index)}
                        label={String(item.label ?? 'candidate')}
                        detail={`${String(st.objectiveLabel ?? 'value')}=${String(item.displayValue ?? '-')} Δ=${String(item.delta ?? '-')}`}
                      />
                    );
                  })}
                </div>
              ) : Array.isArray(st.populationPreview) && st.populationPreview.length > 0 ? (
                <div className="py-1">
                  {st.populationPreview.map((member, index) => {
                    const item = member as { summary?: string; displayValue?: string };
                    return (
                      <NodeEntry
                        key={`${item.summary ?? 'member'}-${index}`}
                        id={String(index)}
                        label={String(item.summary ?? 'member')}
                        detail={String(item.displayValue ?? '-')}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-1 text-[var(--text-3)]">No candidate preview</div>
              )}
            </Section>

            <Section title="Run State">
              <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
                <div className="flex items-center justify-between gap-2">
                  <span>Iteration</span>
                  <span className="font-mono text-[var(--text)]">{String(st.iteration ?? 0)}</span>
                </div>
                {st.generation !== undefined && st.generation !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Generation</span>
                    <span className="font-mono text-[var(--text)]">{String(st.generation)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span>Plateau length</span>
                  <span className="font-mono text-[var(--text)]">{String(st.plateauLength ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Sideways</span>
                  <span className="font-mono text-[var(--text)]">
                    {st.sidewaysMoveLimit == null
                      ? String(st.sidewaysMovesUsed ?? 0)
                      : `${String(st.sidewaysMovesUsed ?? 0)} / ${String(st.sidewaysMoveLimit)}`}
                  </span>
                </div>
                {st.beamWidth !== undefined && st.beamWidth !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Beam width</span>
                    <span className="font-mono text-[var(--text)]">{String(st.beamWidth)}</span>
                  </div>
                )}
                {st.populationSize !== undefined && st.populationSize !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Population</span>
                    <span className="font-mono text-[var(--text)]">{String(st.populationSize)}</span>
                  </div>
                )}
                {st.tabuSize !== undefined && st.tabuSize !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Tabu size</span>
                    <span className="font-mono text-[var(--text)]">{String(st.tabuSize)}</span>
                  </div>
                )}
                {st.temperature !== undefined && st.temperature !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Temperature</span>
                    <span className="font-mono text-[var(--text)]">{Number(st.temperature).toFixed(3)}</span>
                  </div>
                )}
              </div>
            </Section>

            {Array.isArray(st.tabuEntries) && st.tabuEntries.length > 0 && (
              <Section title="Tabu List" count={st.tabuEntries.length}>
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                  {st.tabuEntries.map((entry, index) => (
                    <ChipBadge key={`${entry}-${index}`} variant="explored">
                      {String(entry)}
                    </ChipBadge>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
