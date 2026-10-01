/**
 * ============================================================================
 * PIG — Computer opponent (pure)
 * ============================================================================
 * `decideMove(state)` answers one question: should the active computer player
 * ROLL again or BANK? It reads the state and returns a verdict — no timers, no
 * randomness, no side effects — so every strategy is trivially unit-testable.
 *
 * Strategy
 *  - Always bank a pot that wins the game; always roll an empty pot.
 *  - Normal banks at the point where rolling stops paying off on average
 *    (the "expected value" threshold: 20 for classic Pig).
 *  - Easy banks early (about 60% of that threshold).
 *  - Hard starts from the same threshold, then adapts: it takes bigger risks
 *    when an opponent is close to winning and plays safer when far ahead.
 * ============================================================================
 */

import { DIFFICULTY, GAME_STATUS, getTargetScore, usesTwoDice } from './gameLogic.js';

export const MOVE = Object.freeze({ ROLL: 'roll', BANK: 'bank' });

/**
 * The pot size at which one more roll has zero expected gain.
 *
 *  - Classic:  (5/6)·4 − (1/6)·pot = 0                        → pot = 20
 *  - Two dice: 25/36 safe rolls averaging 8, 10/36 lose the pot,
 *              1/36 loses pot + total score                    → pot = (200 − score) / 11
 *
 * @param {object} config
 * @param {number} score the player's total score
 */
export function breakEvenPot(config, score) {
  return usesTwoDice(config) ? Math.max(0, (200 - score) / 11) : 20;
}

/** Everything the bot needs to know about the position, in one place. */
function readPosition(state) {
  const me = state.players[state.currentPlayer];
  const target = getTargetScore(state);
  const rivals = state.players.filter((player) => player.index !== me.index);
  return {
    me,
    target,
    pot: state.turnScore,
    needed: target - me.score,
    bestRival: rivals.length > 0 ? Math.max(...rivals.map((player) => player.score)) : 0,
  };
}

/**
 * @param {object} state
 * @param {string} [level] defaults to the active player's own difficulty
 * @returns {'roll'|'bank'}
 */
export function decideMove(state, level = state.players[state.currentPlayer]?.bot ?? DIFFICULTY.NORMAL) {
  if (state.status !== GAME_STATUS.PLAYING) return MOVE.ROLL;

  const { me, pot, needed, bestRival, target } = readPosition(state);
  if (pot <= 0) return MOVE.ROLL; // nothing to bank yet
  if (pot >= needed) return MOVE.BANK; // banking wins the game

  const base = breakEvenPot(state.config, me.score);

  if (level === DIFFICULTY.EASY) return pot >= Math.round(base * 0.6) ? MOVE.BANK : MOVE.ROLL;
  if (level === DIFFICULTY.NORMAL) return pot >= base ? MOVE.BANK : MOVE.ROLL;

  // ---- Hard: adapt to the scoreboard ----------------------------------------
  let threshold = base;
  const rivalThreat = bestRival + base >= target; // a rival could finish in one good turn
  if (rivalThreat && bestRival > me.score) {
    // Behind and the clock is ticking: keep pushing, up to the winning pot.
    threshold = Math.min(needed, Math.max(base, 35));
  } else if (me.score - bestRival >= 25) {
    // Comfortably ahead: protect the lead.
    threshold = Math.max(8, base - 5);
  }
  return pot >= threshold ? MOVE.BANK : MOVE.ROLL;
}
