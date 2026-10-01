import { describe, expect, it } from 'vitest';
import {
  DICE_MOOD,
  EVENT_TYPE,
  GAME_STATUS,
  HISTORY_LIMIT,
  MAX_NAME_LENGTH,
  PLAYER_COUNT,
  WINNING_SCORE,
  applyRoll,
  bankScore,
  canBank,
  canRoll,
  checkWinner,
  createGame,
  getCurrentPlayer,
  isGameOver,
  nextPlayerIndex,
  normalizeName,
  pointsToWin,
  resetGame,
  resolveDiceMood,
  restoreGame,
  rollDice,
  rollDie,
  settleTurn,
  switchPlayer,
  toSetup,
} from '../../../src/games/pig/utils/gameLogic.js';
import { createSeededRandom, rollDifferentFace, sequenceRng } from '../../../src/shared/utils/random.js';

/** Helper: a live two-player game. */
const freshGame = (names = ['Alex', 'Sam']) => createGame({ playerNames: names });

/** Helper: force a player's total score (for near-win scenarios). */
const withScore = (state, index, score) => ({
  ...state,
  players: state.players.map((player, i) => (i === index ? { ...player, score } : player)),
});

/** Helper: the squashed "what the player sees" view. */
const snapshot = (state) => ({
  current: state.currentPlayer,
  turnScore: state.turnScore,
  scores: state.players.map((player) => player.score),
  status: state.status,
  winner: state.winnerIndex,
});

describe('createGame', () => {
  it('creates two named players with empty scores', () => {
    const game = freshGame();
    expect(game.players).toHaveLength(PLAYER_COUNT);
    expect(game.players.map((player) => player.name)).toEqual(['Alex', 'Sam']);
    expect(game.players.map((player) => player.score)).toEqual([0, 0]);
    expect(game.currentPlayer).toBe(0);
    expect(game.turnScore).toBe(0);
    expect(game.diceValue).toBeNull();
    expect(game.winnerIndex).toBeNull();
  });

  it('defaults to a playable game, and accepts an explicit status', () => {
    expect(createGame().status).toBe(GAME_STATUS.PLAYING);
    expect(createGame({ status: GAME_STATUS.SETUP }).status).toBe(GAME_STATUS.SETUP);
  });
});

describe('normalizeName', () => {
  it('falls back to "Player N" for empty or non-string input', () => {
    expect(normalizeName('', 0)).toBe('Player 1');
    expect(normalizeName('   ', 1)).toBe('Player 2');
    expect(normalizeName(undefined, 1)).toBe('Player 2');
    expect(normalizeName(42, 0)).toBe('Player 1');
  });

  it('trims, collapses whitespace and caps the length', () => {
    expect(normalizeName('  Ada   Lovelace ', 0)).toBe('Ada Lovelace');
    expect(normalizeName('x'.repeat(40), 0)).toHaveLength(MAX_NAME_LENGTH);
  });
});

/* -------------------------------------------------------------------------- */
/* The six scenarios from the brief                                           */
/* -------------------------------------------------------------------------- */

describe('scenario 1 — a single roll adds to the pot', () => {
  it('roll 5 → turn score 5', () => {
    const state = applyRoll(freshGame(), 5);
    expect(state.turnScore).toBe(5);
    expect(state.players[0].score).toBe(0);
    expect(state.currentPlayer).toBe(0);
  });
});

describe('scenario 2 — rolls accumulate', () => {
  it('roll 5 then 4 → turn score 9', () => {
    const state = applyRoll(applyRoll(freshGame(), 5), 4);
    expect(state.turnScore).toBe(9);
    expect(state.players[0].score).toBe(0);
  });
});

describe('scenario 3 — banking secures the pot and passes the turn', () => {
  it('5, 4, bank → player score 9, pot 0, next player active', () => {
    const beforeBank = applyRoll(applyRoll(freshGame(), 5), 4);
    const state = bankScore(beforeBank);

    expect(state.players[0].score).toBe(9);
    expect(state.turnScore).toBe(0);
    expect(state.currentPlayer).toBe(1); // next player is active
    expect(state.status).toBe(GAME_STATUS.SWITCHING); // feedback window
    expect(settleTurn(state).status).toBe(GAME_STATUS.PLAYING);
    expect(canRoll(settleTurn(state))).toBe(true);
  });

  it('records the bank in the history', () => {
    const state = bankScore(applyRoll(freshGame(), 6));
    expect(state.history[0]).toMatchObject({
      type: EVENT_TYPE.BANK,
      playerIndex: 0,
      amount: 6,
      totalScore: 6,
    });
  });
});

