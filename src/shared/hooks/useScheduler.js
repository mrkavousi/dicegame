import { useCallback, useEffect, useRef } from 'react';

/**
 * Timers that clean up after themselves — the only way games should delay work.
 *
 *  - every timer is cancelled on unmount;
 *  - `reset()` cancels all pending timers AND invalidates any callback that is
 *    already queued, so a stale hand-over can never fire after a new game began.
 *
 * (Pig keeps its own copy of this logic inside `useGame`; new games share this one.)
 *
 * @returns {{ schedule: (callback: () => void, delay: number) => number,
 *             cancel: (id: number) => void, reset: () => void }}
 */
export function useScheduler() {
  const timers = useRef(new Set());
  const generation = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((id) => clearTimeout(id));
      pending.clear();
    };
  }, []);

  const schedule = useCallback((callback, delay) => {
    const startedIn = generation.current;
    const id = setTimeout(() => {
      timers.current.delete(id);
      if (startedIn !== generation.current) return; // a reset happened meanwhile
      callback();
    }, delay);
    timers.current.add(id);
    return id;
  }, []);

  const cancel = useCallback((id) => {
    clearTimeout(id);
    timers.current.delete(id);
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    timers.current.forEach((id) => clearTimeout(id));
    timers.current.clear();
  }, []);

  return { schedule, cancel, reset };
}

export default useScheduler;
