/**
 * ============================================================================
 * PIG — Game Logic (pure, framework-free, unit-testable)
 * ============================================================================
 *
 * Rules
 *  - Two players, one six-sided die, first to 100 points wins.
 *  - Rolling 2–6 adds to the player's *turn score* (the pot).
 *  - BANK moves the pot into the player's total score, then passes the turn.
 *  - Rolling a 1 burns the pot, ends the turn and passes to the other player.
 *
 * Every function here is pure: it takes a state and returns a NEW state.
 * No React, no DOM, no timers, no `Math.random` (RNG is injected). This means
 * the rules can be tested without rendering anything, and the UI layer can
 * never drift out of sync with the rules.
 * ============================================================================
 */

import { rollDie } from './random.js';

/** Points required to win. */
export const WINNING_SCORE = 100;

/** Number of players in a local match. */
export const PLAYER_COUNT = 2;

/** How many log entries we keep in memory / storage. */
export const HISTORY_LIMIT = 24;

/** Longest accepted player name. */
export const MAX_NAME_LENGTH = 14;

/**
 * Game status — the state machine the UI renders from.
 * setup → playing ⇄ rolling → switching → playing → … → won
 */
export const GAME_STATUS = Object.freeze({
  SETUP: 'setup',
  PLAYING: 'playing',
  ROLLING: 'rolling',
  SWITCHING: 'switching',
  WON: 'won',
});

/** Things that can happen during a match — drives UI feedback & the history log. */
export const EVENT_TYPE = Object.freeze({
  ROLL: 'roll',
  BUST: 'bust',
  BANK: 'bank',
});

/** Statuses in which the turn is settled and the active player may act. */
const INPUT_STATUSES = [GAME_STATUS.PLAYING];

/** Statuses in which a roll result may be committed to state. */
const APPLICABLE_ROLL_STATUSES = [GAME_STATUS.PLAYING, GAME_STATUS.ROLLING];

/* -------------------------------------------------------------------------- */
/* Players                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Trim/limit a user supplied name and fall back to the default label.
 * @param {unknown} name
 * @param {number} index
 * @returns {string}
 */
