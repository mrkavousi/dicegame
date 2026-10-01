import { describe, expect, it } from 'vitest';
import { chooseMove } from '../../src/games/connect4/bot.js';
import { STATUS, cellIndex, createGame, drop, legalMoves, settleDrop } from '../../src/games/connect4/engine.js';
import { createSeededRandom } from '../../src/shared/utils/random.js';

/** Play columns one after another (settling in between). */
function play(columns, bots = [null, null]) {
  return columns.reduce((state, col) => settleDrop(drop(state, col)), createGame({ bots }));
}

const LEVELS = ['easy', 'normal', 'hard'];

describe('every level', () => {
  it('takes an immediate win', () => {
    // Player 0 has three in a row on the bottom: 0,1,2 — column 3 wins.
    const state = play([0, 0, 1, 1, 2, 2], ['easy', null]);
    for (const level of LEVELS)
      expect(
        chooseMove(state, level, () => 0.5),
        level,
      ).toBe(3);
  });

  it('blocks an immediate loss', () => {
    // Player 1 (to move after the next drop) must stop player 0 completing 0,1,2.
    let state = play([0, 0, 1, 1, 2]);
    expect(state.currentPlayer).toBe(1);
    for (const level of LEVELS)
      expect(
        chooseMove({ ...state, players: state.players }, level, () => 0.5),
        level,
      ).toBe(3);
  });

  it('always returns a legal column', () => {
    const rng = createSeededRandom(7);
    for (const level of LEVELS) {
      let state = createGame();
      for (let i = 0; i < 12 && state.status !== STATUS.WON; i += 1) {
        state = settleDrop(state);
        const col = chooseMove(state, level, rng);
        expect(legalMoves(state.board)).toContain(col);
        state = drop(state, col);
      }
    }
  });

  it('plays the only legal column when there is just one', () => {
    let state = createGame();
    // Fill every column except 6 without ending the game (alternating stripes).
    const columns = [0, 1, 2, 3, 4, 5].flatMap((col) => Array(6).fill(col));
    for (const col of columns) {
      state = settleDrop(state);
      if (state.status === STATUS.WON) break;
      state = drop(state, col);
    }
    if (state.status !== STATUS.WON) {
      expect(chooseMove(settleDrop(state), 'hard', () => 0)).toBe(6);
    }
  });

  it('does not mutate the state it is given', () => {
    const state = play([3, 3]);
    const snapshot = JSON.stringify(state);
    for (const level of LEVELS) chooseMove(state, level, () => 0.3);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('easy', () => {
  /** Columns where dropping gives the opponent an immediate win right on top. */
  function handoverColumns(state) {
    const me = state.currentPlayer;
    return legalMoves(state.board).filter((col) => {
      const after = settleDrop(drop(state, col));
      if (after.status === STATUS.WON) return false; // that is a win for us, not a hand-over
      const reply = legalMoves(after.board).some((next) => drop(after, next).winner === 1 - me);
      return reply;
    });
  }

  it('never makes a move that hands the opponent an immediate win when a safe move exists', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = createSeededRandom(seed);
      let state = createGame();
      for (let ply = 0; ply < 30 && state.status === STATUS.PLAYING; ply += 1) {
        const bad = handoverColumns(state);
        const moves = legalMoves(state.board);
        if (bad.length > 0 && bad.length < moves.length) {
          const col = chooseMove(state, 'easy', rng);
          const winsNow = drop(state, col).winner === state.currentPlayer;
          if (!winsNow) {
            // It may only pick a hand-over column if it was forced to block there.
            const forcedBlock = moves.some(
              (c) => drop({ ...state, currentPlayer: 1 - state.currentPlayer }, c).winner !== null,
            );
            if (!forcedBlock) expect(bad, `seed ${seed} ply ${ply}`).not.toContain(col);
          }
          checked += 1;
        }
        const next = moves[Math.floor(rng() * moves.length)];
        state = settleDrop(drop(state, next));
      }
    }
    expect(checked).toBeGreaterThan(10); // the property was actually exercised
  });
});

describe('strength', () => {
  /** Computer (seat `bot`) vs a uniformly random player. Returns the winning seat or null. */
  function playOut(level, botSeat, seed) {
    const rng = createSeededRandom(seed);
    let state = createGame({ bots: botSeat === 0 ? [level, null] : [null, level] });
    while (state.status === STATUS.PLAYING || state.status === STATUS.DROPPING) {
      state = settleDrop(state);
      const moves = legalMoves(state.board);
      const col =
        state.currentPlayer === botSeat ? chooseMove(state, level, rng) : moves[Math.floor(rng() * moves.length)];
      state = drop(state, col);
    }
    return state.winner;
  }

  it('normal beats a random player every time (both seats)', () => {
    for (const seed of [1, 2, 3, 4]) {
      expect(playOut('normal', 0, seed), `seat 0 seed ${seed}`).toBe(0);
      expect(playOut('normal', 1, seed), `seat 1 seed ${seed}`).toBe(1);
    }
  });

  it('hard beats a random player', () => {
    expect(playOut('hard', 0, 11)).toBe(0);
    expect(playOut('hard', 1, 12)).toBe(1);
  });

  it('hard beats easy', () => {
    const rng = createSeededRandom(5);
    let state = createGame({ bots: ['hard', 'easy'] });
    while (state.status === STATUS.PLAYING || state.status === STATUS.DROPPING) {
      state = settleDrop(state);
      state = drop(state, chooseMove(state, undefined, rng));
    }
    expect(state.winner).toBe(0);
  });

  it('uses the injected rng to vary equal-valued moves, deterministically', () => {
    const state = createGame({ bots: ['normal', null] });
    const a = chooseMove(state, 'normal', () => 0);
    const b = chooseMove(state, 'normal', () => 0);
    expect(a).toBe(b);
    expect(a).toBe(3); // the centre is the best opening
    expect(cellIndex(5, a)).toBe(38);
  });
});
