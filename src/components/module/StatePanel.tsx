import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronRight } from '@/components/shared/Icons';
import { useEditorStore } from '@/store/useEditorStore';
import type { AlgorithmStep, AlgorithmCategory } from '@/types';

interface StatePanelProps {
  step: AlgorithmStep | null;
  algorithmCategory?: AlgorithmCategory;
}

function SectionHeader({ 
  title, 
  count, 
  isCollapsed, 
  onToggle 
}: { 
  title: string; 
  count?: number; 
  isCollapsed?: boolean; 
  onToggle?: () => void;
}) {
  return (
    <div 
      className={cn(
        "px-3 py-1 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center gap-2 select-none",
        onToggle && "cursor-pointer hover:bg-[var(--surface-3)]"
      )}
      onClick={onToggle}
    >
      {onToggle && (
        <span className="text-[var(--text-3)]">
          {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
        </span>
      )}
      <span className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
        {title}
      </span>
      {count !== undefined && (
        <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-[var(--border)]/50 text-[var(--text-3)] leading-none">
          {count}
        </span>
      )}
    </div>
  );
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
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <SectionHeader 
        title={title} 
        count={count} 
        isCollapsed={!isOpen} 
        onToggle={() => setIsOpen(!isOpen)} 
      />
      {isOpen && children}
    </div>
  );
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

/** Normalise whatever `explored` the algorithm yields: Set<string> | string[] | never[]. */
function toExploredArray(raw: unknown): string[] {
  if (raw instanceof Set) return Array.from(raw as Set<string>);
  if (Array.isArray(raw)) return raw as string[];
  return [];
}

/** Build a cost annotation string for a frontier node using the state's cost maps. */
function getFrontierDetail(
  nodeId: string,
  fCosts?: Map<string, number>,
  gCosts?: Map<string, number>,
  hCosts?: Map<string, number>,
  costs?: Map<string, number>,
): string | undefined {
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
  const f = fCosts?.get(nodeId);
  if (f !== undefined) {
    const g = gCosts?.get(nodeId);
    const h = hCosts?.get(nodeId);
    if (g !== undefined && h !== undefined) return `g=${fmt(g)} h=${fmt(h)} f=${fmt(f)}`;
    return `f=${fmt(f)}`;
  }
  const g = gCosts?.get(nodeId) ?? costs?.get(nodeId);
  const h = hCosts?.get(nodeId);
  if (g !== undefined && h !== undefined) return `g=${fmt(g)} h=${fmt(h)}`;
  if (g !== undefined) return `g=${fmt(g)}`;
  return undefined;
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
      <div className="h-full flex items-center justify-center bg-[var(--surface)]">
        <span className="text-sm text-[var(--text-3)]">No step selected</span>
      </div>
    );
  }

  const st = (step.state as Record<string, unknown>) ?? {};
  const frontier = (st.frontier as unknown[]) ?? [];
  const exploredArr = toExploredArray(st.explored);
  // Search algorithms use `foundPath`; other algorithms may use `currentPath`
  const currentPath = ((st.foundPath ?? st.currentPath) as unknown[]) ?? [];

  // Cost maps present for weighted uninformed variants such as UCS
  const fCosts = st.fCosts instanceof Map ? (st.fCosts as Map<string, number>) : undefined;
  const gCosts = st.gCosts instanceof Map ? (st.gCosts as Map<string, number>) : undefined;
  const hCosts = st.hCosts instanceof Map ? (st.hCosts as Map<string, number>) : undefined;
  const costs = st.costs instanceof Map ? (st.costs as Map<string, number>) : undefined;
  const hasCosts = !!(fCosts || gCosts || hCosts || costs);

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      <div className="flex-1 overflow-y-auto text-xs divide-y divide-[var(--border)]">
        {/* ──── Search-oriented sections ──── */}
        {(algorithmCategory === 'uninformed-search' || algorithmCategory === 'informed-search' || algorithmCategory === undefined) && (
          <>
            {/* Current node */}
            {!!st.currentNode && (
              <Section title="Current Node">
                <div className="px-3 py-2">
                  <ChipBadge
                    variant="current"
                    title={(() => {
                      const nodeId = st.currentNode as string;
                      const f = fCosts?.get(nodeId);
                      const g = gCosts?.get(nodeId) ?? costs?.get(nodeId);
                      const h = hCosts?.get(nodeId);
                      const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
                      if (f !== undefined) return `f=${fmt(f)}`;
                      if (g !== undefined && h !== undefined) return `g=${fmt(g)} h=${fmt(h)}`;
                      if (g !== undefined) return `g=${fmt(g)}`;
                      return st.heuristic !== undefined ? `h=${st.heuristic}` : undefined;
                    })()}
                  >
                    {lbl(st.currentNode as string)}
                  </ChipBadge>
                  {(() => {
                    const nodeId = st.currentNode as string;
                    const f = fCosts?.get(nodeId);
                    const g = gCosts?.get(nodeId) ?? costs?.get(nodeId);
                    const h = hCosts?.get(nodeId);
                    const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
                    let detail: string | undefined;
                    if (f !== undefined) {
                      const gv = gCosts?.get(nodeId);
                      const hv = hCosts?.get(nodeId);
                      if (gv !== undefined && hv !== undefined) detail = `g=${fmt(gv)} h=${fmt(hv)} f=${fmt(f)}`;
                      else detail = `f=${fmt(f)}`;
                    } else if (g !== undefined && h !== undefined) {
                      detail = `g=${fmt(g)} h=${fmt(h)}`;
                    } else if (g !== undefined) {
                      detail = `g=${fmt(g)}`;
                    } else if (st.heuristic !== undefined) {
                      detail = `h=${st.heuristic}`;
                    }
                    return detail ? (
                      <span className="ml-2 text-[10px] text-[var(--text-2)] font-mono">{detail}</span>
                    ) : null;
                  })()}
                </div>
              </Section>
            )}

            {/* Open list / Frontier */}
            <Section title="Open List" count={frontier.length}>
              {frontier.length > 0 ? (
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                  {frontier.map((node, i) => {
                    const isObj = typeof node === 'object' && node !== null;
                    const id = isObj ? (node as Record<string, unknown>).id as string : String(node);
                    const isCurrent = id === (st.currentNode as string | undefined);
                    const detail = hasCosts
                      ? getFrontierDetail(id, fCosts, gCosts, hCosts, costs)
                      : undefined;
                    return (
                      <ChipBadge
                        key={`${id}-${i}`}
                        title={detail}
                        variant={isCurrent ? 'current' : 'frontier'}
                      >
                        {lbl(id)}
                      </ChipBadge>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-1 text-[var(--text-3)]">Empty</div>
              )}
            </Section>

            {/* Closed list / Explored set */}
            <Section title="Closed List" count={exploredArr.length}>
              {exploredArr.length > 0 ? (
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                  {exploredArr.map((id, i) => {
                    const detail = costs?.get(id) !== undefined
                      ? `d=${Number.isInteger(costs.get(id)!) ? costs.get(id) : costs.get(id)!.toFixed(2)}`
                      : gCosts?.get(id) !== undefined
                        ? `g=${Number.isInteger(gCosts.get(id)!) ? gCosts.get(id) : gCosts.get(id)!.toFixed(2)}`
                        : undefined;
                    return (
                      <ChipBadge
                        key={`${id}-${i}`}
                        variant="explored"
                        title={detail}
                      >
                        {lbl(id)}
                      </ChipBadge>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-1 text-[var(--text-3)]">Empty</div>
              )}
            </Section>

            {/* Solution path (shown when goal is reached) */}
            {currentPath.length > 0 && (
              <Section title="Solution Path" count={currentPath.length - 1}>
                <div className="px-3 py-2 flex flex-wrap items-center gap-1">
                  {currentPath.map((node, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <ChipBadge variant="path">
                        {lbl(String(node))}
                      </ChipBadge>
                      {i < currentPath.length - 1 && (
                        <span className="text-[9px] text-[var(--text-3)]">&rarr;</span>
                      )}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

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
                    {typeof st.currentMove === 'number' ? `cell ${Number(st.currentMove) + 1}` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Best move</span>
                  <span className="font-mono text-[var(--text)]">
                    {typeof st.bestMove === 'number' ? `cell ${Number(st.bestMove) + 1}` : '-'}
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
                        label={typeof move.move === 'number' ? `cell ${move.move + 1}` : 'move'}
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
                    const moveLabel = typeof item.move === 'number' ? `cell ${item.move + 1}` : 'root';
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
