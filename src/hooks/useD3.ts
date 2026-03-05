import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

export function useD3<T = unknown>(
  containerRef: React.RefObject<SVGSVGElement | HTMLDivElement>,
  renderFn: (selection: d3.Selection<SVGSVGElement | HTMLDivElement, T, null, undefined>, data: T) => void,
  data: T,
  deps: React.DependencyList = []
) {
  const renderRef = useRef(renderFn);
  renderRef.current = renderFn;

  useEffect(() => {
    if (!containerRef.current) return;
    const selection = d3.select(containerRef.current as SVGSVGElement | HTMLDivElement) as d3.Selection<SVGSVGElement | HTMLDivElement, T, null, undefined>;
    renderRef.current(selection, data);
  }, [data, containerRef, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useD3Container(containerRef: React.RefObject<SVGSVGElement>) {
  const clear = useCallback(() => {
    if (containerRef.current) {
      d3.select(containerRef.current).selectAll('*').remove();
    }
  }, [containerRef]);

  return { clear };
}
