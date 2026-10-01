/**
 * ============================================================================
 * Dots & Boxes — computer opponent (pure)
 * ============================================================================
 * `chooseLine(state, level, rng)` returns the line the computer should draw.
 *
 *  - Easy   — takes a box when one is on offer, otherwise draws a random line.
 *  - Normal — takes boxes, then prefers "safe" lines that don't give the next
 *             player a box (a third side). When every line gives something away
 *             it gives away as little as it can.
 *  - Hard   — Normal until the board gets small; with two players it then SOLVES
 *             the rest of the game exactly (memoised search over the undrawn
 *             lines), which finds the classic sacrifices (declining the last two
 *             boxes of a chain to keep control).
 *
 * Ties are broken with the injected `rng`, so games vary but tests are exact.
 * ============================================================================
 */

import { DIFFICULTY, completes, edgeBoxes, sidesDrawn, undrawn } from './engine.js';

/** Hard solves exactly once at most this many lines are left (2 players only). */
export const SOLVE_LIMIT = 14;

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** Lines that complete at least one box, with how many they complete. */
function capturing(size, edges) {
  return undrawn(edges)
    .map((edge) => ({ edge, boxes: completes(size, edges, edge).length }))
    .filter((move) => move.boxes > 0);
}

/** A line is safe when it leaves every bordering box with at most two sides. */
const isSafe = (size, edges, edge) => edgeBoxes(size, edge).every((box) => sidesDrawn(size, edges, box) <= 1);

/**
 * How many boxes the next player could grab greedily after `edge` is drawn.
 * (Used to choose the cheapest sacrifice when no line is safe.)
 */
function gift(size, edges, edge) {
  const board = edges.slice();
  board[edge] = 1;
  let total = 0;
  for (;;) {
    const next = capturing(size, board)[0];
    if (!next) return total;
    total += next.boxes;
    board[next.edge] = 1;
  }
}

/**
 * Positions are solved once and remembered for the whole session: a position's value
 * depends only on the board size and which lines are drawn, never on the game.
 */
const MEMOS = new Map();
const memoFor = (size) => {
  if (!MEMOS.has(size)) MEMOS.set(size, new Map());
  return MEMOS.get(size);
};

/**
 * Exact value of a position for the player to move, as (their boxes − the
 * opponent's boxes) from here on. Two players only.
 * @param {number} size
 * @param {Array<number|null>} edges
 * @param {Map<string, number>} [memo] defaults to a shared cache for this board size
 */
export function solve(size, edges, memo = memoFor(size)) {
  const key = edges.map((owner) => (owner === null ? 0 : 1)).join('');
  if (memo.has(key)) return memo.get(key);
  const lines = undrawn(edges);
  let best = -Infinity;
  for (const edge of lines) {
    const gained = completes(size, edges, edge).length;
    const next = edges.slice();
    next[edge] = 1;
    // Completing a box means moving again; otherwise the opponent is up.
    const value = gained > 0 ? gained + (lines.length > 1 ? solve(size, next, memo) : 0) : -solve(size, next, memo);
    if (value > best) best = value;
  }
  memo.set(key, best === -Infinity ? 0 : best);
  return memo.get(key);
}

/** Value (for the mover) of drawing `edge` now, using `solve` for the rest. */
function exactValue(size, edges, edge, memo) {
  const gained = completes(size, edges, edge).length;
  const next = edges.slice();
  next[edge] = 1;
  const remaining = undrawn(next).length;
  if (gained > 0) return gained + (remaining > 0 ? solve(size, next, memo) : 0);
  return -solve(size, next, memo);
}

/**
 * @param {object} state a live game
 * @param {string} [level] defaults to the player-to-move's own difficulty
 * @param {() => number} [rng]
 * @returns {number} an undrawn line
 */
export function chooseLine(
  state,
  level = state.players[state.currentPlayer]?.bot ?? DIFFICULTY.EASY,
  rng = Math.random,
) {
  const { size } = state.config;
  const { edges } = state;
  const lines = undrawn(edges);
  if (lines.length === 1) return lines[0];

  // Hard, two players, small enough board: play perfectly.
  if (level === DIFFICULTY.HARD && state.players.length === 2 && lines.length <= SOLVE_LIMIT) {
    const memo = memoFor(size);
    let best = -Infinity;
    let bestMoves = [];
    for (const edge of lines) {
      const value = exactValue(size, edges, edge, memo);
      if (value > best) {
        best = value;
        bestMoves = [edge];
      } else if (value === best) bestMoves.push(edge);
    }
    return pick(bestMoves, rng);
  }

  const takes = capturing(size, edges);
  if (takes.length > 0) {
    // Easy takes any box; the others take the biggest bite (a double box first).
    if (level === DIFFICULTY.EASY) return pick(takes, rng).edge;
    const most = Math.max(...takes.map((move) => move.boxes));
    return pick(
      takes.filter((move) => move.boxes === most),
      rng,
    ).edge;
  }

  if (level === DIFFICULTY.EASY) return pick(lines, rng);

  const safe = lines.filter((edge) => isSafe(size, edges, edge));
  if (safe.length > 0) return pick(safe, rng);

  // Every line gives something away: give away the least.
  const cost = lines.map((edge) => ({ edge, gift: gift(size, edges, edge) }));
  const least = Math.min(...cost.map((entry) => entry.gift));
  return pick(
    cost.filter((entry) => entry.gift === least),
    rng,
  ).edge;
}
