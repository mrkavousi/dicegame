/**
 * ============================================================================
 * Mancala — computer opponent (pure)
 * ============================================================================
 * `chooseMove(state, level, rng)` returns the board index of the pit to play.
 *
 *  - Easy   — a random legal pit.
 *  - Normal — greedy: looks one move ahead and takes the best immediate result
 *             (an extra turn counts a lot, then captures, then store stones).
 *  - Hard   — minimax with alpha-beta pruning, 7 plies deep. Extra turns are
 *             handled properly (the same player moves again), and the score is
 *             the difference between the two stores.
 *
 * Ties are broken with the injected `rng`, so games vary but tests are exact.
 * ============================================================================
 */

import { DIFFICULTY, STORE, legalMoves, sow } from './engine.js';

export const HARD_DEPTH = 7;
const EXTRA_BONUS = 3; // how much a Normal bot likes an extra turn, in stones

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** Store difference from `player`'s point of view. */
const margin = (pits, player) => pits[STORE[player]] - pits[STORE[1 - player]];

/**
 * Minimax / alpha-beta. Returns the best achievable margin for `me` from this
 * position, with `mover` to play. An extra turn keeps `mover`; otherwise it swaps.
 */
function search(pits, mover, me, depth, alpha, beta) {
  const moves = legalMoves(pits, mover);
  if (depth === 0 || moves.length === 0) return margin(pits, me);

  const maximizing = mover === me;
  let best = maximizing ? -Infinity : Infinity;
  // Try the pits nearest the store first: they tend to make extra turns, which prunes better.
  for (const pit of moves.slice().reverse()) {
    const result = sow(pits, mover, pit);
    const value = result.over
      ? margin(result.pits, me)
      : search(result.pits, result.extra ? mover : 1 - mover, me, depth - 1, alpha, beta);
    if (maximizing) {
      if (value > best) best = value;
      if (best > alpha) alpha = best;
    } else {
      if (value < best) best = value;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * @param {object} state a live game
 * @param {string} [level] defaults to the player-to-move's own difficulty
 * @param {() => number} [rng]
 * @returns {number} the board index of a legal pit
 */
export function chooseMove(
  state,
  level = state.players[state.currentPlayer]?.bot ?? DIFFICULTY.EASY,
  rng = Math.random,
) {
  const player = state.currentPlayer;
  const moves = legalMoves(state.pits, player);
  if (moves.length <= 1) return moves[0] ?? 0;
  if (level === DIFFICULTY.EASY) return pick(moves, rng);

  const scored = moves.map((pit) => {
    const result = sow(state.pits, player, pit);
    if (level === DIFFICULTY.NORMAL) {
      const gain = result.pits[STORE[player]] - state.pits[STORE[player]];
      return { pit, value: gain + (result.extra ? EXTRA_BONUS : 0) + (result.over ? margin(result.pits, player) : 0) };
    }
    const value = result.over
      ? margin(result.pits, player)
      : search(result.pits, result.extra ? player : 1 - player, player, HARD_DEPTH - 1, -Infinity, Infinity);
    return { pit, value };
  });
  const best = Math.max(...scored.map((entry) => entry.value));
  return pick(
    scored.filter((entry) => entry.value === best).map((entry) => entry.pit),
    rng,
  );
}
