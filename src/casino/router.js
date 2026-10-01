/**
 * ============================================================================
 * Casino — hash router
 * ============================================================================
 * Dependency-free routing over `location.hash` (`#/`, `#/pig`, `#/connect4`…).
 * Hash routes need no server configuration, work offline in the PWA, and keep
 * the browser Back button meaningful.
 *
 * `navigate()` notifies subscribers synchronously (it does not wait for the
 * asynchronous `hashchange` event), so state and URL never disagree.
 * ============================================================================
 */

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set();

/**
 * Normalise a raw hash into a route path: `''`, `'#'`, `'#/pig/'` → `'/'`, `'/pig'`.
 * @param {string} hash
 */
export function parseHash(hash) {
  const path = String(hash ?? '')
    .replace(/^#/, '')
    .split('?')[0]
    .replace(/\/+$/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

function getPath() {
  return typeof window === 'undefined' ? '/' : parseHash(window.location.hash);
}

function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener('hashchange', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', listener);
  };
}

/**
 * Go to a route.
 * @param {string} path e.g. `'/'` or `'/pig'`
 */
export function navigate(path) {
  const next = parseHash(path);
  if (typeof window === 'undefined' || getPath() === next) return;
  window.location.hash = `#${next}`;
  listeners.forEach((listener) => listener());
}

/** @returns {[string, (path: string) => void]} the current route path and `navigate` */
export function useRoute() {
  const path = useSyncExternalStore(subscribe, getPath, () => '/');
  const go = useCallback((target) => navigate(target), []);
  return [path, go];
}
