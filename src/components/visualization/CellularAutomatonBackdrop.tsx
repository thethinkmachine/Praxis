import { useEffect, useRef, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/preferences.store';
import { useInView } from 'react-intersection-observer';

// A collection of interesting 1D Cellular Automaton rules
const RULES_1D = [30, 45, 54, 57, 60, 62, 73, 75, 86, 89, 90, 105, 109, 110, 150];

interface CellularAutomatonBackdropProps {
  className?: string;
  cellSize?: number;
  intervalMs?: number;
  changeRuleIntervalMs?: number;
  paused?: boolean;
}

type CAMode = '1D' | '2D';

export default function CellularAutomatonBackdrop({
  className,
  cellSize = 8,
  intervalMs = 120, // Increased default interval to slow down the frame rate
  changeRuleIntervalMs = 12000,
  paused = false,
}: CellularAutomatonBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const darkMode = usePreferencesStore((s) => s.darkMode);

  // Use Intersection Observer to detect when the canvas is visible
  const { ref: inViewRef, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  });

  // Combine refs
  const setRefs = (node: HTMLCanvasElement | null) => {
    (canvasRef as any).current = node;
    inViewRef(node);
  };

  // Compute theme colors
  const colors = useMemo(() => {
    if (darkMode) {
      return {
        bg: '#0b0f14',
        cellPrimary: 'rgba(95, 179, 255, 0.4)',
        cellSecondary: 'rgba(83, 200, 128, 0.25)',
        cellTertiary: 'rgba(186, 163, 255, 0.3)',
      };
    } else {
      return {
        bg: '#edf2f7',
        cellPrimary: 'rgba(40, 113, 185, 0.35)',
        cellSecondary: 'rgba(63, 185, 80, 0.25)',
        cellTertiary: 'rgba(130, 80, 223, 0.25)',
      };
    }
  }, [darkMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    
    // CA State
    let mode: CAMode = Math.random() > 0.5 ? '1D' : '2D';
    let state1D: number[] = [];
    let history1D: number[][] = [];
    let state2D: number[][] = [];
    
    let currentRule = 30;
    let ruleSet = [0, 0, 0, 0, 0, 0, 0, 0];
    
    // Animation frame tracking
    let animationId: number | undefined;
    let lastDrawTime = 0;
    let lastModeChangeTime = 0;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Build the binary rule array for 1D
    const setRule1D = (ruleDec: number) => {
      currentRule = ruleDec;
      for (let i = 0; i < 8; i++) {
        ruleSet[i] = (ruleDec >> i) & 1;
      }
    };

    // Initialize or resize the CA grid
    const initGrid = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cols = Math.ceil(width / cellSize);
      rows = Math.ceil(height / cellSize);

      resetState();
    };

    const resetState = () => {
      if (mode === '1D') {
        state1D = new Array(cols).fill(0);
        history1D = [];
        state1D[Math.floor(cols / 2)] = 1;
        history1D.push([...state1D]);
      } else {
        state2D = Array.from({ length: rows }, () => 
          Array.from({ length: cols }, () => Math.random() > 0.85 ? 1 : 0)
        );
      }
    };

    const generateNext1D = () => {
      const next = new Array(cols).fill(0);
      for (let i = 0; i < cols; i++) {
        const left = i === 0 ? state1D[cols - 1] : state1D[i - 1];
        const center = state1D[i];
        const right = i === cols - 1 ? state1D[0] : state1D[i + 1];
        const idx = (left << 2) | (center << 1) | right;
        next[i] = ruleSet[idx];
      }
      state1D = next;
      history1D.push([...state1D]);
      if (history1D.length > rows) history1D.shift();
    };

    const generateNext2D = () => {
      const next = Array.from({ length: rows }, () => new Array(cols).fill(0));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let neighbors = 0;
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              if (i === 0 && j === 0) continue;
              const nr = (r + i + rows) % rows;
              const nc = (c + j + cols) % cols;
              neighbors += state2D[nr][nc];
            }
          }
          const alive = state2D[r][c] === 1;
          if (alive && (neighbors === 2 || neighbors === 3)) next[r][c] = 1;
          else if (!alive && neighbors === 3) next[r][c] = 1;
        }
      }
      state2D = next;
    };

    // Sequence for fair distribution
    let ruleSequence: (number | '2D')[] = [];
    const refreshSequence = () => {
      ruleSequence = ([...RULES_1D, '2D'] as (number | '2D')[]).sort(() => Math.random() - 0.5);
    };

    let isRunning = false;

    const draw = (timestamp: number) => {
      if (!isRunning) return; // Exit loop if no longer running

      if (!lastDrawTime) lastDrawTime = timestamp;
      if (!lastModeChangeTime) lastModeChangeTime = timestamp;

      // Only process when element is in view to save computational resources
      if (inView) {
        if (timestamp - lastModeChangeTime > changeRuleIntervalMs) {
          if (ruleSequence.length === 0) refreshSequence();
          const next = ruleSequence.pop();
          
          if (next === '2D') {
            mode = '2D';
          } else {
            mode = '1D';
            setRule1D(next as number);
          }
          
          resetState();
          lastModeChangeTime = timestamp;
        }

        if (timestamp - lastDrawTime > intervalMs) {
          ctx.fillStyle = colors.bg;
          ctx.fillRect(0, 0, width, height);

          if (mode === '1D') {
            if (!pausedRef.current) generateNext1D();
            for (let r = 0; r < history1D.length; r++) {
              const rowData = history1D[history1D.length - 1 - r];
              for (let c = 0; c < rowData.length; c++) {
                if (rowData[c] === 1) {
                  if ((c * r + currentRule) % 5 === 0) ctx.fillStyle = colors.cellSecondary;
                  else if ((c + r) % 7 === 0) ctx.fillStyle = colors.cellTertiary;
                  else ctx.fillStyle = colors.cellPrimary;
                  ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
                }
              }
            }
          } else {
            if (!pausedRef.current) generateNext2D();
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                if (state2D[r][c] === 1) {
                  if ((c + r) % 5 === 0) ctx.fillStyle = colors.cellSecondary;
                  else if ((c * r) % 7 === 0) ctx.fillStyle = colors.cellTertiary;
                  else ctx.fillStyle = colors.cellPrimary;
                  ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
                }
              }
            }
          }
          lastDrawTime = timestamp;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    setRule1D(30);
    initGrid();

    // Start or stop animation based on visibility
    if (inView) {
      if (!isRunning) {
        isRunning = true;
        lastDrawTime = 0; // Reset timer when coming back into view
        lastModeChangeTime = performance.now() - (performance.now() - lastModeChangeTime); // try to resume where we left off
        animationId = requestAnimationFrame(draw);
      }
    } else {
      isRunning = false;
      if (typeof animationId !== 'undefined') {
          cancelAnimationFrame(animationId);
      }
    }

    const handleResize = () => {
      if (inView) initGrid();
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      isRunning = false;
      window.removeEventListener('resize', handleResize);
      if (typeof animationId !== 'undefined') {
          cancelAnimationFrame(animationId);
      }
    };
  }, [cellSize, intervalMs, changeRuleIntervalMs, colors, inView]);

  return (
    <canvas
      ref={setRefs}
      className={cn("w-full h-full block", className)}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
