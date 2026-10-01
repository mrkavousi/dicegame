/**
 * ============================================================================
 * Memory Match — rules engine (pure, framework-free, unit-testable)
 * ============================================================================
 *  - A grid of face-down cards hides pairs of identical symbols.
 *  - On your turn flip two cards. A match scores a point and you go again; a
 *    miss turns both cards back over and the turn passes to the next player.
 *  - When every pair is found the player with the most pairs wins (ties allowed).
 *    With one player it is a solo game: find them all in as few tries as you can.
 *
 * Every function takes a state and returns a NEW state. Randomness (the shuffle)
 * is injected, so a game can be reproduced exactly in tests.
 * ============================================================================
 */

import { shuffle } from '../../shared/utils/random.js';

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 14;

/** Distinct symbols available (6 shapes × 3 colours in the UI). */
export const SYMBOL_COUNT = 18;

/** Board sizes — cells must be even. */
export const SIZES = Object.freeze({
  '3x4': { rows: 3, cols: 4 },
  '4x4': { rows: 4, cols: 4 },
  '4x5': { rows: 4, cols: 5 },
  '6x6': { rows: 6, cols: 6 },
});
export const DEFAULT_SIZE = '4x4';

/** setup → playing → checking (two cards face up, input locked) → playing … → won */
export const STATUS = Object.freeze({
  SETUP: 'setup',
  PLAYING: 'playing',
  CHECKING: 'checking',
  WON: 'won',
});

export const DIFFICULTY = Object.freeze({ EASY: 'easy', NORMAL: 'normal', HARD: 'hard' });
const LEVELS = Object.values(DIFFICULTY);

const clampInt = (value, min, max, fallback) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

/**
 * @param {unknown} name
 * @param {number} index
 */
export function normalizeName(name, index) {
  const fallback = `Player ${index + 1}`;
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Safe config from untrusted/partial input.
 * @param {{ size?: string, playerCount?: number, bots?: Array<string|null> }} [raw]
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const playerCount = clampInt(input.playerCount, MIN_PLAYERS, MAX_PLAYERS, 2);
  return {
    size: Object.hasOwn(SIZES, input.size) ? input.size : DEFAULT_SIZE,
    playerCount,
    bots: Array.from({ length: playerCount }, (_, index) =>
      Array.isArray(input.bots) && LEVELS.includes(input.bots[index]) ? input.bots[index] : null,
    ),
  };
}

export const cellCount = (config) => SIZES[config.size].rows * SIZES[config.size].cols;

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build the hidden deck: `cells / 2` distinct symbols, each twice, shuffled.
 * @param {number} cells
 * @param {() => number} rng
 */
export function buildDeck(cells, rng) {
  const ids = shuffle(
    Array.from({ length: SYMBOL_COUNT }, (_, i) => i),
    rng,
  ).slice(0, cells / 2);
  return shuffle([...ids, ...ids], rng);
}

/**
 * @param {{ playerNames?: string[], config?: object, status?: string,
 *           rng?: () => number, gameNumber?: number }} [options]
 */
export function createGame({
  playerNames = [],
  config,
  status = STATUS.PLAYING,
  rng = Math.random,
  gameNumber = 1,
} = {}) {
  const rules = normalizeConfig(config);
  const cells = cellCount(rules);
  const number = clampInt(gameNumber, 1, 999, 1);
  return {
    status,
    config: rules,
    players: Array.from({ length: rules.playerCount }, (_, index) => ({
      index,
      name: normalizeName(playerNames[index], index),
      bot: rules.bots[index],
      score: 0,
    })),
    /** The hidden symbol at each position. */
    deck: buildDeck(cells, rng),
    /** Owner (player index) of each found card, or null. */
    matched: Array(cells).fill(null),
    /** Cards that have been face-up at least once — what a player could remember. */
    seen: Array(cells).fill(false),
    /** Cards currently face-up and not yet judged (0, 1 or 2 positions). */
    flipped: [],
    // The first player rotates from game to game.
    currentPlayer: (number - 1) % rules.playerCount,
    moves: 0,
    lastEvent: null,
    winners: [],
    gameNumber: number,
  };
}

/** @param {object} state */
export const getCurrentPlayer = (state) => state.players[state.currentPlayer];

/** Difficulty of the player to move if it is a computer, else null. */
export const getBotLevel = (state) => getCurrentPlayer(state)?.bot ?? null;

export const isFinished = (state) => state.status === STATUS.WON;

