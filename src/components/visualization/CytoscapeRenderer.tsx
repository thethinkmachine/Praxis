import { useRef, useCallback, useEffect } from 'react';
import type cytoscape from 'cytoscape';
import type { ElementDefinition, StylesheetStyle } from 'cytoscape';
import { useCytoscape } from '@/hooks/useCytoscape';
import { cn } from '@/lib/cn';
import { LayoutGrid } from '@/components/shared/Icons';

interface CytoscapeRendererProps {
  elements: ElementDefinition[];
  stylesheet: StylesheetStyle[];
  layout?: cytoscape.LayoutOptions;
  onNodeClick?: (nodeId: string) => void;
  onNodeRightClick?: (nodeId: string, pos: { x: number; y: number }) => void;
  onBackgroundClick?: (pos: { x: number; y: number }) => void;
  className?: string;
  autoFit?: boolean;
}

export default function CytoscapeRenderer({
  elements,
  stylesheet,
  layout,
  onNodeClick,
  onNodeRightClick,
  onBackgroundClick,
  className,
  autoFit = true,
}: CytoscapeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { updateElements, updateStylesheet, fit } = useCytoscape(containerRef, {
    elements,
    stylesheet,
    layout,
    onNodeClick,
    onNodeRightClick,
    onBackgroundClick,
    autoFit,
  });

  // Reactively sync elements when prop changes
  useEffect(() => {
    updateElements(elements, layout);
  }, [elements, layout, updateElements]);

  // Reactively sync stylesheet when prop changes
  useEffect(() => {
    updateStylesheet(stylesheet);
  }, [stylesheet, updateStylesheet]);

  const handleFit = useCallback(() => {
    fit();
  }, [fit]);

  return (
    <div className={cn('relative w-full h-full bg-[var(--bg)] dot-grid', className)}>
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={handleFit}
        title="Fit to screen"
        className="ui-btn absolute bottom-3 right-3 h-8 rounded-lg px-2.5 text-xs"
      >
        <LayoutGrid size={12} />
        Fit
      </button>
    </div>
  );
}
