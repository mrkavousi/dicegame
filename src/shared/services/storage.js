/**
 * ============================================================================
 * Storage service (shared)
 * ============================================================================
 * Thin, defensive wrapper around localStorage. Every call is guarded so that
 * private-mode browsers, disabled storage or quota errors degrade to a normal
 * in-memory game instead of crashing it.
 * ============================================================================
 */

const SETTINGS_KEY = 'pig.settings.v1';
const LANG_KEY = 'pig.lang.v1';

/** localStorage may be missing (SSR / tests) or throw (private mode). */
export function getStore() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__pig_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSON value, or `null` when missing / unreadable.
 * @param {string} key
 */
export function readJSON(key) {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Serialise a value under `key`. Failures (quota, private mode) are ignored.
 * @param {string} key
 * @param {unknown} value
 */
export function writeJSON(key, value) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** @param {string} key */
export function removeKey(key) {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{ muted: boolean, soundEnabled: boolean }}
 */
export function loadSettings() {
  const fallback = { muted: false, soundEnabled: true };
  const store = getStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      muted: Boolean(parsed?.muted),
      soundEnabled: parsed?.soundEnabled !== false,
    };
  } catch {
    return fallback;
  }
}

/**
 * @param {{ muted?: boolean, soundEnabled?: boolean }} settings
 */
export function saveSettings(settings) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** @returns {'en'|'fa'|null} the saved interface language, if any */
export function loadLanguage() {
  const store = getStore();
  if (!store) return null;
  try {
    const value = store.getItem(LANG_KEY);
    return value === 'en' || value === 'fa' ? value : null;
  } catch {
    return null;
  }
}

/** @param {'en'|'fa'} lang */
export function saveLanguage(lang) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}
