/**
 * ============================================================================
 * Connect Four — rules engine (pure, framework-free, unit-testable)
 * ============================================================================
 *  - 7 columns × 6 rows. Two players take turns dropping a disc into a column;
 *    it falls to the lowest free spot.
 *  - Connect four of your discs in a row (across, up/down or diagonal) to win.
 *  - A full board with no winner is a draw.
 *
 * The board is a flat array of 42 cells, row 0 at the TOP, row 5 at the bottom:
 * `index = row * COLS + col`. A cell is `null` or the index (0/1) of the player.
 * Every function takes a state and returns a NEW state; no timers, no RNG here.
 * ============================================================================
 */

export const ROWS = 6;
export const COLS = 7;
export const CONNECT = 4;
export const CELLS = ROWS * COLS;
export const PLAYER_COUNT = 2;
export const MAX_NAME_LENGTH = 14;

/** setup → playing ⇄ dropping (disc falling, input locked) → won | draw */
export const STATUS = Object.freeze({
  SETUP: 'setup',
  PLAYING: 'playing',
  DROPPING: 'dropping',
  WON: 'won',
  DRAW: 'draw',
});

export const DIFFICULTY = Object.freeze({ EASY: 'easy', NORMAL: 'normal', HARD: 'hard' });
const LEVELS = Object.values(DIFFICULTY);

/** The four line directions: →, ↓, ↘, ↙ (the opposite ones are covered by scanning both ways). */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export const cellIndex = (row, col) => row * COLS + col;

/* -------------------------------------------------------------------------- */
/* Players & state                                                             */
/* -------------------------------------------------------------------------- */

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

const cleanBot = (value) => (LEVELS.includes(value) ? value : null);
const cleanCount = (value) => Math.min(999, Math.max(0, Math.trunc(Number(value) || 0)));

/**
 * @param {{ playerNames?: string[], bots?: Array<string|null>, status?: string,
 *           startingPlayer?: number, scores?: number[], gameNumber?: number }} [options]
 */
export function createGame({
  playerNames = [],
  bots = [],
  status = STATUS.PLAYING,
  startingPlayer = 0,
  scores = [],
  gameNumber = 1,
} = {}) {
  const first = startingPlayer === 1 ? 1 : 0;
  return {
    status,
    board: Array(CELLS).fill(null),
    players: Array.from({ length: PLAYER_COUNT }, (_, index) => ({
      index,
      name: normalizeName(playerNames[index], index),
      bot: cleanBot(bots[index]),
    })),
    startingPlayer: first,
    currentPlayer: first,
    moves: 0,
    lastMove: null,
    winner: null,
    winningCells: [],
    /** Games won by each player since this pair sat down (survives rematches). */
    scores: Array.from({ length: PLAYER_COUNT }, (_, index) => cleanCount(scores[index])),
    gameNumber: Math.max(1, cleanCount(gameNumber) || 1),
  };
}

/** @param {object} state */
export const getCurrentPlayer = (state) => state.players[state.currentPlayer];

/** Difficulty of the player to move if it is a computer, else null. */
export const getBotLevel = (state) => getCurrentPlayer(state)?.bot ?? null;

export const isFinished = (state) => state.status === STATUS.WON || state.status === STATUS.DRAW;

/* -------------------------------------------------------------------------- */
/* Board helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The row a disc dropped into `col` would land on, or -1 when the column is full.
 * @param {Array<number|null>} board
 * @param {number} col
 */
export function dropRow(board, col) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[cellIndex(row, col)] === null) return row;
  }
  return -1;
}

/** Columns that still have room. @param {Array<number|null>} board */
export function legalMoves(board) {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) => board[col] === null);
}

/**
 * Cells of every run of four or more belonging to `player` that passes through
 * (row, col). Empty when that cell is not part of a winning line.
 * @param {Array<number|null>} board
 * @param {number} row
 * @param {number} col
 */
export function winningLineThrough(board, row, col) {
  const player = board[cellIndex(row, col)];
  if (player === null) return [];
  const cells = new Set();
  for (const [dr, dc] of DIRECTIONS) {
    const line = [cellIndex(row, col)];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[cellIndex(r, c)] === player) {
        line.push(cellIndex(r, c));
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= CONNECT) line.forEach((cell) => cells.add(cell));
  }
  return [...cells].sort((a, b) => a - b);
}

