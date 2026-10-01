/**
 * ============================================================================
 * Mancala (Kalah) — rules engine (pure, framework-free, unit-testable)
 * ============================================================================
 * Two players, six pits each, and a store ("mancala") at the end of the board.
 *
 *  - Pick one of YOUR pits and pick up all its stones, then sow them one by one,
 *    counter-clockwise, starting with the next pit. Your own store gets a stone
 *    each lap; your opponent's store is skipped.
 *  - Last stone in YOUR store → you play again.
 *  - Last stone in an EMPTY pit of yours, with stones in the pit opposite →
 *    capture: those stones plus your last stone go to your store.
 *  - The game ends when one side has no stones left; the other player keeps the
 *    stones still on their side. Most stones in the store wins.
 *
 * Layout: a flat array of 14 numbers
 *   0..5   player 0's pits (left → right along the bottom)     6  player 0's store
 *   7..12  player 1's pits (right → left along the top)       13  player 1's store
 * The pit opposite pit i (a pit, not a store) is 12 − i.
 * Every function takes a state and returns a NEW state. There is no randomness.
 * ============================================================================
 */

export const PITS = 6;
export const BOARD = 14;
export const STORE = Object.freeze([6, 13]);
export const MAX_NAME_LENGTH = 14;

/** Stones per pit at the start (3 = a quicker game). */
export const STONES = Object.freeze([3, 4, 5]);
export const DEFAULT_STONES = 4;