describe('scenario 4 — rolling a 1 burns the pot', () => {
  it('roll 5 then 1 → pot 0, turn passes, no points added', () => {
    const state = applyRoll(applyRoll(freshGame(), 5), 1);

    expect(state.turnScore).toBe(0);
    expect(state.currentPlayer).toBe(1);
    expect(state.players[0].score).toBe(0);
    expect(state.status).toBe(GAME_STATUS.SWITCHING);
    expect(state.history[0]).toMatchObject({ type: EVENT_TYPE.BUST, lostScore: 5, value: 1 });
  });

  it('never adds the 1 to the pot (anti-bug)', () => {
    const state = applyRoll(applyRoll(applyRoll(freshGame(), 6), 6), 1);
    expect(state.turnScore).toBe(0);
  });

  it('reports a zero loss when the pot was already empty', () => {
    const state = applyRoll(freshGame(), 1);
    expect(state.history[0].lostScore).toBe(0);
    expect(state.history[0].turnScore).toBe(0);
  });
});

describe('scenario 5 — reaching 100 wins', () => {
  it('98 + roll 3 + bank → 101 and a winner', () => {
    const state = bankScore(applyRoll(withScore(freshGame(), 0, 98), 3));

    expect(state.players[0].score).toBe(101);
    expect(state.status).toBe(GAME_STATUS.WON);
    expect(state.winnerIndex).toBe(0);
    expect(isGameOver(state)).toBe(true);
    expect(checkWinner(state)).toBe(state.players[0]);
    expect(canRoll(state)).toBe(false);
    expect(canBank(state)).toBe(false);
  });

  it('wins exactly on the boundary', () => {
    const state = bankScore(applyRoll(withScore(freshGame(), 0, 97), 3));
    expect(state.players[0].score).toBe(WINNING_SCORE);
    expect(state.status).toBe(GAME_STATUS.WON);
  });

  it('does not declare a winner below the target', () => {
    const state = bankScore(applyRoll(withScore(freshGame(), 0, 96), 3));
    expect(state.players[0].score).toBe(99);
    expect(state.status).toBe(GAME_STATUS.SWITCHING);
    expect(state.winnerIndex).toBeNull();
  });
});