/**
 * Find a winner anywhere on the board (used to validate saved games).
 * @param {Array<number|null>} board
 * @returns {{ player: number, cells: number[] }|null}
 */
export function findWin(board) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[cellIndex(row, col)] === null) continue;
      const cells = winningLineThrough(board, row, col);
      if (cells.length > 0) return { player: board[cellIndex(row, col)], cells };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Drop the current player's disc into `col`.
 * Anti-bug: ignored unless the game is live, the column exists and has room.
 * @param {object} state
 * @param {number} col
 */
export function drop(state, col) {
  if (state.status !== STATUS.PLAYING) return state;
  const row = dropRow(state.board, col);
  if (row < 0) return state;

  const player = state.currentPlayer;
  const board = state.board.slice();
  board[cellIndex(row, col)] = player;
  const moves = state.moves + 1;
  const base = { ...state, board, moves, lastMove: { row, col, player, id: moves } };

  const winningCells = winningLineThrough(board, row, col);
  if (winningCells.length > 0) {
    return {
      ...base,
      status: STATUS.WON,
      winner: player,
      winningCells,
      scores: state.scores.map((wins, index) => (index === player ? wins + 1 : wins)),
    };
  }
  if (moves === CELLS) return { ...base, status: STATUS.DRAW };

  // `dropping` holds the falling-disc animation; the next player is already up.
  return { ...base, status: STATUS.DROPPING, currentPlayer: 1 - player };
}

/** Close the falling-disc window. Idempotent outside `dropping`. @param {object} state */
export function settleDrop(state) {
  return state.status === STATUS.DROPPING ? { ...state, status: STATUS.PLAYING } : state;
}

/**
 * Another game for the same two players; the other player starts, scores carry over.
 * @param {object} state
 */
export function rematch(state) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    bots: state.players.map((player) => player.bot),
    startingPlayer: 1 - state.startingPlayer,
    scores: state.scores,
    gameNumber: state.gameNumber + 1,
  });
}

/** Back to the player-setup screen (names and seats are kept). @param {object} state */
export function toSetup(state) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    bots: state.players.map((player) => player.bot),
    status: STATUS.SETUP,
  });
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rebuild a safe, playable state from untrusted stored data, or null.
 * The outcome is always recomputed from the board, never trusted from the payload.
 * @param {unknown} raw
 */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { board, players, startingPlayer } = raw;
  if (!Array.isArray(board) || board.length !== CELLS) return null;
  if (!board.every((cell) => cell === null || cell === 0 || cell === 1)) return null;
  if (!Array.isArray(players) || players.length !== PLAYER_COUNT) return null;

  const first = startingPlayer === 1 ? 1 : 0;
  const mine = board.filter((cell) => cell === first).length;
  const theirs = board.filter((cell) => cell === 1 - first).length;
  // Players alternate, so the starter has the same number of discs or one more.
  if (mine !== theirs && mine !== theirs + 1) return null;
  // Gravity: no disc may float above an empty cell.
  for (let col = 0; col < COLS; col += 1) {
    let seenDisc = false;
    for (let row = 0; row < ROWS; row += 1) {
      const filled = board[cellIndex(row, col)] !== null;
      if (seenDisc && !filled) return null;
      if (filled) seenDisc = true;
    }
  }

  const base = createGame({
    playerNames: players.map((player) => player?.name),
    bots: players.map((player) => player?.bot),
    startingPlayer: first,
    scores: Array.isArray(raw.scores) ? raw.scores : [],
    gameNumber: raw.gameNumber,
  });
  const moves = mine + theirs;
  const win = findWin(board);
  const lastMove = raw.lastMove && Number.isInteger(raw.lastMove.col) ? raw.lastMove : null;

  const state = { ...base, board: board.slice(), moves, lastMove: lastMove && { ...lastMove, id: moves } };
  if (win) {
    return {
      ...state,
      status: STATUS.WON,
      winner: win.player,
      winningCells: win.cells,
      currentPlayer: win.player,
    };
  }
  if (moves === CELLS) return { ...state, status: STATUS.DRAW };
  return {
    ...state,
    status: raw.status === STATUS.SETUP ? STATUS.SETUP : STATUS.PLAYING,
    currentPlayer: (first + moves) % 2,
  };
}
