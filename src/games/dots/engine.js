/**
 * ============================================================================
 * Dots & Boxes — rules engine (pure, framework-free, unit-testable)
 * ============================================================================
 *  - A grid of dots. On your turn, draw ONE line between two neighbouring dots.
 *  - Draw the 4th side of a box and the box is yours (+1 point) — and you go again.
 *  - Otherwise the turn passes. When every line is drawn, the most boxes wins.
 *
 * There is no randomness anywhere in the rules. Every function takes a state and
 * returns a NEW state.
 *
 * Geometry: a board of N × N boxes has (N+1) × (N+1) dots and 2·N·(N+1) lines.
 *   horizontal line (row r in 0..N, col c in 0..N-1)  → index r·N + c
 *   vertical   line (row r in 0..N-1, col c in 0..N)  → H + r·(N+1) + c,  H = N·(N+1)
 * Box (r, c) is bounded by top h(r,c), bottom h(r+1,c), left v(r,c), right v(r,c+1).
 * ============================================================================
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 14;

/** Selectable boards (boxes per side). */
export const SIZES = Object.freeze([3, 4, 5, 6]);
export const DEFAULT_SIZE = 4;

export const STATUS = Object.freeze({ SETUP: 'setup', PLAYING: 'playing', WON: 'won' });
export const EVENT = Object.freeze({ LINE: 'line', BOX: 'box' });
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
 * @param {{ size?: number, playerCount?: number, bots?: Array<string|null> }} [raw]
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const playerCount = clampInt(input.playerCount, MIN_PLAYERS, MAX_PLAYERS, 2);
  return {
    size: SIZES.includes(Number(input.size)) ? Number(input.size) : DEFAULT_SIZE,
    playerCount,
    bots: Array.from({ length: playerCount }, (_, index) =>
      Array.isArray(input.bots) && LEVELS.includes(input.bots[index]) ? input.bots[index] : null,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Geometry (all pure functions of the board size)                             */
/* -------------------------------------------------------------------------- */

export const horizontalCount = (size) => size * (size + 1);
export const edgeCount = (size) => 2 * size * (size + 1);
export const boxCount = (size) => size * size;

/** @param {number} size @param {number} edge */
export const isHorizontal = (size, edge) => edge < horizontalCount(size);

/** Row/column of a line: `{ horizontal, row, col }`. */
export function edgePosition(size, edge) {
  if (isHorizontal(size, edge)) return { horizontal: true, row: Math.floor(edge / size), col: edge % size };
  const offset = edge - horizontalCount(size);
  return { horizontal: false, row: Math.floor(offset / (size + 1)), col: offset % (size + 1) };
}

/** The four lines around box `box`: [top, bottom, left, right]. */
export function boxEdges(size, box) {
  const row = Math.floor(box / size);
  const col = box % size;
  const h = horizontalCount(size);
  return [row * size + col, (row + 1) * size + col, h + row * (size + 1) + col, h + row * (size + 1) + col + 1];
}

/** The one or two boxes a line borders. */
export function edgeBoxes(size, edge) {
  const { horizontal, row, col } = edgePosition(size, edge);
  const boxes = [];
  if (horizontal) {
    if (row > 0) boxes.push((row - 1) * size + col);
    if (row < size) boxes.push(row * size + col);
  } else {
    if (col > 0) boxes.push(row * size + col - 1);
    if (col < size) boxes.push(row * size + col);
  }
  return boxes;
}

/** How many of a box's four lines are drawn. @param {Array<number|null>} edges */
export function sidesDrawn(size, edges, box) {
  return boxEdges(size, box).filter((edge) => edges[edge] !== null).length;
}

/**
 * Boxes that drawing `edge` would complete (it must be undrawn).
 * @param {number} size
 * @param {Array<number|null>} edges
 * @param {number} edge
 */
export function completes(size, edges, edge) {
  return edgeBoxes(size, edge).filter((box) => sidesDrawn(size, edges, box) === 3);
}

/** Every line not yet drawn. @param {Array<number|null>} edges */
export function undrawn(edges) {
  return edges.map((owner, i) => (owner === null ? i : -1)).filter((i) => i >= 0);
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
  return {
    status,
    config: rules,
    players: Array.from({ length: rules.playerCount }, (_, index) => ({
      index,
      name: normalizeName(playerNames[index], index),
      bot: rules.bots[index],
      score: 0,
    })),
    /** Who drew each line (player index) or null. */
    edges: Array(edgeCount(rules.size)).fill(null),
    /** Who completed each box (player index) or null. */
    boxes: Array(boxCount(rules.size)).fill(null),
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

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Draw the line `edge`.
 * Anti-bug: ignored unless the game is live, the line exists and is not yet drawn.
 * Completing one or two boxes scores them and keeps the turn; otherwise it passes.
 * @param {object} state
 * @param {number} edge
 */
export function drawLine(state, edge) {
  if (state.status !== STATUS.PLAYING) return state;
  const { size } = state.config;
  if (!Number.isInteger(edge) || edge < 0 || edge >= state.edges.length || state.edges[edge] !== null) return state;

  const player = state.currentPlayer;
  const edges = state.edges.slice();
  const taken = completes(size, state.edges, edge); // computed BEFORE the line is drawn
  edges[edge] = player;

  const boxes = state.boxes.slice();
  taken.forEach((box) => (boxes[box] = player));
  const moves = state.moves + 1;
  const players = state.players.map((entry) =>
    entry.index === player ? { ...entry, score: entry.score + taken.length } : entry,
  );
  const base = { ...state, edges, boxes, players, moves };

  if (taken.length === 0) {
    return {
      ...base,
      currentPlayer: (player + 1) % state.players.length,
      lastEvent: { type: EVENT.LINE, edge, player, id: moves },
    };
  }

  const next = { ...base, lastEvent: { type: EVENT.BOX, edge, boxes: taken, player, id: moves } };
  if (boxes.some((owner) => owner === null)) return next; // box(es) completed: the same player goes again

  const top = Math.max(...players.map((entry) => entry.score));
  return {
    ...next,
    status: STATUS.WON,
    winners: players.filter((entry) => entry.score === top).map((entry) => entry.index),
  };
}

/**
 * Another game for the same players: an empty board, the next player starts.
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
 * Boxes and scores are recomputed from the lines, never trusted.
 * @param {unknown} raw
 */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const config = normalizeConfig(raw.config);
  const { size } = config;
  const { edges, players } = raw;
  if (!Array.isArray(edges) || edges.length !== edgeCount(size)) return null;
  if (!Array.isArray(players) || players.length !== config.playerCount) return null;
  const validOwner = (owner) => owner === null || (Number.isInteger(owner) && owner >= 0 && owner < config.playerCount);
  if (!edges.every(validOwner)) return null;

  const base = createGame({ playerNames: players.map((player) => player?.name), config, gameNumber: raw.gameNumber });
  const storedBoxes = Array.isArray(raw.boxes) ? raw.boxes : [];
  const boxes = Array.from({ length: boxCount(size) }, (_, box) => {
    if (sidesDrawn(size, edges, box) < 4) return null;
    // A finished box belongs to whoever the save says; fall back to whoever drew its last line.
    return validOwner(storedBoxes[box]) && storedBoxes[box] !== null
      ? storedBoxes[box]
      : (edges[boxEdges(size, box)[0]] ?? 0);
  });
  const scores = Array(config.playerCount).fill(0);
  boxes.forEach((owner) => {
    if (owner !== null) scores[owner] += 1;
  });

  const state = {
    ...base,
    edges: edges.slice(),
    boxes,
    players: base.players.map((player) => ({ ...player, score: scores[player.index] })),
    currentPlayer: Number.isInteger(raw.currentPlayer) ? clampInt(raw.currentPlayer, 0, config.playerCount - 1, 0) : 0,
    moves: clampInt(raw.moves, 0, 100000, 0),
    status: raw.status === STATUS.SETUP ? STATUS.SETUP : STATUS.PLAYING,
  };
  if (boxes.every((owner) => owner !== null)) {
    const top = Math.max(...state.players.map((player) => player.score));
    return {
      ...state,
      status: STATUS.WON,
      winners: state.players.filter((player) => player.score === top).map((player) => player.index),
    };
  }
  return state;
}