/** setup → playing ⇄ sowing (stones moving, input locked) → won */
export const STATUS = Object.freeze({ SETUP: 'setup', PLAYING: 'playing', SOWING: 'sowing', WON: 'won' });
export const EVENT = Object.freeze({ MOVE: 'move', EXTRA: 'extra', CAPTURE: 'capture' });
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
 * @param {{ stones?: number, bots?: Array<string|null> }} [raw]
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    stones: STONES.includes(Number(input.stones)) ? Number(input.stones) : DEFAULT_STONES,
    bots: [0, 1].map((index) =>
      Array.isArray(input.bots) && LEVELS.includes(input.bots[index]) ? input.bots[index] : null,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Board helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Pit numbers (1–6) → board index for a player: the n-th pit in sowing order. */
export const pitIndex = (player, n) => (player === 0 ? n - 1 : PITS + n);

/** Which player owns a pit index (stores included): 0 or 1. */
export const ownerOf = (index) => (index <= STORE[0] ? 0 : 1);

/** Is `index` one of the six pits (not a store) of `player`? */
export const isOwnPit = (player, index) =>
  player === 0 ? index >= 0 && index < PITS : index > STORE[0] && index < STORE[1];

/** The pit facing `index` across the board. */
export const oppositeOf = (index) => 12 - index;

/** The six pit indexes of a player, in sowing order. */
export const pitsOf = (player) => Array.from({ length: PITS }, (_, i) => pitIndex(player, i + 1));

const sum = (pits, indexes) => indexes.reduce((total, index) => total + pits[index], 0);

/** Pits the player may play (own, non-empty). @param {number[]} pits @param {number} player */
export const legalMoves = (pits, player) => pitsOf(player).filter((index) => pits[index] > 0);

/**
 * Apply one move to a bare board. Pure; used by the engine and the bot.
 * @param {number[]} pits
 * @param {number} player
 * @param {number} pit a board index that `legalMoves` allows
 * @returns {{ pits: number[], path: number[], extra: boolean, captured: number, over: boolean }}
 */
export function sow(pits, player, pit) {
  const board = pits.slice();
  const myStore = STORE[player];
  const theirStore = STORE[1 - player];
  let stones = board[pit];
  board[pit] = 0;
  let index = pit;
  const path = [];
  while (stones > 0) {
    index = (index + 1) % BOARD;
    if (index === theirStore) continue; // never feed the opponent's store
    board[index] += 1;
    stones -= 1;
    path.push(index);
  }

  const extra = index === myStore;
  let captured = 0;
  if (!extra && isOwnPit(player, index) && board[index] === 1 && board[oppositeOf(index)] > 0) {
    captured = board[oppositeOf(index)] + 1;
    board[myStore] += captured;
    board[index] = 0;
    board[oppositeOf(index)] = 0;
  }

  const over = sum(board, pitsOf(0)) === 0 || sum(board, pitsOf(1)) === 0;
  if (over) {
    // Whoever still has stones on their side keeps them.
    [0, 1].forEach((p) => {
      board[STORE[p]] += sum(board, pitsOf(p));
      pitsOf(p).forEach((i) => (board[i] = 0));
    });
  }
  return { pits: board, path, extra, captured, over };
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * @param {{ playerNames?: string[], config?: object, status?: string, gameNumber?: number }} [options]
 */
export function createGame({ playerNames = [], config, status = STATUS.PLAYING, gameNumber = 1 } = {}) {
  const rules = normalizeConfig(config);
  const number = clampInt(gameNumber, 1, 999, 1);
  const pits = Array(BOARD).fill(rules.stones);
  STORE.forEach((index) => (pits[index] = 0));
  return {
    status,
    config: rules,
    players: [0, 1].map((index) => ({ index, name: normalizeName(playerNames[index], index), bot: rules.bots[index] })),
    pits,
    // The first player alternates from game to game.
    currentPlayer: (number - 1) % 2,
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

/** Store counts as [player 0, player 1]. @param {object} state */
export const scores = (state) => [state.pits[STORE[0]], state.pits[STORE[1]]];

/** Winners from final store counts. @param {number[]} pits */
function winnersOf(pits) {
  const [a, b] = [pits[STORE[0]], pits[STORE[1]]];
  return a === b ? [0, 1] : a > b ? [0] : [1];
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Play the pit at board index `pit` for the current player.
 * Anti-bug: ignored unless the game is live, the pit is the player's own and not empty.
 * @param {object} state
 * @param {number} pit
 */
export function play(state, pit) {
  if (state.status !== STATUS.PLAYING) return state;
  const player = state.currentPlayer;
  if (!Number.isInteger(pit) || !isOwnPit(player, pit) || state.pits[pit] === 0) return state;

  const result = sow(state.pits, player, pit);
  const moves = state.moves + 1;
  const type = result.captured > 0 ? EVENT.CAPTURE : result.extra ? EVENT.EXTRA : EVENT.MOVE;
  const lastEvent = { type, pit, path: result.path, captured: result.captured, player, id: moves };
  const base = { ...state, pits: result.pits, moves, lastEvent };

  if (result.over) return { ...base, status: STATUS.WON, winners: winnersOf(result.pits) };
  // `sowing` holds the animation; the next player (or the same one, after an extra turn) is already up.
  return { ...base, status: STATUS.SOWING, currentPlayer: result.extra ? player : 1 - player };
}

/** Close the sowing animation window. Idempotent outside `sowing`. @param {object} state */
export function settle(state) {
  return state.status === STATUS.SOWING ? { ...state, status: STATUS.PLAYING } : state;
}

/**
 * Another game for the same players: a fresh board, the other player starts.
 * @param {object} state
 */
export function rematch(state) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    config: state.config,
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
 * No stone can appear or vanish: the board must hold exactly 12 × stones.
 * @param {unknown} raw
 */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const config = normalizeConfig(raw.config);
  const { pits, players } = raw;
  if (!Array.isArray(pits) || pits.length !== BOARD) return null;
  if (!pits.every((count) => Number.isInteger(count) && count >= 0)) return null;
  if (pits.reduce((total, count) => total + count, 0) !== 2 * PITS * config.stones) return null;
  if (!Array.isArray(players) || players.length !== 2) return null;

  const base = createGame({ playerNames: players.map((player) => player?.name), config, gameNumber: raw.gameNumber });
  const state = {
    ...base,
    pits: pits.slice(),
    currentPlayer: raw.currentPlayer === 1 ? 1 : 0,
    moves: clampInt(raw.moves, 0, 100000, 0),
    status: raw.status === STATUS.SETUP ? STATUS.SETUP : STATUS.PLAYING,
  };
  // A board with an empty side is a finished game: sweep and score it.
  if (sum(pits, pitsOf(0)) === 0 || sum(pits, pitsOf(1)) === 0) {
    const swept = pits.slice();
    [0, 1].forEach((p) => {
      swept[STORE[p]] += sum(swept, pitsOf(p));
      pitsOf(p).forEach((i) => (swept[i] = 0));
    });
    return { ...state, pits: swept, status: STATUS.WON, winners: winnersOf(swept) };
  }
  return state;
}