export function normalizeName(name, index) {
  const fallback = `Player ${index + 1}`;
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * @param {number} index
 * @param {string} [name]
 */
export function createPlayer(index, name) {
  return {
    id: index + 1,
    index,
    name: normalizeName(name, index),
    score: 0,
    bestTurn: 0,
    stats: { rolls: 0, busts: 0 },
  };
}

/* -------------------------------------------------------------------------- */
/* Game state                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Create a fresh game.
 * @param {{ playerNames?: string[], status?: string, rng?: () => number }} [options]
 */
export function createGame({ playerNames = [], status = GAME_STATUS.PLAYING } = {}) {
  return {
    status,
    players: Array.from({ length: PLAYER_COUNT }, (_, index) =>
      createPlayer(index, playerNames[index]),
    ),
    currentPlayer: 0,
    turnScore: 0,
    diceValue: null,
    /** Increments on every roll — used as an animation trigger key. */
    rollCount: 0,
    /** 1-based turn counter, handy for the UI and for stats. */
    turnCount: 1,
    /** The most recent thing that happened (drives banners / dice mood). */
    lastEvent: null,
    /** Newest-first log of notable events. */
    history: [],
    winnerIndex: null,
  };
}

/** @param {object} state */
export function getCurrentPlayer(state) {
  return state.players[state.currentPlayer];
}

/** @param {number} index */
export function nextPlayerIndex(index) {
  return (index + 1) % PLAYER_COUNT;
}

/**
 * The player who reached the winning score, or null.
 * @param {object} state
 */
export function checkWinner(state) {
  if (state.winnerIndex !== null && state.winnerIndex !== undefined) {
    return state.players[state.winnerIndex];
  }
  return state.players.find((player) => player.score >= WINNING_SCORE) ?? null;
}

/** Can the active player roll right now? (guards double-rolls & post-game rolls) */
export function canRoll(state) {
  return INPUT_STATUSES.includes(state.status);
}

/** Can the active player bank right now? (cannot bank an empty pot) */
export function canBank(state) {
  return INPUT_STATUSES.includes(state.status) && state.turnScore > 0;
}

/** Has the game ended? */
export function isGameOver(state) {
  return state.status === GAME_STATUS.WON;
}

/** Moods the die can be drawn in — presentation only, derived from state. */
export const DICE_MOOD = Object.freeze({
  IDLE: 'idle',
  ROLLING: 'rolling',
  BUST: 'bust',
  BANK: 'bank',
  WIN: 'win',
});

/**
 * What the die should "feel" like right now.
 * @param {object} state
 * @returns {string} one of DICE_MOOD
 */
export function resolveDiceMood(state) {
  if (state.status === GAME_STATUS.ROLLING) return DICE_MOOD.ROLLING;
  if (state.status === GAME_STATUS.WON) return DICE_MOOD.WIN;
  if (state.status === GAME_STATUS.SWITCHING) {
    if (state.lastEvent?.type === EVENT_TYPE.BUST) return DICE_MOOD.BUST;
    if (state.lastEvent?.type === EVENT_TYPE.BANK) return DICE_MOOD.BANK;
  }
  return DICE_MOOD.IDLE;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Log an event (newest first, capped) plus keep `lastEvent` in sync.
 * @param {object} state
 * @param {object} entry
 */
function withEvent(state, entry) {
  const event = { ...entry, id: `${state.rollCount}-${state.history.length}-${entry.type}` };
  return {
    ...state,
    lastEvent: event,
    history: [event, ...state.history].slice(0, HISTORY_LIMIT),
  };
}

/**
 * Low-level turn handover primitive.
 * Always clears the pot — the pot belongs to a single turn, never to a player —
 * and moves the active marker to the other player. The status is settled by the
 * caller so it can hold a feedback window (`switching`) when it needs to.
 * @param {object} state
 */
function passTurn(state) {
  return {
    ...state,
    currentPlayer: nextPlayerIndex(state.currentPlayer),
    turnScore: 0,
    turnCount: state.turnCount + 1,
  };
}

/**
 * Pass the turn to the other player and settle straight back into play.
 * No-op once the game is over (anti-bug: nothing moves after a winner).
 * @param {object} state
 */
export function switchPlayer(state) {
  if (state.status === GAME_STATUS.WON) return state;
  return { ...passTurn(state), status: GAME_STATUS.PLAYING };
}

/**
 * Close a handover feedback window: the next player may now act.
 * Idempotent — calling it outside `switching` changes nothing.
 * @param {object} state
 */
export function settleTurn(state) {
  if (state.status !== GAME_STATUS.SWITCHING) return state;
  return { ...state, status: GAME_STATUS.PLAYING };
}

/**
 * Set the status without touching anything else.
 * @param {object} state
 * @param {string} status
 */
export function setStatus(state, status) {
  return state.status === status ? state : { ...state, status };
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Commit a rolled face to the game state and apply every consequence.
 *
 * @param {object} state
 * @param {number} value rolled face (1–6)
 * @returns {object} new state
 */
export function applyRoll(state, value) {
  // Anti-bug: never mutate a finished game or commit a roll out of band.
  if (!APPLICABLE_ROLL_STATUSES.includes(state.status)) return state;
  if (!Number.isInteger(value) || value < 1 || value > 6) return state;

  const playerIndex = state.currentPlayer;
  const player = state.players[playerIndex];
  const rolledOne = value === 1;

  const players = state.players.map((entry, index) =>
    index === playerIndex
      ? {
          ...entry,
          bestTurn: rolledOne
            ? entry.bestTurn
            : Math.max(entry.bestTurn, state.turnScore + value),
          stats: {
            rolls: entry.stats.rolls + 1,
            busts: entry.stats.busts + (rolledOne ? 1 : 0),
          },
        }
      : entry,
  );

  const base = {
    ...state,
    players,
    diceValue: value,
    rollCount: state.rollCount + 1,
  };

  // ---- Rolled a 1: burn the pot, hand over the turn --------------------------
  if (rolledOne) {
    const lostScore = state.turnScore;
    // `switching` holds the "OH NO" feedback window; the next player is already
    // marked as active so the UI never shows a turn that has already ended.
    const busted = passTurn({
      ...withEvent(base, {
        type: EVENT_TYPE.BUST,
        playerIndex,
        playerName: player.name,
        value: 1,
        lostScore,
        turnScore: 0,
      }),
      turnScore: 0,
    });
    return { ...busted, status: GAME_STATUS.SWITCHING };
  }

  // ---- Rolled 2–6: grow the pot ---------------------------------------------
  const turnScore = state.turnScore + value;
  return withEvent(
    // Settle back to `playing`: the die has landed, the player may act again.
    { ...base, turnScore, status: GAME_STATUS.PLAYING },
    {
      type: EVENT_TYPE.ROLL,
      playerIndex,
      playerName: player.name,
      value,
      turnScore,
    },
  );
}

/**
 * Roll the die and apply the result in one step.
 * @param {object} state
 * @param {() => number} [rng]
 */
export function rollDice(state, rng = Math.random) {
  return applyRoll(state, rollDie(rng));
}

/**
 * Bank the pot into the active player's total, then end the turn or win.
 * @param {object} state
 * @returns {object} new state
 */
export function bankScore(state) {
  // Anti-bug: no banking outside a live turn, and never bank an empty pot.
  if (!canBank(state)) return state;

  const playerIndex = state.currentPlayer;
  const player = state.players[playerIndex];
  const amount = state.turnScore;
  const totalScore = player.score + amount;

  const players = state.players.map((entry, index) =>
    index === playerIndex
      ? {
          ...entry,
          score: totalScore,
          bestTurn: Math.max(entry.bestTurn, amount),
        }
      : entry,
  );

  const banked = withEvent(
    {
      ...state,
      players,
      turnScore: 0,
      status: state.status, // settled below
    },
    {
      type: EVENT_TYPE.BANK,
      playerIndex,
      playerName: player.name,
      amount,
      totalScore,
    },
  );

  // ---- Winning bank ---------------------------------------------------------
  if (totalScore >= WINNING_SCORE) {
    return { ...banked, winnerIndex: playerIndex, status: GAME_STATUS.WON };
  }

  // ---- Normal bank: pot secured, turn passes --------------------------------
  // The next player becomes active immediately; `switching` only holds the
  // "points secured" feedback (see settleTurn).
  return { ...passTurn(banked), status: GAME_STATUS.SWITCHING };
}

/**
 * Back to a brand-new board, optionally keeping (or replacing) the names.
 * @param {object} state
 * @param {{ keepNames?: boolean, playerNames?: string[], status?: string }} [options]
 */
export function resetGame(state, { keepNames = true, playerNames, status = GAME_STATUS.PLAYING } = {}) {
  const names =
    playerNames ?? (keepNames ? state.players.map((player) => player.name) : []);
  const next = createGame({ playerNames: names, status });
  return next;
}

/**
 * Back to the player-setup screen.
 * @param {object} state
 */
export function toSetup(state) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    status: GAME_STATUS.SETUP,
  });
}

