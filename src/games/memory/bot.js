/**
 * ============================================================================
 * Memory Match — computer opponent (pure)
 * ============================================================================
 * `chooseFlip(state, level, rng)` returns the position the computer flips next.
 * It only uses what a person could know: cards that have been face-up before
 * (`state.seen`) and the card currently face-up. The difficulty is how well it
 * remembers them:
 *
 *   Easy ≈ 30%   Normal ≈ 65%   Hard = perfect memory
 *
 * Each seen card is "remembered" with that probability on every decision, drawn
 * from the injected `rng`, so games vary but tests are exact.
 * ============================================================================
 */

import { DIFFICULTY, flippable } from './engine.js';

export const RECALL = Object.freeze({
  [DIFFICULTY.EASY]: 0.3,
  [DIFFICULTY.NORMAL]: 0.65,
  [DIFFICULTY.HARD]: 1,
});

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/**
 * @param {object} state a live game (status `playing`)
 * @param {string} [level] defaults to the player-to-move's own difficulty
 * @param {() => number} [rng]
 * @returns {number} a flippable position
 */
export function chooseFlip(
  state,
  level = state.players[state.currentPlayer]?.bot ?? DIFFICULTY.EASY,
  rng = Math.random,
) {
  const options = flippable(state);
  if (options.length <= 1) return options[0] ?? 0;
  const recall = RECALL[level] ?? RECALL[DIFFICULTY.EASY];

  // Cards it remembers: seen before, still hidden, and recalled this time.
  const remembered = options.filter((i) => state.seen[i] && rng() < recall);

  if (state.flipped.length === 1) {
    // Second flip: complete the pair if the twin is remembered.
    const symbol = state.deck[state.flipped[0]];
    const twin = remembered.find((i) => state.deck[i] === symbol);
    if (twin !== undefined) return twin;
  } else {
    // First flip: start with a pair it remembers both halves of.
    const bySymbol = new Map();
    for (const i of remembered) {
      const group = bySymbol.get(state.deck[i]) ?? [];
      group.push(i);
      bySymbol.set(state.deck[i], group);
    }
    const pair = [...bySymbol.values()].find((group) => group.length >= 2);
    if (pair) return pair[0];
  }

  // Otherwise explore: prefer cards nobody has seen yet.
  const unseen = options.filter((i) => !state.seen[i]);
  // A known card would only waste the turn on a second flip, so avoid repeating one it remembers.
  const forgotten = options.filter((i) => !remembered.includes(i));
  return pick(unseen.length > 0 ? unseen : forgotten.length > 0 ? forgotten : options, rng);
}
