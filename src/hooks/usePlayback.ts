import { useEffect, useRef } from 'react';
import { useExecutionStore } from '@/store/execution.store';

export function usePlayback() {
  // Use individual primitive selectors — returning an object literal creates a new
  // reference on every call, which bypasses Zustand's equality check and causes
  // an infinite re-render loop.
  const isPlaying = useExecutionStore(state => state.isPlaying);
  const speed = useExecutionStore(state => state.speed);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const delay = 1000 / speed;
      intervalRef.current = window.setInterval(() => {
        // Read latest state directly instead of capturing from closure to avoid
        // stale closures and unnecessary effect re-fires.
        const { currentIndex, totalSteps, pause, stepForward } = useExecutionStore.getState();
        if (currentIndex >= totalSteps - 1) {
          pause();
        } else {
          stepForward();
        }
      }, delay);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed]); // Only recreate interval when play state or speed change
}
