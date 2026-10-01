/**
 * ============================================================================
 * PIG — Storage service
 * ============================================================================
 * Thin, defensive wrapper around localStorage. Every call is guarded so that
 * private-mode browsers, disabled storage or quota errors degrade to a normal
 * in-memory game instead of crashing it.
 * ============================================================================
 */

import { GAME_STATUS, normalizeConfig, restoreGame } from '../utils/gameLogic.js';
import { emptyStats, normalizeStats } from '../utils/stats.js';

const GAME_KEY = 'pig.game.v1';
const SETTINGS_KEY = 'pig.settings.v1';
const CONFIG_KEY = 'pig.config.v1';
const STATS_KEY = 'pig.stats.v1';
const LANG_KEY = 'pig.lang.v1';

/** localStorage may be missing (SSR / tests) or throw (private mode). */
function getStore() {
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
 * Persist the game so a refresh can resume it.
 * Transient animation frames are stored as their settled status.
 * @param {object} state
 */
export function saveGame(state) {
  const store = getStore();
  if (!store || !state) return;

  // There is nothing worth resuming from the setup screen.
  if (state.status === GAME_STATUS.SETUP) {
    clearGame();
    return;
  }

  try {
    const payload = {
      ...state,
      status: state.status === GAME_STATUS.ROLLING ? GAME_STATUS.PLAYING : state.status,
      lastEvent: null, // never replay stale banners on resume
    };
    store.setItem(GAME_KEY, JSON.stringify(payload));
  } catch {
    /* out of quota — the game keeps running in memory */
  }
}

/**
 * @returns {object|null} a resumable, validated game state
 */
export function loadGame() {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(GAME_KEY);
    if (!raw) return null;
    const state = restoreGame(JSON.parse(raw));
    // A "setup" snapshot is useless to resume into.
    if (!state || state.status === GAME_STATUS.SETUP) return null;
    return state;
  } catch {
    return null;
  }
}

/** Remove any saved game. */
export function clearGame() {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(GAME_KEY);
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

/** @returns {ReturnType<typeof emptyStats>} lifetime stats (empty when none are stored) */
export function loadStats() {
  const store = getStore();
  if (!store) return emptyStats();
  try {
    const raw = store.getItem(STATS_KEY);
    return raw ? normalizeStats(JSON.parse(raw)) : emptyStats();
  } catch {
    return emptyStats();
  }
}

/** @param {ReturnType<typeof emptyStats>} stats */
export function saveStats(stats) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

/**
 * The last-used game settings (target score, players, variant).
 * @returns {import('../utils/gameLogic.js').GameConfig}
 */
export function loadConfig() {
  const store = getStore();
  if (!store) return normalizeConfig();
  try {
    const raw = store.getItem(CONFIG_KEY);
    return normalizeConfig(raw ? JSON.parse(raw) : undefined);
  } catch {
    return normalizeConfig();
  }
}

/** @param {import('../utils/gameLogic.js').GameConfig} config */
export function saveConfig(config) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(CONFIG_KEY, JSON.stringify(normalizeConfig(config)));
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
