import { describe, expect, it } from 'vitest';
import { HARD_DEPTH, chooseMove } from '../../src/games/mancala/bot.js';
import { STATUS, STORE, createGame, legalMoves, play, scores, settle, sow } from '../../src/games/mancala/engine.js';
import { createSeededRandom } from '../../src/shared/utils/random.js';

const LEVELS = ['easy', 'normal', 'hard'];

/** A live game from a bare board (player to move given). */
function board(pits, currentPlayer = 0) {
  return { ...createGame({ playerNames: ['A', 'B'] }), pits, currentPlayer };
}

describe('every level', () => {
  it('always returns a legal pit', () => {
    const rng = createSeededRandom(4);
    for (const level of LEVELS) {
      let state = createGame();
      let guard = 0;
      while (state.status !== STATUS.WON && guard < 300) {
        guard += 1;
        state = settle(state);
        const pit = chooseMove(state, level, rng);
        expect(legalMoves(state.pits, state.currentPlayer), `${level} move ${guard}`).toContain(pit);
        state = play(state, pit);
      }
      expect(state.status, level).toBe(STATUS.WON);
    }
  });

  it('plays the only pit it has', () => {
    const state = board([0, 0, 0, 0, 3, 0, 5, 2, 2, 2, 2, 2, 2, 14]);
    for (const level of LEVELS) expect(chooseMove(state, level, () => 0.9)).toBe(4);
  });

  it('does not mutate the state and is deterministic for the same rng', () => {
    const state = createGame();
    const snapshot = JSON.stringify(state);
    for (const level of LEVELS) {
      expect(chooseMove(state, level, createSeededRandom(3))).toBe(chooseMove(state, level, createSeededRandom(3)));
    }
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('normal (greedy)', () => {
  it('takes the extra turn when it can', () => {
    // Pit index 3 holds 3 stones: 4, 5, 6 → ends in the store.
    const state = board([4, 4, 4, 3, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(chooseMove(state, 'normal', () => 0.5)).toBe(3);
  });

  it('takes a big capture over a small gain', () => {
    // Playing pit 0 (1 stone) lands in the empty pit 1, capturing the 9 opposite (pit 11).
    const pits = [1, 0, 2, 2, 2, 2, 0, 1, 1, 1, 1, 9, 1, 0];
    const state = board(pits);
    const moveAfter = chooseMove(state, 'normal', () => 0.5);
    expect(moveAfter).toBe(0);
    expect(play(state, moveAfter).lastEvent.captured).toBe(10);
  });
});

describe('hard (minimax)', () => {
  it('uses a deeper search than a single move', () => {
    expect(HARD_DEPTH).toBeGreaterThan(3);
  });

  it('finishes the game when that wins it outright', () => {
    // Player 0's only stones: pit 5 (1 stone). Playing it ends the game with a big lead.
    const state = board([0, 0, 0, 0, 0, 1, 30, 2, 0, 0, 0, 0, 0, 3]);
    expect(chooseMove(state, 'hard', () => 0)).toBe(5);
  });

  /** Plain minimax (no pruning, no move ordering) — an independent check of the bot's alpha-beta search. */
  function naive(pits, mover, me, depth) {
    const moves = legalMoves(pits, mover);
    if (depth === 0 || moves.length === 0) return pits[STORE[me]] - pits[STORE[1 - me]];
    const values = moves.map((pit) => {
      const result = sow(pits, mover, pit);
      if (result.over) return result.pits[STORE[me]] - result.pits[STORE[1 - me]];
      return naive(result.pits, result.extra ? mover : 1 - mover, me, depth - 1);
    });
    return mover === me ? Math.max(...values) : Math.min(...values);
  }

  function valueOfPit(state, pit, depth) {
    const player = state.currentPlayer;
    const result = sow(state.pits, player, pit);
    if (result.over) return result.pits[STORE[player]] - result.pits[STORE[1 - player]];
    return naive(result.pits, result.extra ? player : 1 - player, player, depth - 1);
  }

  it('always plays a move with the best minimax value (checked against plain minimax)', () => {
    const rng = createSeededRandom(6);
    let state = createGame();
    // Check a handful of real positions along a game, at the bot's own search depth.
    for (let step = 0; step < 6 && state.status !== STATUS.WON; step += 1) {
      state = settle(state);
      const chosen = chooseMove(state, 'hard', rng);
      const values = legalMoves(state.pits, state.currentPlayer).map((pit) => valueOfPit(state, pit, HARD_DEPTH));
      expect(valueOfPit(state, chosen, HARD_DEPTH), `step ${step}`).toBe(Math.max(...values));
      state = play(state, chosen);
    }
  });
});

describe('strength', () => {
  /** Two computers play a whole game; returns the final state. */
  function duel(levelA, levelB, seed, stones = 4) {
    const rng = createSeededRandom(seed);
    let state = createGame({ config: { stones, bots: [levelA, levelB] } });
    let guard = 0;
    while (state.status !== STATUS.WON && guard < 400) {
      guard += 1;
      state = settle(state);
      state = play(state, chooseMove(state, undefined, rng));
    }
    return state;
  }

  it('every game ends with all stones in the stores', () => {
    for (const [a, b] of [
      ['easy', 'normal'],
      ['normal', 'hard'],
      ['hard', 'easy'],
    ]) {
      const done = duel(a, b, 2);
      expect(done.status).toBe(STATUS.WON);
      expect(scores(done)[0] + scores(done)[1]).toBe(48);
      expect(done.pits.filter((_, i) => !STORE.includes(i)).every((n) => n === 0)).toBe(true);
    }
  });

  it('normal beats easy over several games, from both seats', () => {
    let normal = 0;
    let easy = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      const a = duel('normal', 'easy', seed);
      const b = duel('easy', 'normal', seed);
      normal += scores(a)[0] + scores(b)[1];
      easy += scores(a)[1] + scores(b)[0];
    }
    expect(normal).toBeGreaterThan(easy);
  });

  it('hard beats a random player every time, from both seats', () => {
    for (let seed = 1; seed <= 4; seed += 1) {
      const a = duel('hard', 'easy', seed);
      const b = duel('easy', 'hard', seed);
      expect(scores(a)[0], `hard first, seed ${seed}`).toBeGreaterThan(scores(a)[1]);
      expect(scores(b)[1], `hard second, seed ${seed}`).toBeGreaterThan(scores(b)[0]);
    }
  });

  it('hard is at least as strong as normal', () => {
    let hard = 0;
    let normal = 0;
    for (let seed = 1; seed <= 4; seed += 1) {
      const a = duel('hard', 'normal', seed);
      const b = duel('normal', 'hard', seed);
      hard += scores(a)[0] + scores(b)[1];
      normal += scores(a)[1] + scores(b)[0];
    }
    expect(hard).toBeGreaterThanOrEqual(normal);
  });
});