/* -------------------------------------------------------------------------- */
/* Persistence / hydration                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rebuild a safe, playable state from untrusted stored data.
 * Transient statuses (`rolling`, `switching`) are settled so a refresh can
 * never strand the player mid-animation.
 *
 * @param {unknown} raw
 * @returns {object|null} a valid state, or null when the payload is unusable
 */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { players, currentPlayer, turnScore, diceValue, status, history, winnerIndex } = raw;
  if (!Array.isArray(players) || players.length !== PLAYER_COUNT) return null;

  const restoredPlayers = players.map((player, index) => ({
    ...createPlayer(index, player?.name),
    score: clampScore(player?.score),
    bestTurn: clampScore(player?.bestTurn),
    stats: {
      rolls: Math.max(0, Math.trunc(Number(player?.stats?.rolls) || 0)),
      busts: Math.max(0, Math.trunc(Number(player?.stats?.busts) || 0)),
    },
  }));

  const allowedStatuses = Object.values(GAME_STATUS);
  let safeStatus = allowedStatuses.includes(status) ? status : GAME_STATUS.PLAYING;

  // Never resume into a transient frame.
  if (safeStatus === GAME_STATUS.ROLLING || safeStatus === GAME_STATUS.SWITCHING) {
    safeStatus = GAME_STATUS.PLAYING;
  }

  const safeWinner =
    Number.isInteger(winnerIndex) && winnerIndex >= 0 && winnerIndex < PLAYER_COUNT ? winnerIndex : null;

  // A stored winner must be consistent with the scores.
  const winningIndex = restoredPlayers.findIndex((player) => player.score >= WINNING_SCORE);
  const finalWinner = safeWinner ?? (winningIndex >= 0 ? winningIndex : null);

  if (finalWinner === null && safeStatus === GAME_STATUS.WON) {
    safeStatus = GAME_STATUS.PLAYING; // pointless "won" state — keep playing
  }

  const current = Number.isInteger(currentPlayer)
    ? Math.min(Math.max(currentPlayer, 0), PLAYER_COUNT - 1)
    : 0;

  return {
    status: finalWinner !== null ? GAME_STATUS.WON : safeStatus,
    players: restoredPlayers,
    currentPlayer: finalWinner !== null ? finalWinner : current,
    turnScore: safeStatus === GAME_STATUS.PLAYING ? clampScore(turnScore) : 0,
    diceValue: Number.isInteger(diceValue) && diceValue >= 1 && diceValue <= 6 ? diceValue : null,
    rollCount: Math.max(0, Math.trunc(Number(raw.rollCount) || 0)),
    turnCount: Math.max(1, Math.trunc(Number(raw.turnCount) || 1)),
    lastEvent: null,
    history: Array.isArray(history)
      ? history.filter((entry) => entry && typeof entry.type === 'string').slice(0, HISTORY_LIMIT)
      : [],
    winnerIndex: finalWinner,
  };
}

/**
 * @param {unknown} value
 * @returns {number} a non-negative integer score
 */
function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

/** Small helpers the UI uses for copy. */
export function pointsToWin(state) {
  const player = getCurrentPlayer(state);
  return Math.max(0, WINNING_SCORE - player.score);
}

/** Convenience re-export so consumers import rules from one place. */
export { rollDie };
