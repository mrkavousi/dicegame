import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function readPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Tracks the user's "reduce motion" preference, live.
 * CSS tokens already shorten every transition; this hook lets JS-driven
 * animation (dice face cycling) respect the same preference.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(readPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(QUERY);
    const onChange = (event) => setReduced(event.matches);
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    }
    // Safari < 14
    list.addListener?.(onChange);
    return () => list.removeListener?.(onChange);
  }, []);

  return reduced;
}

export default useReducedMotion;
