/**
 * ============================================================================
 * Treasure Hunt — computer opponent (pure)
 * ============================================================================
 * `decideMove(state, level, rng)` returns `{ action: 'open', index }` or
 * `{ action: 'bank' }`. It only uses public knowledge (`knowledge(state)`) —
 * the count of trapdoors and gems still hidden — never the hidden tiles.
 *
 * Opening another tile is worth it while the pot is below the *break-even pot*:
 *     gain  = (1 − p) · average gem value        (p = chance of a trapdoor)
 *     loss  = p · pot
 *   → break-even pot = (1 − p) · average / p
 *
 *  - Easy   — banks early, at about 60% of break-even.
 *  - Normal — banks at break-even.
 *  - Hard   — break-even, adjusted by the scoreboard: bolder when behind,
 *             safer when well ahead, and it banks to lock in a lead near the end.
 * Which tile to open is a random hidden tile — they are all equally unknown.
 * ============================================================================
 */

import { DIFFICULTY, hiddenTiles, knowledge } from './engine.js';

export const MOVE = Object.freeze({ OPEN: 'open', BANK: 'bank' });

/** Pot size at which one more tile has zero expected gain. */
export function breakEvenPot(state) {
  const { hidden, trapsLeft, gemsLeft, gemValueLeft } = knowledge(state);
  if (trapsLeft === 0 || gemsLeft === 0) return Infinity;
  const p = trapsLeft / hidden;
  return ((1 - p) * (gemValueLeft / gemsLeft)) / p;
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/**
 * @param {object} state a live game (status `playing`)
 * @param {string} [level] defaults to the player-to-move's own difficulty
 * @param {() => number} [rng]
 * @returns {{ action: 'open', index: number } | { action: 'bank' }}
 */
export function decideMove(
  state,
  level = state.players[state.currentPlayer]?.bot ?? DIFFICULTY.NORMAL,
  rng = Math.random,
) {
  const open = () => ({ action: MOVE.OPEN, index: pick(hiddenTiles(state), rng) });
  if (state.pot <= 0) return open();

  const base = breakEvenPot(state);
  let threshold = base;
  if (level === DIFFICULTY.EASY) threshold = base * 0.6;
  else if (level === DIFFICULTY.HARD) {
    const me = state.players[state.currentPlayer];
    const bestRival = Math.max(...state.players.filter((p) => p.index !== me.index).map((p) => p.score));
    const lead = me.score + state.pot - bestRival;
    const { gemValueLeft } = knowledge(state);
    if (lead <= -6)
      threshold = base * 1.4; // behind: take risks
    else if (lead >= 6) threshold = base * 0.8; // ahead: protect it
    if (lead > 0 && gemValueLeft <= 4) threshold = Math.min(threshold, state.pot); // winning near the end: lock it in
  }
  return state.pot >= threshold ? { action: MOVE.BANK } : open();
}