/** Positions that can still be flipped. @param {object} state */
export function flippable(state) {
  return state.matched.map((owner, i) => i).filter((i) => state.matched[i] === null && !state.flipped.includes(i));
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Flip the card at `index` face-up.
 * Anti-bug: ignored unless the game is live, the card exists, is not already
 * found and is not already face-up; a third flip is impossible while checking.
 * @param {object} state
 * @param {number} index
 */
export function flip(state, index) {
  if (state.status !== STATUS.PLAYING) return state;
  if (!Number.isInteger(index) || index < 0 || index >= state.deck.length) return state;
  if (state.matched[index] !== null || state.flipped.includes(index)) return state;

  const seen = state.seen.slice();
  seen[index] = true;
  const flipped = [...state.flipped, index];
  return { ...state, seen, flipped, status: flipped.length === 2 ? STATUS.CHECKING : STATUS.PLAYING };
}

/**
 * Judge the two face-up cards. Idempotent outside `checking`.
 *  - match: the player scores and goes again (or the game ends);
 *  - miss: both cards turn back over and the next player is up.
 * @param {object} state
 */
export function resolve(state) {
  if (state.status !== STATUS.CHECKING || state.flipped.length !== 2) return state;
  const [a, b] = state.flipped;
  const player = state.currentPlayer;
  const moves = state.moves + 1;

  if (state.deck[a] !== state.deck[b]) {
    return {
      ...state,
      status: STATUS.PLAYING,
      flipped: [],
      moves,
      currentPlayer: (player + 1) % state.players.length,
      lastEvent: { type: 'miss', cells: [a, b], player, id: moves },
    };
  }

  const matched = state.matched.slice();
  matched[a] = player;
  matched[b] = player;
  const players = state.players.map((entry) => (entry.index === player ? { ...entry, score: entry.score + 1 } : entry));
  const next = {
    ...state,
    matched,
    players,
    flipped: [],
    moves,
    status: STATUS.PLAYING,
    lastEvent: { type: 'match', cells: [a, b], player, id: moves },
  };
  if (matched.some((owner) => owner === null)) return next;

  const top = Math.max(...players.map((entry) => entry.score));
  return {
    ...next,
    status: STATUS.WON,
    winners: players.filter((entry) => entry.score === top).map((entry) => entry.index),
  };
}

/**
 * Another game for the same players: fresh shuffle, the next player starts.
 * @param {object} state
 * @param {() => number} [rng]
 */
export function rematch(state, rng = Math.random) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    config: state.config,
    rng,
    gameNumber: state.gameNumber + 1,
  });
}

/** Back to setup, keeping names and seats. @param {object} state */
export function toSetup(state) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    config: state.config,
    status: STATUS.SETUP,
  });
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rebuild a safe, playable state from untrusted stored data, or null.
 * Scores and the winner are recomputed from the board, never trusted.
 * @param {unknown} raw
 */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const config = normalizeConfig(raw.config);
  const cells = cellCount(config);
  const { deck, matched, players } = raw;
  if (!Array.isArray(deck) || deck.length !== cells) return null;
  if (!Array.isArray(matched) || matched.length !== cells) return null;
  if (!Array.isArray(players) || players.length !== config.playerCount) return null;

  // Every symbol must appear exactly twice.
  const counts = new Map();
  for (const symbol of deck) {
    if (!Number.isInteger(symbol) || symbol < 0 || symbol >= SYMBOL_COUNT) return null;
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  if ([...counts.values()].some((count) => count !== 2)) return null;

  // Found cards: valid owner, and a pair is found together by one player.
  if (
    !matched.every((owner) => owner === null || (Number.isInteger(owner) && owner >= 0 && owner < config.playerCount))
  ) {
    return null;
  }
  for (let i = 0; i < cells; i += 1) {
    const twin = deck.findIndex((symbol, j) => j !== i && symbol === deck[i]);
    if (matched[i] !== matched[twin]) return null;
  }

  const base = createGame({ playerNames: players.map((player) => player?.name), config, gameNumber: raw.gameNumber });
  const scores = Array(config.playerCount).fill(0);
  matched.forEach((owner) => {
    if (owner !== null) scores[owner] += 0.5;
  });
  const flipped = Array.isArray(raw.flipped)
    ? raw.flipped
        .filter(
          (i, pos, all) => Number.isInteger(i) && i >= 0 && i < cells && matched[i] === null && all.indexOf(i) === pos,
        )
        .slice(0, 2)
    : [];

  let state = {
    ...base,
    deck: deck.slice(),
    matched: matched.slice(),
    seen: Array.from({ length: cells }, (_, i) => matched[i] !== null || raw.seen?.[i] === true),
    flipped,
    players: base.players.map((player) => ({ ...player, score: scores[player.index] })),
    currentPlayer: Number.isInteger(raw.currentPlayer)
      ? clampInt(raw.currentPlayer, 0, config.playerCount - 1, 0)
      : base.currentPlayer,
    moves: clampInt(raw.moves, 0, 100000, 0),
    status: raw.status === STATUS.SETUP ? STATUS.SETUP : flipped.length === 2 ? STATUS.CHECKING : STATUS.PLAYING,
  };
  flipped.forEach((i) => (state.seen[i] = true));
  if (state.status === STATUS.CHECKING) state = resolve(state);

  if (matched.every((owner) => owner !== null)) {
    const top = Math.max(...state.players.map((player) => player.score));
    return {
      ...state,
      status: STATUS.WON,
      winners: state.players.filter((player) => player.score === top).map((player) => player.index),
    };
  }
  return state;
}
