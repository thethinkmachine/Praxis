import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import CellularAutomatonBackdrop from '@/components/visualization/CellularAutomatonBackdrop';
import { cn } from '@/lib/cn';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col p-3">
      <div className="relative flex-1 rounded-xl border border-[var(--border)] overflow-hidden ide-surface flex items-center justify-center">
        {/* Backdrop - Cellular Automaton */}
        <div className="absolute inset-0 opacity-[0.4] blur-[0.5px] pointer-events-none overflow-hidden">
          <CellularAutomatonBackdrop intervalMs={50} changeRuleIntervalMs={10000} cellSize={10} />
        </div>

        {/* Overlay Content */}
        <div className="relative z-10 p-8 sm:p-12 flex flex-col items-center text-center gap-6 bg-gradient-to-b from-[var(--surface)]/80 to-[var(--surface-2)]/50 backdrop-blur-[4px] rounded-2xl border border-[var(--border)]/50 shadow-2xl max-w-lg w-full mx-4">
          <div className="flex flex-col items-center gap-2">
            <span className="font-bold text-7xl sm:text-8xl tracking-tight text-[var(--accent)] font-mono drop-shadow-sm">
              404
            </span>
            <span className="text-xl sm:text-2xl font-semibold text-[var(--text)] font-mono uppercase tracking-widest">
              State Not Found
            </span>
          </div>
          
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent opacity-50 my-2" />

          <p className="text-sm sm:text-base text-[var(--text-2)] max-w-md">
            The algorithm couldn't find a path to the requested goal state. The node you are looking for might be unreachable or no longer exists in the state space.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 w-full">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)] transition-all font-mono text-sm uppercase tracking-wider"
            >
              <ArrowLeft size={16} />
              <span>Go Back</span>
            </button>
            <Link
              to="/"
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg overflow-hidden relative group font-mono text-sm uppercase tracking-wider font-semibold"
            >
              {/* Button Background & Glow */}
              <div className="absolute inset-0 bg-[var(--accent)] transition-transform duration-300 ease-out group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out mix-blend-overlay" />
              
              {/* Content */}
              <div className="relative flex items-center gap-2 text-[var(--bg)] z-10">
                <Home size={16} />
                <span>Return Home</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
