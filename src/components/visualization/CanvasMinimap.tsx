import { useEffect, useRef, useCallback } from 'react';
import type { Core } from 'cytoscape';

interface CanvasMinimapProps {
  cy: Core | null;
}

export default function CanvasMinimap({ cy }: CanvasMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cy) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw graph thumbnail via cy.png()
    if (cy.nodes().length > 0) {
      try {
        const dataUrl = cy.png({
          output: 'base64uri',
          bg: 'transparent',
          full: true,
          maxWidth: w,
          maxHeight: h,
        });

        const img = new Image();
        img.onload = () => {
          // Center the image
          const scale = Math.min(w / img.width, h / img.height, 1);
          const iw = img.width * scale;
          const ih = img.height * scale;
          const ix = (w - iw) / 2;
          const iy = (h - ih) / 2;

          ctx.clearRect(0, 0, w, h);
          ctx.globalAlpha = 0.7;
          ctx.drawImage(img, ix, iy, iw, ih);
          ctx.globalAlpha = 1.0;

          // Draw viewport rectangle
          drawViewport(ctx, w, h);
        };
        img.src = dataUrl;
      } catch {
        // If cy.png fails (e.g. headless), just draw viewport
        drawViewport(ctx, w, h);
      }
    } else {
      drawViewport(ctx, w, h);
    }
  }, [cy]);

  const drawViewport = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!cy || cy.nodes().length === 0) return;

    const ext = cy.extent();
    const bb = cy.elements().boundingBox();

    // Map visible extent to minimap coordinates
    const bbW = bb.w || 1;
    const bbH = bb.h || 1;
    const pad = 8;
    const scaleX = (w - pad * 2) / bbW;
    const scaleY = (h - pad * 2) / bbH;
    const scale = Math.min(scaleX, scaleY, 1);

    const offsetX = (w - bbW * scale) / 2;
    const offsetY = (h - bbH * scale) / 2;

    const vx = (ext.x1 - bb.x1) * scale + offsetX;
    const vy = (ext.y1 - bb.y1) * scale + offsetY;
    const vw = (ext.x2 - ext.x1) * scale;
    const vh = (ext.y2 - ext.y1) * scale;

    ctx.strokeStyle = '#58A6FF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      Math.max(0, vx),
      Math.max(0, vy),
      Math.min(vw, w),
      Math.min(vh, h),
    );
  };

  useEffect(() => {
    if (!cy) return;

    const handler = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    cy.on('viewport render add remove position', handler);
    // Initial draw
    handler();

    return () => {
      cy.off('viewport render add remove position', handler);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cy, draw]);

  return (
    <div
      className="absolute bottom-3 left-3 rounded border border-[var(--border)] overflow-hidden"
      style={{
        width: 120,
        height: 80,
        background: 'var(--surface)',
        backdropFilter: 'blur(8px)',
        opacity: 0.9,
      }}
    >
      <canvas
        ref={canvasRef}
        width={120}
        height={80}
        className="block"
      />
    </div>
  );
}
