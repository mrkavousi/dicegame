/**
 * ============================================================================
 * Connect Four — computer opponent (pure)
 * ============================================================================
 * `chooseMove(state, level, rng)` returns the column the computer should play.
 *
 *  - Easy   — takes a win if there is one, blocks an immediate loss, otherwise
 *             plays a random column that does not hand the opponent a win.
 *  - Normal — negamax with alpha-beta pruning, 4 plies deep.
 *  - Hard   — the same search, 6 plies deep.
 *
 * Moves with equal scores are picked at random (via the injected `rng`) so the
 * computer does not play the same game every time.
 * ============================================================================
 */

import { CELLS, COLS, DIFFICULTY, ROWS, cellIndex, dropRow, legalMoves, winningLineThrough } from './engine.js';

const DEPTH = { [DIFFICULTY.NORMAL]: 4, [DIFFICULTY.HARD]: 6 };
const WIN_SCORE = 100000;

/** Search the centre first: better moves earlier means more pruning. */
const ORDER = [3, 2, 4, 1, 5, 0, 6];

/** Would `player` win by dropping into `col`? (does not mutate `board`) */
function winsAt(board, player, col) {
  const row = dropRow(board, col);
  if (row < 0) return false;
  board[cellIndex(row, col)] = player;
  const won = winningLineThrough(board, row, col).length > 0;
  board[cellIndex(row, col)] = null;
  return won;
}

/** Static score of a position from `player`'s point of view (windows of four + centre). */
function evaluate(board, player) {
  let score = 0;
  for (let row = 0; row < ROWS; row += 1) {
    const centre = board[cellIndex(row, 3)];
    if (centre === player) score += 3;
    else if (centre !== null) score -= 3;
  }
  const windows = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      for (const [dr, dc] of windows) {
        const endRow = row + dr * 3;
        const endCol = col + dc * 3;
        if (endRow < 0 || endRow >= ROWS || endCol < 0 || endCol >= COLS) continue;
        let mine = 0;
        let theirs = 0;
        for (let step = 0; step < 4; step += 1) {
          const cell = board[cellIndex(row + dr * step, col + dc * step)];
          if (cell === player) mine += 1;
          else if (cell !== null) theirs += 1;
        }
        if (mine > 0 && theirs > 0) continue;
        if (mine === 3) score += 6;
        else if (mine === 2) score += 2;
        if (theirs === 3) score -= 5;
        else if (theirs === 2) score -= 1;
      }
    }
  }
  return score;
}

/**
 * Negamax with alpha-beta pruning. `placed` counts discs on the board.
 * Positive = good for `player` (the side to move).
 */
function negamax(board, player, depth, alpha, beta, placed) {
  if (placed === CELLS) return 0;
  if (depth === 0) return evaluate(board, player);

  let best = -Infinity;
  for (const col of ORDER) {
    const row = dropRow(board, col);
    if (row < 0) continue;
    board[cellIndex(row, col)] = player;
    // Winning sooner is better than winning later (depth is the bonus).
    const score =
      winningLineThrough(board, row, col).length > 0
        ? WIN_SCORE + depth
        : -negamax(board, 1 - player, depth - 1, -beta, -alpha, placed + 1);
    board[cellIndex(row, col)] = null;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/**
 * @param {object} state a live game
 * @param {string} [level] defaults to the player-to-move's own difficulty
 * @param {() => number} [rng]
 * @returns {number} a legal column
 */
export function chooseMove(
  state,
  level = state.players[state.currentPlayer]?.bot ?? DIFFICULTY.EASY,
  rng = Math.random,
) {
  const board = state.board.slice();
  const me = state.currentPlayer;
  const moves = legalMoves(board);
  if (moves.length <= 1) return moves[0] ?? 0;

  // Every level grabs an immediate win…
  const winning = moves.filter((col) => winsAt(board, me, col));
  if (winning.length > 0) return pick(winning, rng);
  // …and blocks an immediate loss.
  const blocks = moves.filter((col) => winsAt(board, 1 - me, col));
  if (blocks.length > 0) return pick(blocks, rng);

  if (level === DIFFICULTY.EASY) {
    // Avoid moves that let the opponent win by stacking on top.
    const safe = moves.filter((col) => {
      const row = dropRow(board, col);
      if (row <= 0) return true;
      board[cellIndex(row, col)] = me;
      const handsOver = winsAt(board, 1 - me, col);
      board[cellIndex(row, col)] = null;
      return !handsOver;
    });
    return pick(safe.length > 0 ? safe : moves, rng);
  }

  const depth = DEPTH[level] ?? DEPTH[DIFFICULTY.NORMAL];
  const placed = state.moves;
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const col of ORDER) {
    const row = dropRow(board, col);
    if (row < 0) continue;
    board[cellIndex(row, col)] = me;
    const score = -negamax(board, 1 - me, depth - 1, -Infinity, Infinity, placed + 1);
    board[cellIndex(row, col)] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [col];
    } else if (score === bestScore) {
      bestMoves.push(col);
    }
  }
  return pick(bestMoves, rng);
}
