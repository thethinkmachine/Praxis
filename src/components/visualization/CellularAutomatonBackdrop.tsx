import { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/preferences.store';

// A collection of interesting 1D Cellular Automaton rules
const RULES = [30, 45, 54, 57, 60, 62, 73, 75, 86, 89, 90, 105, 109, 110, 150];

interface CellularAutomatonBackdropProps {
  className?: string;
  cellSize?: number;
  intervalMs?: number;
  changeRuleIntervalMs?: number;
}

export default function CellularAutomatonBackdrop({
  className,
  cellSize = 8,
  intervalMs = 60,
  changeRuleIntervalMs = 10000,
}: CellularAutomatonBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = usePreferencesStore((s) => s.darkMode);

  // Compute theme colors
  const colors = useMemo(() => {
    if (darkMode) {
      return {
        bg: '#0b0f14',
        cellPrimary: 'rgba(95, 179, 255, 0.15)', // Accent soft
        cellSecondary: 'rgba(83, 200, 128, 0.1)', // Success soft
        cellTertiary: 'rgba(186, 163, 255, 0.12)', // Purple soft
      };
    } else {
      return {
        bg: '#edf2f7',
        cellPrimary: 'rgba(40, 113, 185, 0.12)',
        cellSecondary: 'rgba(63, 185, 80, 0.08)',
        cellTertiary: 'rgba(130, 80, 223, 0.08)',
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
    let state: number[] = [];
    let history: number[][] = [];
    let currentRule = 30;
    let ruleSet = [0, 0, 0, 0, 0, 0, 0, 0];
    
    // Animation frame tracking
    let animationId: number;
    let lastDrawTime = 0;
    let lastRuleChangeTime = 0;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Build the binary rule array
    const setRule = (ruleDec: number) => {
      currentRule = ruleDec;
      for (let i = 0; i < 8; i++) {
        ruleSet[i] = (ruleDec >> i) & 1;
      }
    };

    const getRandomRule = () => {
      const remainingRules = RULES.filter(r => r !== currentRule);
      return remainingRules[Math.floor(Math.random() * remainingRules.length)];
    };

    // Initialize or resize the CA grid
    const initGrid = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      
      // Handle high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cols = Math.ceil(width / cellSize);
      rows = Math.ceil(height / cellSize);

      // Reset state
      state = new Array(cols).fill(0);
      history = [];
      
      // Start with a single active cell in the middle
      state[Math.floor(cols / 2)] = 1;
      
      // Alternatively, start with random noise
      // for(let i=0; i<cols; i++) state[i] = Math.random() > 0.5 ? 1 : 0;
      
      history.push([...state]);
    };

    // Apply the CA rule to generate the next generation
    const generateNextMap = () => {
      const next = new Array(cols).fill(0);
      
      for (let i = 0; i < cols; i++) {
        const left = i === 0 ? state[cols - 1] : state[i - 1];
        const center = state[i];
        const right = i === cols - 1 ? state[0] : state[i + 1];
        
        // Convert the neighborhood to a binary string, then an index 0-7
        const idx = (left << 2) | (center << 1) | right;
        next[i] = ruleSet[idx];
      }
      
      state = next;
      history.push([...state]);
      
      // Keep only enough history to fill the screen to prevent unbounded growth
      if (history.length > rows) {
        history.shift();
      }
    };

    // Draw the whole grid history
    const draw = (timestamp: number) => {
      if (!lastDrawTime) lastDrawTime = timestamp;
      if (!lastRuleChangeTime) lastRuleChangeTime = timestamp;

      // Check if it's time to change the rule
      if (timestamp - lastRuleChangeTime > changeRuleIntervalMs) {
        setRule(getRandomRule());
        
        // Inject a little chaos to seed the new rule if it stalls
        if (Math.random() > 0.3) {
           const injectionCount = Math.floor(cols * 0.05);
           for(let i = 0; i < injectionCount; i++) {
               state[Math.floor(Math.random() * cols)] = 1;
           }
        }
        
        lastRuleChangeTime = timestamp;
      }

      // Check if it's time to generate/draw the next generation
      if (timestamp - lastDrawTime > intervalMs) {
        generateNextMap();
        
        // Clear background
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, width, height);

        // Draw history from top to bottom
        for (let r = 0; r < history.length; r++) {
          const rowData = history[history.length - 1 - r];
          for (let c = 0; c < rowData.length; c++) {
            if (rowData[c] === 1) {
              
              // Pick color based on position/rule for a little aesthetic variety
              if ((c * r + currentRule) % 5 === 0) {
                 ctx.fillStyle = colors.cellSecondary;
              } else if ((c + r) % 7 === 0) {
                 ctx.fillStyle = colors.cellTertiary;
              } else {
                 ctx.fillStyle = colors.cellPrimary;
              }
              
              ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
            }
          }
        }
        
        lastDrawTime = timestamp;
      }

      animationId = requestAnimationFrame(draw);
    };

    // Setup
    setRule(30);
    initGrid();
    animationId = requestAnimationFrame(draw);

    const handleResize = () => {
      initGrid();
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [cellSize, intervalMs, changeRuleIntervalMs, colors]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full block", className)}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