describe('scenario 6 — a 1 near the finish line does not win', () => {
  it('99 + a 1 → no win, pot lost, turn passes', () => {
    const state = applyRoll(applyRoll(withScore(freshGame(), 0, 99), 6), 1);

    expect(state.players[0].score).toBe(99);
    expect(state.winnerIndex).toBeNull();
    expect(state.status).toBe(GAME_STATUS.SWITCHING);
    expect(state.turnScore).toBe(0);
    expect(state.currentPlayer).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Anti-bug rules                                                             */
/* -------------------------------------------------------------------------- */

describe('anti-bug guards', () => {
  it('cannot roll once the game is over', () => {
    const won = bankScore(applyRoll(withScore(freshGame(), 0, 98), 3));
    const after = applyRoll(won, 6);
    expect(after).toBe(won); // same reference: nothing happened
    expect(after.players[0].score).toBe(101);
  });

  it('cannot bank an empty pot', () => {
    const state = freshGame();
    expect(canBank(state)).toBe(false);
    expect(bankScore(state)).toBe(state);
  });

  it('cannot bank twice in a row', () => {
    const banked = bankScore(applyRoll(freshGame(), 5));
    const again = bankScore(banked);
    expect(again).toBe(banked);
    expect(banked.players[0].score).toBe(5);
    expect(banked.players[1].score).toBe(0);
  });

  it('cannot roll while another roll is committing', () => {
    const rolling = { ...freshGame(), status: GAME_STATUS.ROLLING };
    const committed = applyRoll(rolling, 4);
    expect(committed.turnScore).toBe(4); // the in-flight roll is allowed to land
    expect(canRoll(rolling)).toBe(false); // …but no new roll may start
    expect(canBank(rolling)).toBe(false);
  });

  it('cannot roll or bank during the hand-over window', () => {
    const switching = applyRoll(applyRoll(freshGame(), 5), 1);
    expect(switching.status).toBe(GAME_STATUS.SWITCHING);
    expect(canRoll(switching)).toBe(false);
    expect(bankScore(switching)).toBe(switching);
    expect(applyRoll(switching, 6)).toBe(switching);
  });

  it('ignores impossible dice values', () => {
    const state = freshGame();
    for (const value of [0, 7, -3, 1.5, Number.NaN, 'x', null, undefined]) {
      expect(applyRoll(state, value)).toBe(state);
    }
  });

  it('never mutates the state it was given', () => {
    const state = freshGame();
    const frozen = Object.freeze({
      ...state,
      players: Object.freeze(state.players.map((player) => Object.freeze(player))),
    });
    expect(() => applyRoll(frozen, 5)).not.toThrow();
    expect(state.turnScore).toBe(0);
    expect(state.players[0].stats.rolls).toBe(0);
  });

  it('never produces a negative score', () => {
    const state = applyRoll(freshGame(), 1);
    expect(state.players.every((player) => player.score >= 0)).toBe(true);
  });

  it('keeps the turn with the player who banked if the game is won', () => {
    // Sam (player 2) is one point away and it is his turn.
    const samsTurn = { ...withScore(freshGame(), 1, 99), currentPlayer: 1 };
    const won = bankScore(applyRoll(samsTurn, 3));
    expect(won.currentPlayer).toBe(1);
    expect(won.winnerIndex).toBe(1);
    expect(switchPlayer(won)).toBe(won); // nothing moves after a win
  });
});

/* -------------------------------------------------------------------------- */
/* Turn helpers                                                               */
/* -------------------------------------------------------------------------- */

describe('turn helpers', () => {
  it('nextPlayerIndex alternates between two players', () => {
    expect(nextPlayerIndex(0)).toBe(1);
    expect(nextPlayerIndex(1)).toBe(0);
  });

  it('switchPlayer moves the turn, clears the pot and settles the status', () => {
    const state = switchPlayer({ ...freshGame(), turnScore: 9, status: GAME_STATUS.PLAYING });
    expect(state.currentPlayer).toBe(1);
    expect(state.turnScore).toBe(0);
    expect(state.status).toBe(GAME_STATUS.PLAYING);
    expect(state.turnCount).toBe(2);
  });

  it('settleTurn only closes a hand-over window', () => {
    const switching = { ...freshGame(), status: GAME_STATUS.SWITCHING };
    expect(settleTurn(switching).status).toBe(GAME_STATUS.PLAYING);
    const playing = { ...freshGame(), status: GAME_STATUS.PLAYING };
    expect(settleTurn(playing)).toBe(playing);
  });

  it('pointsToWin counts down to the target', () => {
    expect(pointsToWin(freshGame())).toBe(WINNING_SCORE);
    expect(pointsToWin(withScore(freshGame(), 0, 42))).toBe(58);
    expect(pointsToWin(withScore(freshGame(), 0, 140))).toBe(0);
  });

  it('tracks per-player stats and the best turn', () => {
    let state = applyRoll(applyRoll(freshGame(), 6), 6);
    state = bankScore(state);
    state = settleTurn(state);
    state = applyRoll(state, 1); // Sam busts
    expect(state.players[0].stats.rolls).toBe(2);
    expect(state.players[0].bestTurn).toBe(12);
    expect(state.players[1].stats.busts).toBe(1);
    expect(getCurrentPlayer(state).name).toBe('Alex');
  });

  it('caps the history length', () => {
    let state = freshGame();
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) state = applyRoll(state, 3);
    expect(state.history).toHaveLength(HISTORY_LIMIT);
    expect(state.history[0].value).toBe(3);
  });
});

/* -------------------------------------------------------------------------- */
/* Dice mood (presentation helper)                                            */
/* -------------------------------------------------------------------------- */

describe('resolveDiceMood', () => {
  it('follows the status and the last event', () => {
    expect(resolveDiceMood(freshGame())).toBe(DICE_MOOD.IDLE);
    expect(resolveDiceMood({ ...freshGame(), status: GAME_STATUS.ROLLING })).toBe(DICE_MOOD.ROLLING);
    expect(resolveDiceMood(applyRoll(freshGame(), 5))).toBe(DICE_MOOD.IDLE);
    expect(resolveDiceMood(applyRoll(freshGame(), 1))).toBe(DICE_MOOD.BUST);
    expect(resolveDiceMood(bankScore(applyRoll(freshGame(), 5)))).toBe(DICE_MOOD.BANK);
    expect(resolveDiceMood(bankScore(applyRoll(withScore(freshGame(), 0, 99), 5)))).toBe(DICE_MOOD.WIN);
  });
});

/* -------------------------------------------------------------------------- */
/* Rolling through the RNG seam                                               */
/* -------------------------------------------------------------------------- */

describe('rollDice', () => {
  it('uses the injected RNG', () => {
    const state = rollDice(freshGame(), () => 0.999); // highest face
    expect(state.diceValue).toBe(6);
    const low = rollDice(freshGame(), () => 0);
    expect(low.diceValue).toBe(1);
  });

  it('plays a scripted sequence end to end', () => {
    const rng = sequenceRng([5, 4, 6]);
    let state = rollDice(freshGame(), rng);
    state = rollDice(state, rng);
    state = rollDice(state, rng);
    expect(state.turnScore).toBe(15);
    expect(state.history.map((entry) => entry.value)).toEqual([6, 4, 5]);
  });

  it('always produces a face between 1 and 6', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rollDie(rng);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it('rollDifferentFace never repeats the current face', () => {
    const rng = createSeededRandom(3);
    for (let i = 0; i < 50; i += 1) {
      expect(rollDifferentFace(6, rng)).not.toBe(6);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Reset                                                                      */
/* -------------------------------------------------------------------------- */

describe('resetGame / toSetup', () => {
  it('starts a clean match and keeps the names', () => {
    let state = bankScore(applyRoll(freshGame(), 5));
    state = resetGame(state);
    expect(snapshot(state)).toEqual({
      current: 0,
      turnScore: 0,
      scores: [0, 0],
      status: GAME_STATUS.PLAYING,
      winner: null,
    });
    expect(state.players.map((player) => player.name)).toEqual(['Alex', 'Sam']);
    expect(state.history).toHaveLength(0);
  });

  it('accepts new names', () => {
    const state = resetGame(freshGame(), { playerNames: ['Kai', 'Mo'] });
    expect(state.players.map((player) => player.name)).toEqual(['Kai', 'Mo']);
  });

  it('drops the names when asked', () => {
    const state = resetGame(freshGame(), { keepNames: false });
    expect(state.players.map((player) => player.name)).toEqual(['Player 1', 'Player 2']);
  });

  it('returns to setup', () => {
    const state = toSetup(bankScore(applyRoll(freshGame(), 5)));
    expect(state.status).toBe(GAME_STATUS.SETUP);
    expect(state.players[0].score).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Restore (localStorage hydration)                                           */
/* -------------------------------------------------------------------------- */

describe('restoreGame', () => {
  it('rejects unusable payloads', () => {
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('nope')).toBeNull();
    expect(restoreGame({})).toBeNull();
    expect(restoreGame({ players: [{ name: 'Solo' }] })).toBeNull();
  });

  it('round-trips a live game', () => {
    const live = applyRoll(applyRoll(freshGame(), 5), 4);
    const restored = restoreGame(JSON.parse(JSON.stringify(live)));
    expect(snapshot(restored)).toEqual(snapshot(live));
    expect(restored.history).toHaveLength(live.history.length);
  });

  it('settles transient statuses instead of resuming mid-animation', () => {
    const rolling = { ...freshGame(), status: GAME_STATUS.ROLLING };
    const switching = { ...freshGame(), status: GAME_STATUS.SWITCHING };
    expect(restoreGame(rolling).status).toBe(GAME_STATUS.PLAYING);
    expect(restoreGame(switching).status).toBe(GAME_STATUS.PLAYING);
  });

  it('clamps tampered scores and keeps the pot only while playing', () => {
    const restored = restoreGame({
      ...freshGame(),
      players: [
        { name: 'Cheater', score: -50 },
        { name: 'Sam', score: 'nonsense' },
      ],
      turnScore: -4,
    });
    expect(restored.players.map((player) => player.score)).toEqual([0, 0]);
    expect(restored.turnScore).toBe(0);
  });

  it('requires a winner when the stored status is "won"', () => {
    const bogus = restoreGame({ ...freshGame(), status: GAME_STATUS.WON });
    expect(bogus.status).toBe(GAME_STATUS.PLAYING);

    const real = restoreGame({
      ...withScore(freshGame(), 0, 101),
      status: GAME_STATUS.WON,
      winnerIndex: 0,
    });
    expect(real.status).toBe(GAME_STATUS.WON);
    expect(real.winnerIndex).toBe(0);
  });

  it('repairs a missing dice value and out-of-range pointer', () => {
    const restored = restoreGame({ ...freshGame(), diceValue: 9, currentPlayer: 5, turnCount: -2 });
    expect(restored.diceValue).toBeNull();
    expect(restored.currentPlayer).toBe(1);
    expect(restored.turnCount).toBe(1);
  });
});
